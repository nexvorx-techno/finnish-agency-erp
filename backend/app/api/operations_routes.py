from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
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
    created_by_name: Optional[str] = "Site Supervisor"

class SafetyIncidentCreateSchema(BaseModel):
    site_id: Optional[int] = None
    workshop_line: str  # e.g. "Line 2 - Heavy Assembly", "Welding Workshop Bay 3"
    incident_type: str  # NEAR_MISS, MINOR_INJURY, EQUIPMENT_DAMAGE, SAFETY_VIOLATION
    severity: str = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
    occurred_at: str  # YYYY-MM-DDTHH:MM or YYYY-MM-DD HH:MM
    involved_worker_id: Optional[int] = None
    involved_worker_name: Optional[str] = None
    witnesses: Optional[str] = None
    description: str
    immediate_action_taken: str
    preventative_recommendation: Optional[str] = None
    reported_by_name: Optional[str] = "Safety Officer"


@router.get("/{client_id}/operations/workers")
def list_operations_workers(
    client_id: int,
    site_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns deployed agency workers actively operating at the client plant.
    If database is currently empty, seeds 5 realistic Finnish manufacturing deployed workers.
    """
    query = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id)
    if site_id:
        query = query.filter(WorkerDeployment.site_id == site_id)

    workers = query.order_by(WorkerDeployment.id.asc()).all()

    if len(workers) == 0:
        seed_worker_deployments(client_id, db)
        workers = query.order_by(WorkerDeployment.id.asc()).all()

    # Pre-fetch recent actions for each worker
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
            if a.worker_id not in rating_map:
                rating_map[a.worker_id] = []
            rating_map[a.worker_id].append(a.rating)

    results = []
    for w in workers:
        if search and search.strip():
            q = search.strip().lower()
            if q not in w.worker_name.lower() and q not in w.role_title.lower():
                continue

        site = db.query(ClientSite).filter(ClientSite.id == w.site_id).first()
        ratings = rating_map.get(w.worker_id, [])
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else None

        results.append({
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
        })

    return {"client_id": client_id, "workers": results}


@router.post("/{client_id}/operations/worker-action")
def submit_worker_action(
    client_id: int,
    payload: WorkerActionRequestSchema,
    db: Session = Depends(get_db)
):
    """
    Submits a client worker operational action:
    - REQUEST_REPLACEMENT: Incompetence / attendance -> triggers agency replacement queue
    - SITE_SHIFT: Transfer worker to another plant site
    - END_PLACEMENT: Project demobilization notice
    - PERFORMANCE_FEEDBACK: Rating and feedback note
    """
    try:
        eff_date = datetime.strptime(payload.effective_date, "%Y-%m-%d").date() if payload.effective_date else date.today()
    except Exception:
        eff_date = date.today()

    target_site_name = None
    if payload.target_site_id:
        target_site = db.query(ClientSite).filter(ClientSite.id == payload.target_site_id).first()
        if target_site:
            target_site_name = target_site.site_name

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
        status="PENDING_AGENCY",
        created_by_name=payload.created_by_name or "Site Supervisor",
        created_at=datetime.utcnow()
    )
    db.add(new_action)
    db.commit()
    db.refresh(new_action)
    return {
        "message": f"Worker action {payload.action_type} dispatched to Agency Portal",
        "action_id": new_action.id,
        "status": new_action.status
    }


@router.get("/{client_id}/operations/action-requests")
def list_worker_actions(
    client_id: int,
    db: Session = Depends(get_db)
):
    actions = db.query(WorkerActionRequest).filter(
        WorkerActionRequest.client_id == client_id
    ).order_by(WorkerActionRequest.id.desc()).all()

    results = []
    for a in actions:
        site = db.query(ClientSite).filter(ClientSite.id == a.site_id).first() if a.site_id else None
        results.append({
            "id": a.id,
            "worker_id": a.worker_id,
            "worker_name": a.worker_name,
            "role_title": a.role_title,
            "site_name": site.site_name if site else "Main Plant",
            "action_type": a.action_type,
            "target_site_name": a.target_site_name,
            "urgency": a.urgency,
            "rating": a.rating,
            "reason": a.reason,
            "effective_date": a.effective_date.isoformat() if a.effective_date else None,
            "status": a.status,
            "agency_feedback": a.agency_feedback,
            "created_by_name": a.created_by_name,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return {"client_id": client_id, "action_requests": results}


@router.get("/{client_id}/operations/incidents")
def list_safety_incidents(
    client_id: int,
    site_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns all Finnish occupational safety incident logs for the client.
    Seeds demonstration incidents if database is currently empty.
    """
    query = db.query(SafetyIncidentLog).filter(SafetyIncidentLog.client_id == client_id)
    if site_id:
        query = query.filter(SafetyIncidentLog.site_id == site_id)

    incidents = query.order_by(SafetyIncidentLog.id.desc()).all()

    if len(incidents) == 0:
        seed_safety_incidents(client_id, db)
        incidents = query.order_by(SafetyIncidentLog.id.desc()).all()

    results = []
    for inc in incidents:
        site = db.query(ClientSite).filter(ClientSite.id == inc.site_id).first() if inc.site_id else None
        results.append({
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
            "reported_by_name": inc.reported_by_name,
            "created_at": inc.created_at.isoformat() if inc.created_at else None,
        })

    return {"client_id": client_id, "incidents": results}


@router.post("/{client_id}/operations/incidents")
def report_safety_incident(
    client_id: int,
    payload: SafetyIncidentCreateSchema,
    db: Session = Depends(get_db)
):
    """
    Logs an occupational safety incident or near-miss (Läheltä piti) under Finnish safety regulations.
    Generates unique incident code and auto-notifies Agency HR.
    """
    count = db.query(SafetyIncidentLog).count() + 1
    incident_code = f"INC-2026-{count:03d}"

    try:
        clean_time_str = payload.occurred_at.replace("T", " ")
        if len(clean_time_str) == 16:
            clean_time_str += ":00"
        occurred_dt = datetime.strptime(clean_time_str, "%Y-%m-%d %H:%M:%S")
    except Exception:
        occurred_dt = datetime.utcnow()

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
        status="REPORTED",
        reported_by_name=payload.reported_by_name or "Safety Officer",
        created_at=datetime.utcnow()
    )
    db.add(new_inc)
    db.commit()
    db.refresh(new_inc)
    return {
        "message": f"Safety incident {incident_code} successfully logged & dispatched to Agency HR",
        "incident_code": new_inc.incident_code,
        "status": new_inc.status,
    }


def seed_worker_deployments(client_id: int, db: Session):
    """Seeds 5 realistic Finnish manufacturing deployed workers"""
    site1 = db.query(ClientSite).filter(ClientSite.client_id == client_id).first()
    site2 = db.query(ClientSite).filter(ClientSite.client_id == client_id, ClientSite.id != site1.id).first() if site1 else None

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
            status="ACTIVE"
        )
        db.add(dep)
    db.commit()


def seed_safety_incidents(client_id: int, db: Session):
    """Seeds demonstration incidents including Finnish Läheltä piti (Near-Miss)"""
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
        created_at=datetime.utcnow() - timedelta(days=3)
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
        created_at=datetime.utcnow() - timedelta(days=1)
    )

    db.add(inc1)
    db.add(inc2)
    db.commit()
