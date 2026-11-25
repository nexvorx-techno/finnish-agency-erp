import json
from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.core.site_access import get_allowed_site_ids_for_user, assert_user_can_access_site
from app.core.approval_engine import (
    initiate_global_approval,
    notify_level_1_on_create,
    execute_sequential_approval_step,
    get_approval_step_metadata,
)
from app.models.client import (
    WorkerDeployment,
    ClientSite,
    WorkerActionRequest,
    SafetyIncidentLog,
    ClientCompany,
)

router = APIRouter(prefix="/api/client", tags=["Client Worker Operations & Safety"])


# Pydantic Schemas
class WorkerActionRequestSchema(BaseModel):
    worker_id: int
    worker_name: str
    site_id: Optional[int] = None
    role_title: Optional[str] = None
    action_type: str  # REQUEST_REPLACEMENT, SITE_SHIFT, END_PLACEMENT, PERFORMANCE_FEEDBACK
    target_site_id: Optional[int] = None
    target_site_name: Optional[str] = None
    urgency: Optional[str] = "STANDARD"  # IMMEDIATE_24H, 3_DAYS, STANDARD_1_WEEK
    rating: Optional[int] = None  # 1-5
    reason: str
    effective_date: Optional[str] = None  # YYYY-MM-DD
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = "Site Supervisor"


class SafetyIncidentCreateSchema(BaseModel):
    site_id: Optional[int] = None
    workshop_line: str
    incident_type: str  # NEAR_MISS, MINOR_INJURY, EQUIPMENT_DAMAGE, SAFETY_VIOLATION
    severity: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    occurred_at: str  # YYYY-MM-DDTHH:MM or YYYY-MM-DD HH:MM
    involved_worker_id: Optional[int] = None
    involved_worker_name: Optional[str] = None
    witnesses: Optional[str] = None
    description: str
    immediate_action_taken: str
    preventative_recommendation: Optional[str] = None
    created_by_user_id: Optional[int] = None
    reported_by_name: Optional[str] = "Safety Officer"


class OperationsApprovalDecisionSchema(BaseModel):
    decision: str  # "APPROVE" or "REJECT"
    approver_user_id: Optional[int] = None
    approver_name: Optional[str] = "Approver"
    approver_role: Optional[str] = "SITE_MANAGER"
    notes: Optional[str] = None


@router.get("/{client_id}/operations/workers")
def list_operations_workers(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    total_dep = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id).count()
    if total_dep == 0:
        seed_worker_deployments(client_id, db)

    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    query = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id)
    if allowed_ids is not None:
        query = query.filter(WorkerDeployment.site_id.in_(allowed_ids))

    workers = query.order_by(WorkerDeployment.id.asc()).all()

    actions = db.query(WorkerActionRequest).filter(WorkerActionRequest.client_id == client_id).all()
    action_map = {}
    rating_map = {}
    for a in actions:
        if a.worker_id not in action_map or a.id > action_map[a.worker_id]["id"]:
            action_map[a.worker_id] = {
                "id": a.id,
                "action_type": a.action_type,
                "status": a.status,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
        if a.rating:
            rating_map.setdefault(a.worker_id, []).append(a.rating)

    results = []
    for w in workers:
        if search and search.strip():
            q = search.strip().lower()
            if q not in w.worker_name.lower() and q not in w.role_title.lower():
                continue

        site = db.query(ClientSite).filter(ClientSite.id == w.site_id).first()
        ratings = rating_map.get(w.worker_id, [])
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None

        results.append(
            {
                "id": w.id,
                "worker_id": w.worker_id,
                "worker_name": w.worker_name,
                "worker_hetu_masked": w.worker_hetu_masked,
                "client_id": w.client_id,
                "site_id": w.site_id,
                "site_name": site.site_name if site else "Main Plant",
                "site_code": site.site_code if site else "TMP-01",
                "role_title": w.role_title,
                "tes_category": w.tes_category,
                "client_charge_rate": w.client_charge_rate,
                "supervisor_name": w.supervisor_name or "Matti Virtanen",
                "start_date": w.start_date.isoformat() if w.start_date else None,
                "end_date": w.end_date.isoformat() if w.end_date else None,
                "status": w.status,
                "average_rating": avg_rating,
                "last_action": action_map.get(w.worker_id),
            }
        )

    return {"client_id": client_id, "workers": results}


@router.post("/{client_id}/operations/worker-action")
def submit_worker_action(
    client_id: int,
    payload: WorkerActionRequestSchema,
    db: Session = Depends(get_db),
):
    assert_user_can_access_site(db, client_id, payload.created_by_user_id, payload.site_id)

    try:
        eff_date = (
            datetime.strptime(payload.effective_date, "%Y-%m-%d").date()
            if payload.effective_date
            else date.today()
        )
    except Exception:
        eff_date = date.today()

    target_site_name = None
    if payload.target_site_id:
        target_site = db.query(ClientSite).filter(ClientSite.id == payload.target_site_id).first()
        if target_site:
            target_site_name = target_site.site_name

    initial_status, current_step, total_steps, history, levels = initiate_global_approval(
        db=db,
        client_id=client_id,
        flow_key="m1.5_actions",
        released_status="PENDING_AGENCY",
        initiator_user_id=payload.created_by_user_id,
        initiator_name=payload.created_by_name or "Site Supervisor",
    )

    new_action = WorkerActionRequest(
        client_id=client_id,
        site_id=payload.site_id,
        worker_id=payload.worker_id,
        worker_name=payload.worker_name.strip(),
        role_title=payload.role_title,
        action_type=payload.action_type.strip().upper(),
        target_site_id=payload.target_site_id,
        target_site_name=target_site_name,
        urgency=payload.urgency or "STANDARD",
        rating=payload.rating,
        reason=payload.reason.strip(),
        effective_date=eff_date,
        status=initial_status,
        current_approval_step=current_step,
        total_approval_steps=total_steps,
        approval_history=json.dumps(history),
        created_by_user_id=payload.created_by_user_id,
        created_by_name=payload.created_by_name or "Site Supervisor",
        created_at=datetime.utcnow(),
    )
    db.add(new_action)
    db.flush()

    notify_level_1_on_create(
        db=db,
        client_id=client_id,
        flow_key="m1.5_actions",
        levels=levels,
        reference_id=new_action.id,
        reference_code=payload.worker_name.strip(),
    )

    db.commit()
    db.refresh(new_action)
    return {
        "message": f"Worker action {payload.action_type} submitted",
        "action_id": new_action.id,
        "status": new_action.status,
    }


@router.get("/{client_id}/operations/action-requests")
def list_worker_actions(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)
    q = db.query(WorkerActionRequest).filter(WorkerActionRequest.client_id == client_id)
    if allowed_ids is not None:
        q = q.filter(WorkerActionRequest.site_id.in_(allowed_ids))

    actions = q.order_by(WorkerActionRequest.id.desc()).all()

    results = []
    for a in actions:
        site = db.query(ClientSite).filter(ClientSite.id == a.site_id).first() if a.site_id else None
        is_pending = a.status == "PENDING_INTERNAL_APPROVAL"
        step_meta = get_approval_step_metadata(
            db=db,
            client_id=a.client_id,
            flow_key="m1.5_actions",
            current_step=getattr(a, "current_approval_step", 1) or 1,
            total_steps=getattr(a, "total_approval_steps", 1) or 1,
            is_pending=is_pending,
        )
        results.append(
            {
                "id": a.id,
                "worker_id": a.worker_id,
                "worker_name": a.worker_name,
                "role_title": a.role_title,
                "site_id": a.site_id,
                "site_name": site.site_name if site else "Main Plant",
                "action_type": a.action_type,
                "target_site_name": a.target_site_name,
                "urgency": a.urgency,
                "rating": a.rating,
                "reason": a.reason,
                "effective_date": a.effective_date.isoformat() if a.effective_date else None,
                "status": a.status,
                "current_approval_step": step_meta["current_approval_step"],
                "total_approval_steps": step_meta["total_approval_steps"],
                "current_approver_id": step_meta["current_approver_id"],
                "current_approver_name": step_meta["current_approver_name"],
                "agency_feedback": a.agency_feedback,
                "created_by_name": a.created_by_name,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
        )
    return {"client_id": client_id, "action_requests": results}


@router.post("/operations/action-requests/{action_id}/approval-decision")
def approve_worker_action_step(
    action_id: int,
    payload: OperationsApprovalDecisionSchema,
    db: Session = Depends(get_db),
):
    act = db.query(WorkerActionRequest).filter(WorkerActionRequest.id == action_id).first()
    if not act:
        raise HTTPException(status_code=404, detail="Worker action request not found")

    if act.site_id and payload.approver_user_id:
        assert_user_can_access_site(db, act.client_id, payload.approver_user_id, act.site_id)

    new_status, new_step, total_steps, updated_history, _ = execute_sequential_approval_step(
        db=db,
        client_id=act.client_id,
        flow_key="m1.5_actions",
        current_status=act.status,
        current_step=getattr(act, "current_approval_step", 1) or 1,
        total_steps=getattr(act, "total_approval_steps", 1) or 1,
        history_json=getattr(act, "approval_history", None),
        decision=payload.decision,
        acting_user_id=payload.approver_user_id,
        acting_user_name=payload.approver_name or "Approver",
        acting_user_role=payload.approver_role or "SITE_MANAGER",
        notes=payload.notes,
        reference_id=act.id,
        reference_code=act.worker_name,
        initiator_user_id=getattr(act, "created_by_user_id", None),
        released_status="PENDING_AGENCY",
        rejected_status="REJECTED_INTERNAL",
    )

    act.status = new_status
    act.current_approval_step = new_step
    act.total_approval_steps = total_steps
    act.approval_history = updated_history
    db.commit()
    db.refresh(act)
    return {
        "status": act.status,
        "current_approval_step": act.current_approval_step,
        "total_approval_steps": act.total_approval_steps,
    }


@router.get("/{client_id}/operations/incidents")
def list_safety_incidents(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    total_inc = db.query(SafetyIncidentLog).filter(SafetyIncidentLog.client_id == client_id).count()
    if total_inc == 0:
        seed_safety_incidents(client_id, db)

    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    query = db.query(SafetyIncidentLog).filter(SafetyIncidentLog.client_id == client_id)
    if allowed_ids is not None:
        query = query.filter(SafetyIncidentLog.site_id.in_(allowed_ids))

    incidents = query.order_by(SafetyIncidentLog.id.desc()).all()

    results = []
    for inc in incidents:
        site = db.query(ClientSite).filter(ClientSite.id == inc.site_id).first() if inc.site_id else None
        is_pending = inc.status == "PENDING_INTERNAL_APPROVAL"
        step_meta = get_approval_step_metadata(
            db=db,
            client_id=inc.client_id,
            flow_key="m1.5_safety",
            current_step=getattr(inc, "current_approval_step", 1) or 1,
            total_steps=getattr(inc, "total_approval_steps", 1) or 1,
            is_pending=is_pending,
        )
        results.append(
            {
                "id": inc.id,
                "incident_code": inc.incident_code,
                "client_id": inc.client_id,
                "site_id": inc.site_id,
                "site_name": site.site_name if site else "Main Plant",
                "workshop_line": inc.workshop_line,
                "incident_type": inc.incident_type,
                "severity": inc.severity,
                "occurred_at": inc.occurred_at.isoformat() if inc.occurred_at else None,
                "involved_worker_id": inc.involved_worker_id,
                "involved_worker_name": inc.involved_worker_name,
                "witnesses": inc.witnesses,
                "description": inc.description,
                "immediate_action_taken": inc.immediate_action_taken,
                "preventative_recommendation": inc.preventative_recommendation,
                "status": inc.status,
                "current_approval_step": step_meta["current_approval_step"],
                "total_approval_steps": step_meta["total_approval_steps"],
                "current_approver_id": step_meta["current_approver_id"],
                "current_approver_name": step_meta["current_approver_name"],
                "reported_by_name": inc.reported_by_name,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
            }
        )

    return {"client_id": client_id, "incidents": results}


@router.post("/{client_id}/operations/incidents")
def report_safety_incident(
    client_id: int,
    payload: SafetyIncidentCreateSchema,
    db: Session = Depends(get_db),
):
    assert_user_can_access_site(db, client_id, payload.created_by_user_id, payload.site_id)

    count = db.query(SafetyIncidentLog).count() + 1
    incident_code = f"INC-2026-{count:03d}"
    while db.query(SafetyIncidentLog).filter(SafetyIncidentLog.incident_code == incident_code).first():
        count += 1
        incident_code = f"INC-2026-{count:03d}"

    try:
        clean_time_str = payload.occurred_at.replace("T", " ")
        if len(clean_time_str) == 16:
            clean_time_str += ":00"
        occurred_dt = datetime.strptime(clean_time_str, "%Y-%m-%d %H:%M:%S")
    except Exception:
        occurred_dt = datetime.utcnow()

    initial_status, current_step, total_steps, history, levels = initiate_global_approval(
        db=db,
        client_id=client_id,
        flow_key="m1.5_safety",
        released_status="REPORTED",
        initiator_user_id=payload.created_by_user_id,
        initiator_name=payload.reported_by_name or "Safety Officer",
    )

    new_inc = SafetyIncidentLog(
        incident_code=incident_code,
        client_id=client_id,
        site_id=payload.site_id,
        workshop_line=payload.workshop_line.strip(),
        incident_type=payload.incident_type.strip().upper(),
        severity=payload.severity.strip().upper(),
        occurred_at=occurred_dt,
        involved_worker_id=payload.involved_worker_id,
        involved_worker_name=(payload.involved_worker_name or "").strip() or None,
        witnesses=(payload.witnesses or "").strip() or None,
        description=payload.description.strip(),
        immediate_action_taken=payload.immediate_action_taken.strip(),
        preventative_recommendation=(payload.preventative_recommendation or "").strip() or None,
        status=initial_status,
        current_approval_step=current_step,
        total_approval_steps=total_steps,
        approval_history=json.dumps(history),
        created_by_user_id=payload.created_by_user_id,
        reported_by_name=payload.reported_by_name or "Safety Officer",
        created_at=datetime.utcnow(),
    )
    db.add(new_inc)
    db.flush()

    notify_level_1_on_create(
        db=db,
        client_id=client_id,
        flow_key="m1.5_safety",
        levels=levels,
        reference_id=new_inc.id,
        reference_code=incident_code,
    )

    db.commit()
    db.refresh(new_inc)
    return {
        "message": f"Safety incident {incident_code} logged",
        "incident_code": new_inc.incident_code,
        "status": new_inc.status,
    }


@router.post("/operations/incidents/{incident_id}/approval-decision")
def approve_safety_incident_step(
    incident_id: int,
    payload: OperationsApprovalDecisionSchema,
    db: Session = Depends(get_db),
):
    inc = db.query(SafetyIncidentLog).filter(SafetyIncidentLog.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Safety incident not found")

    if inc.site_id and payload.approver_user_id:
        assert_user_can_access_site(db, inc.client_id, payload.approver_user_id, inc.site_id)

    new_status, new_step, total_steps, updated_history, _ = execute_sequential_approval_step(
        db=db,
        client_id=inc.client_id,
        flow_key="m1.5_safety",
        current_status=inc.status,
        current_step=getattr(inc, "current_approval_step", 1) or 1,
        total_steps=getattr(inc, "total_approval_steps", 1) or 1,
        history_json=getattr(inc, "approval_history", None),
        decision=payload.decision,
        acting_user_id=payload.approver_user_id,
        acting_user_name=payload.approver_name or "Approver",
        acting_user_role=payload.approver_role or "SITE_MANAGER",
        notes=payload.notes,
        reference_id=inc.id,
        reference_code=inc.incident_code,
        initiator_user_id=getattr(inc, "created_by_user_id", None),
        released_status="REPORTED",
        rejected_status="REJECTED_INTERNAL",
    )

    inc.status = new_status
    inc.current_approval_step = new_step
    inc.total_approval_steps = total_steps
    inc.approval_history = updated_history
    db.commit()
    db.refresh(inc)
    return {
        "status": inc.status,
        "current_approval_step": inc.current_approval_step,
        "total_approval_steps": inc.total_approval_steps,
    }


def seed_worker_deployments(client_id: int, db: Session):
    site1 = db.query(ClientSite).filter(ClientSite.client_id == client_id).first()
    site2 = (
        db.query(ClientSite)
        .filter(ClientSite.client_id == client_id, ClientSite.id != site1.id)
        .first()
        if site1
        else None
    )

    s1_id = site1.id if site1 else 1
    s2_id = site2.id if site2 else s1_id

    workers_data = [
        {"worker_id": 101, "name": "Antti Mäkinen", "hetu": "140889-***B", "role": "CNC Machinist (Fanuc/Siemens)", "tes": "Teknologiateollisuus TVR 4", "rate": 28.50, "site": s1_id, "sup": "Heikki Härkönen"},
        {"worker_id": 102, "name": "Tomasz Kowalski", "hetu": "220392-***F", "role": "MIG/MAG Welder (ISO 9606-1)", "tes": "Teknologiateollisuus TVR 3", "rate": 26.00, "site": s1_id, "sup": "Heikki Härkönen"},
        {"worker_id": 103, "name": "Juho Rantanen", "hetu": "091185-***C", "role": "Mechanical Assembly Fitter", "tes": "Teknologiateollisuus TVR 3", "rate": 25.50, "site": s1_id, "sup": "Matti Virtanen"},
        {"worker_id": 104, "name": "Elena Popescu", "hetu": "300494-***H", "role": "Industrial Electrician (S2)", "tes": "Sähköistysala TVR 4", "rate": 29.00, "site": s2_id, "sup": "Pekka Laine"},
        {"worker_id": 105, "name": "Mikael Lindström", "hetu": "170691-***D", "role": "Robotic Welding Specialist", "tes": "Teknologiateollisuus TVR 5", "rate": 31.50, "site": s2_id, "sup": "Pekka Laine"},
    ]

    for wd in workers_data:
        dep = WorkerDeployment(
            worker_id=wd["worker_id"],
            worker_name=wd["name"],
            worker_hetu_masked=wd["hetu"],
            client_id=client_id,
            site_id=wd["site"],
            role_title=wd["role"],
            tes_category=wd["tes"],
            client_charge_rate=wd["rate"],
            supervisor_name=wd["sup"],
            start_date=date(2026, 9, 1),
            status="ACTIVE",
        )
        db.add(dep)
    db.commit()


def seed_safety_incidents(client_id: int, db: Session):
    site = db.query(ClientSite).filter(ClientSite.client_id == client_id).first()
    s_id = site.id if site else 1

    inc1 = SafetyIncidentLog(
        incident_code="INC-2026-001",
        client_id=client_id,
        site_id=s_id,
        workshop_line="CNC Machining Bay 2",
        incident_type="NEAR_MISS",
        severity="MEDIUM",
        occurred_at=datetime.utcnow() - timedelta(days=3, hours=4),
        involved_worker_id=101,
        involved_worker_name="Antti Mäkinen",
        witnesses="Juho Rantanen, Pekka Laine",
        description="Overhead gantry crane cable snagged near CNC chuck during heavy casting lifting. Operator stopped crane in time, no load fell.",
        immediate_action_taken="Line halted for 20 mins; crane clearance boundaries visually re-marked on workshop floor.",
        preventative_recommendation="Install overhead height sensor and conduct refresher on Finnish crane rigging protocols.",
        status="CORRECTIVE_ACTION_ISSUED",
        reported_by_name="Heikki Härkönen (Site Lead)",
        created_at=datetime.utcnow() - timedelta(days=3),
    )

    inc2 = SafetyIncidentLog(
        incident_code="INC-2026-002",
        client_id=client_id,
        site_id=s_id,
        workshop_line="Welding Workshop Hall 4",
        incident_type="MINOR_INJURY",
        severity="LOW",
        occurred_at=datetime.utcnow() - timedelta(days=1, hours=2),
        involved_worker_id=102,
        involved_worker_name="Tomasz Kowalski",
        witnesses="Mikael Lindström",
        description="Minor hot spark contact on wrist while grinding weld bevel. Fire-resistant glove cuff had a 1cm gap with sleeve.",
        immediate_action_taken="First aid applied immediately; burn dressing supplied from station 4.",
        preventative_recommendation="Ensure all welding team members wear extended leather gauntlets overlapping jacket sleeves completely.",
        status="REPORTED",
        reported_by_name="Matti Virtanen (Safety Steward)",
        created_at=datetime.utcnow() - timedelta(days=1),
    )

    db.add(inc1)
    db.add(inc2)
    db.commit()
