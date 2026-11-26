import json
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.client import ClientCompany, ClientSite, ClientUser, WorkerDeployment, ClientNotification
from app.models.approvals_timesheets import ClientLeaveRequest, ClientOvertimeRequest, TimesheetBatch
from app.core.site_access import get_allowed_site_ids_for_user
from app.core.approval_engine import (
    initiate_global_approval,
    execute_sequential_approval_step,
    get_approval_step_metadata,
)

router = APIRouter()


# =====================================================================
# PYDANTIC SCHEMAS
# =====================================================================
class LeaveCreateIn(BaseModel):
    site_id: int
    worker_id: int
    worker_name: str
    role_title: str
    leave_type: str  # SICK_LEAVE, ANNUAL_VACATION, UNPAID_LEAVE, PARENTAL_LEAVE
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    total_days: int
    reason: str
    doctor_certificate_url: Optional[str] = None
    created_by_user_id: Optional[int] = None


class ApprovalDecisionIn(BaseModel):
    action: str  # "APPROVE" or "REJECT"
    notes: Optional[str] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None


class OvertimeCreateIn(BaseModel):
    site_id: int
    worker_id: int
    worker_name: str
    role_title: str
    shift_date: str  # YYYY-MM-DD
    planned_shift: str
    overtime_hours: float
    justification_reason: str
    created_by_user_id: Optional[int] = None


class TimesheetVerifyIn(BaseModel):
    notes: Optional[str] = None
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None


# =====================================================================
# SEED INITIAL REALISTIC FINNISH RECORDS
# =====================================================================
def seed_approvals_timesheets_if_needed(client_id: int, db: Session):
    # 1. Seed Leaves
    if db.query(ClientLeaveRequest).filter(ClientLeaveRequest.client_id == client_id).count() == 0:
        site = db.query(ClientSite).filter(ClientSite.client_id == client_id).first()
        site_id = site.id if site else 1
        today = date.today()

        leaves_data = [
            ClientLeaveRequest(
                client_id=client_id,
                site_id=site_id,
                worker_id=101,
                worker_name="Antti Korhonen",
                role_title="CNC Machinist (Heidenhain)",
                leave_type="SICK_LEAVE",
                start_date=today,
                end_date=today + timedelta(days=2),
                total_days=3,
                reason="Seasonal viral respiratory infection. Doctor issued statutory medical certificate A.",
                doctor_certificate_url="https://terveystalo.fi/todistus/A-2026-9481.pdf",
                doctor_certificate_verified=True,
                status="PENDING",
                current_approval_step=1,
                total_approval_steps=1,
                created_at=datetime.utcnow() - timedelta(hours=4),
            ),
            ClientLeaveRequest(
                client_id=client_id,
                site_id=site_id,
                worker_id=102,
                worker_name="Matti Virtanen",
                role_title="MIG/MAG Welder (EN ISO 9606-1)",
                leave_type="ANNUAL_VACATION",
                start_date=today + timedelta(days=7),
                end_date=today + timedelta(days=11),
                total_days=5,
                reason="Statutory Finnish winter holiday week (Vuosilomalaki). Shift line cover arranged with J. Laine.",
                doctor_certificate_url=None,
                doctor_certificate_verified=False,
                status="PENDING",
                current_approval_step=1,
                total_approval_steps=1,
                created_at=datetime.utcnow() - timedelta(hours=18),
            ),
            ClientLeaveRequest(
                client_id=client_id,
                site_id=site_id,
                worker_id=103,
                worker_name="Olena Shevchenko",
                role_title="Quality & NDT Inspector",
                leave_type="SICK_LEAVE",
                start_date=today - timedelta(days=5),
                end_date=today - timedelta(days=4),
                total_days=2,
                reason="Acute migraine & occupational health referral. 2 days bed rest.",
                doctor_certificate_url="https://pihlajalinna.fi/todistus/SV-4912.pdf",
                doctor_certificate_verified=True,
                status="APPROVED",
                current_approval_step=1,
                total_approval_steps=1,
                reviewed_by="Client Admin (Site HR)",
                reviewed_at=datetime.utcnow() - timedelta(days=4),
                reviewer_notes="Statutory sick pay approved in accordance with Teknologiateollisuus TES §16.",
                created_at=datetime.utcnow() - timedelta(days=5),
            ),
        ]
        for l in leaves_data:
            db.add(l)
        db.commit()

    # 2. Seed Overtime Requests
    if db.query(ClientOvertimeRequest).filter(ClientOvertimeRequest.client_id == client_id).count() == 0:
        site = db.query(ClientSite).filter(ClientSite.client_id == client_id).first()
        site_id = site.id if site else 1
        today = date.today()

        ot_data = [
            ClientOvertimeRequest(
                client_id=client_id,
                site_id=site_id,
                worker_id=104,
                worker_name="Juha Laine",
                role_title="Plant Maintenance Mechanic",
                shift_date=today - timedelta(days=1),
                planned_shift="Morning Shift (06:00–14:30)",
                overtime_hours=3.5,
                ot_50_hours=2.0,
                ot_100_hours=1.5,
                tes_rule="Teknologiateollisuus TES §18 - Daily Overtime (2h @ 50%, remaining @ 100%)",
                justification_reason="Emergency hydraulic cylinder failure on Line 2. Remained to complete welding repair & safety testing before evening shift startup.",
                status="PENDING",
                current_approval_step=1,
                total_approval_steps=1,
                created_at=datetime.utcnow() - timedelta(hours=8),
            ),
            ClientOvertimeRequest(
                client_id=client_id,
                site_id=site_id,
                worker_id=105,
                worker_name="Ville Mäkinen",
                role_title="Assembly Operator",
                shift_date=today - timedelta(days=2),
                planned_shift="Evening Shift (14:00–22:30)",
                overtime_hours=2.0,
                ot_50_hours=2.0,
                ot_100_hours=0.0,
                tes_rule="Teknologiateollisuus TES §18 - Daily Overtime (2h @ 50%)",
                justification_reason="Urgent heavy gearbox export batch for Valmet logistics container loading.",
                status="PENDING",
                current_approval_step=1,
                total_approval_steps=1,
                created_at=datetime.utcnow() - timedelta(days=1),
            ),
            ClientOvertimeRequest(
                client_id=client_id,
                site_id=site_id,
                worker_id=106,
                worker_name="Tarja Lehtonen",
                role_title="TIG Welder",
                shift_date=today - timedelta(days=4),
                planned_shift="Saturday Overtime Shift (08:00–16:00)",
                overtime_hours=4.0,
                ot_50_hours=2.0,
                ot_100_hours=2.0,
                tes_rule="Teknologiateollisuus TES §18 - Weekly Overtime (Sunnuntaityö & Weekend 100%)",
                justification_reason="Critical pressure vessel test certification run requested by Kiwa Inspecta auditor.",
                status="APPROVED",
                current_approval_step=1,
                total_approval_steps=1,
                reviewed_by="Client Admin (Operations Manager)",
                reviewed_at=datetime.utcnow() - timedelta(days=3),
                reviewer_notes="Approved with full 100% weekend surcharges logged.",
                created_at=datetime.utcnow() - timedelta(days=4),
            ),
        ]
        for ot in ot_data:
            db.add(ot)
        db.commit()

    # 3. Seed Timesheet Batches
    if db.query(TimesheetBatch).filter(TimesheetBatch.client_id == client_id).count() == 0:
        site = db.query(ClientSite).filter(ClientSite.client_id == client_id).first()
        site_id = site.id if site else 1
        today = date.today()

        # Last week (Week 47) and Current week (Week 48)
        w47_start = today - timedelta(days=today.weekday() + 7)
        w47_end = w47_start + timedelta(days=6)
        w48_start = today - timedelta(days=today.weekday())
        w48_end = w48_start + timedelta(days=6)

        batches = [
            TimesheetBatch(
                client_id=client_id,
                site_id=site_id,
                batch_code=f"TS-2026-W48-{site.site_code if site else 'TMP01'}",
                week_label=f"Week 48 ({w48_start.strftime('%d.%m')} - {w48_end.strftime('%d.%m.%Y')})",
                period_start=w48_start,
                period_end=w48_end,
                total_workers=14,
                total_regular_hours=525.0,
                total_overtime_hours=28.5,
                total_evening_hours=84.0,
                total_night_hours=32.0,
                status="SUBMITTED_FOR_VERIFICATION",
                current_approval_step=1,
                total_approval_steps=1,
                created_at=datetime.utcnow() - timedelta(hours=6),
            ),
            TimesheetBatch(
                client_id=client_id,
                site_id=site_id,
                batch_code=f"TS-2026-W47-{site.site_code if site else 'TMP01'}",
                week_label=f"Week 47 ({w47_start.strftime('%d.%m')} - {w47_end.strftime('%d.%m.%Y')})",
                period_start=w47_start,
                period_end=w47_end,
                total_workers=14,
                total_regular_hours=525.0,
                total_overtime_hours=34.0,
                total_evening_hours=92.0,
                total_night_hours=36.0,
                status="VERIFIED_BY_CLIENT",
                current_approval_step=1,
                total_approval_steps=1,
                verified_by_user_id=1,
                verified_by_name="Client Admin (Production Supervisor)",
                verified_at=datetime.utcnow() - timedelta(days=3),
                verification_notes="All electronic plant gate punches reconciled against shift roster. Overtime verified & signed off.",
                created_at=datetime.utcnow() - timedelta(days=7),
            ),
        ]
        for b in batches:
            db.add(b)
        db.commit()


# =====================================================================
# 1. LEAVE APPROVAL ENDPOINTS
# =====================================================================
@router.get("/client/{client_id}/approvals/leaves")
def get_leave_requests(
    client_id: int,
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    seed_approvals_timesheets_if_needed(client_id, db)
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    q = db.query(ClientLeaveRequest).filter(ClientLeaveRequest.client_id == client_id)
    if allowed_ids is not None:
        q = q.filter(ClientLeaveRequest.site_id.in_(allowed_ids))
    if status and status != "ALL":
        q = q.filter(ClientLeaveRequest.status == status)

    records = q.order_by(ClientLeaveRequest.created_at.desc()).all()

    # Pre-fetch site names
    sites = {s.id: s.site_name for s in db.query(ClientSite).filter(ClientSite.client_id == client_id).all()}

    return {
        "leaves": [
            {
                "id": r.id,
                "client_id": r.client_id,
                "site_id": r.site_id,
                "site_name": sites.get(r.site_id, f"Site #{r.site_id}"),
                "worker_id": r.worker_id,
                "worker_name": r.worker_name,
                "role_title": r.role_title,
                "leave_type": r.leave_type,
                "start_date": r.start_date.isoformat(),
                "end_date": r.end_date.isoformat(),
                "total_days": r.total_days,
                "reason": r.reason,
                "doctor_certificate_url": r.doctor_certificate_url,
                "doctor_certificate_verified": r.doctor_certificate_verified,
                "status": r.status,
                "current_approval_step": r.current_approval_step,
                "total_approval_steps": r.total_approval_steps,
                "approval_history": r.approval_history,
                "reviewed_by": r.reviewed_by,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "reviewer_notes": r.reviewer_notes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    }


@router.post("/client/{client_id}/approvals/leaves")
def create_leave_request(
    client_id: int,
    payload: LeaveCreateIn,
    db: Session = Depends(get_db),
):
    try:
        s_date = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        e_date = datetime.strptime(payload.end_date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format (must be YYYY-MM-DD)")

    initial_status, current_step, total_steps, history, _ = initiate_global_approval(
        db=db,
        client_id=client_id,
        flow_key="m1.4_leaves",
        record_id=0,
        title=f"Leave Request: {payload.worker_name} ({payload.leave_type})",
        creator_user_id=payload.created_by_user_id,
    )

    leave = ClientLeaveRequest(
        client_id=client_id,
        site_id=payload.site_id,
        worker_id=payload.worker_id,
        worker_name=payload.worker_name,
        role_title=payload.role_title,
        leave_type=payload.leave_type,
        start_date=s_date,
        end_date=e_date,
        total_days=payload.total_days,
        reason=payload.reason,
        doctor_certificate_url=payload.doctor_certificate_url,
        doctor_certificate_verified=bool(payload.doctor_certificate_url),
        status=initial_status,
        current_approval_step=current_step,
        total_approval_steps=total_steps,
        approval_history=json.dumps(history),
        created_by_user_id=payload.created_by_user_id,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    return {"message": "Leave request submitted successfully", "id": leave.id}


@router.post("/client/approvals/leaves/{leave_id}/decision")
def decide_leave_request(
    leave_id: int,
    payload: ApprovalDecisionIn,
    db: Session = Depends(get_db),
):
    leave = db.query(ClientLeaveRequest).filter(ClientLeaveRequest.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    decision = payload.action.upper()
    if decision not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be APPROVE or REJECT")

    new_status, new_step, total_steps, updated_history, _ = execute_sequential_approval_step(
        db=db,
        client_id=leave.client_id,
        flow_key="m1.4_leaves",
        record_id=leave.id,
        current_step=getattr(leave, "current_approval_step", 1) or 1,
        total_steps=getattr(leave, "total_approval_steps", 1) or 1,
        action=decision,
        approver_user_id=payload.user_id or 1,
        approver_name=payload.user_name or "Supervisor",
        approver_role=payload.user_role or "CLIENT_ADMIN",
        notes=payload.notes,
        history_json=getattr(leave, "approval_history", None),
    )

    leave.status = new_status
    leave.current_approval_step = new_step
    leave.total_approval_steps = total_steps
    leave.approval_history = updated_history
    leave.reviewed_by = payload.user_name or "Supervisor"
    leave.reviewed_at = datetime.utcnow()
    leave.reviewer_notes = payload.notes or ("Leave request approved" if decision == "APPROVE" else "Leave request rejected")

    db.commit()
    return {"message": f"Leave request {leave.status}", "status": leave.status}


# =====================================================================
# 2. OVERTIME APPROVAL ENDPOINTS
# =====================================================================
@router.get("/client/{client_id}/approvals/overtime")
def get_overtime_requests(
    client_id: int,
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    seed_approvals_timesheets_if_needed(client_id, db)
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    q = db.query(ClientOvertimeRequest).filter(ClientOvertimeRequest.client_id == client_id)
    if allowed_ids is not None:
        q = q.filter(ClientOvertimeRequest.site_id.in_(allowed_ids))
    if status and status != "ALL":
        q = q.filter(ClientOvertimeRequest.status == status)

    records = q.order_by(ClientOvertimeRequest.created_at.desc()).all()
    sites = {s.id: s.site_name for s in db.query(ClientSite).filter(ClientSite.client_id == client_id).all()}

    return {
        "overtime_requests": [
            {
                "id": r.id,
                "client_id": r.client_id,
                "site_id": r.site_id,
                "site_name": sites.get(r.site_id, f"Site #{r.site_id}"),
                "worker_id": r.worker_id,
                "worker_name": r.worker_name,
                "role_title": r.role_title,
                "shift_date": r.shift_date.isoformat(),
                "planned_shift": r.planned_shift,
                "overtime_hours": r.overtime_hours,
                "ot_50_hours": r.ot_50_hours,
                "ot_100_hours": r.ot_100_hours,
                "tes_rule": r.tes_rule,
                "justification_reason": r.justification_reason,
                "status": r.status,
                "current_approval_step": r.current_approval_step,
                "total_approval_steps": r.total_approval_steps,
                "approval_history": r.approval_history,
                "reviewed_by": r.reviewed_by,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "reviewer_notes": r.reviewer_notes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ]
    }


@router.post("/client/{client_id}/approvals/overtime")
def create_overtime_request(
    client_id: int,
    payload: OvertimeCreateIn,
    db: Session = Depends(get_db),
):
    try:
        s_date = datetime.strptime(payload.shift_date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format (must be YYYY-MM-DD)")

    # Compute Finnish statutory 50% vs 100% split
    # First 2 daily OT hours are paid at +50%, any hours beyond 2 are paid at +100%
    ot_50 = min(2.0, max(0.0, payload.overtime_hours))
    ot_100 = max(0.0, payload.overtime_hours - 2.0)

    initial_status, current_step, total_steps, history, _ = initiate_global_approval(
        db=db,
        client_id=client_id,
        flow_key="m1.4_overtime",
        record_id=0,
        title=f"Overtime Request: {payload.worker_name} ({payload.overtime_hours}h)",
        creator_user_id=payload.created_by_user_id,
    )

    ot = ClientOvertimeRequest(
        client_id=client_id,
        site_id=payload.site_id,
        worker_id=payload.worker_id,
        worker_name=payload.worker_name,
        role_title=payload.role_title,
        shift_date=s_date,
        planned_shift=payload.planned_shift,
        overtime_hours=payload.overtime_hours,
        ot_50_hours=round(ot_50, 2),
        ot_100_hours=round(ot_100, 2),
        tes_rule="Teknologiateollisuus TES §18 - Daily Overtime (2h @ 50%, remaining @ 100%)",
        justification_reason=payload.justification_reason,
        status=initial_status,
        current_approval_step=current_step,
        total_approval_steps=total_steps,
        approval_history=json.dumps(history),
        created_by_user_id=payload.created_by_user_id,
    )
    db.add(ot)
    db.commit()
    db.refresh(ot)

    return {"message": "Overtime request submitted successfully", "id": ot.id}


@router.post("/client/approvals/overtime/{ot_id}/decision")
def decide_overtime_request(
    ot_id: int,
    payload: ApprovalDecisionIn,
    db: Session = Depends(get_db),
):
    ot = db.query(ClientOvertimeRequest).filter(ClientOvertimeRequest.id == ot_id).first()
    if not ot:
        raise HTTPException(status_code=404, detail="Overtime request not found")

    decision = payload.action.upper()
    if decision not in ["APPROVE", "REJECT"]:
        raise HTTPException(status_code=400, detail="Action must be APPROVE or REJECT")

    new_status, new_step, total_steps, updated_history, _ = execute_sequential_approval_step(
        db=db,
        client_id=ot.client_id,
        flow_key="m1.4_overtime",
        record_id=ot.id,
        current_step=getattr(ot, "current_approval_step", 1) or 1,
        total_steps=getattr(ot, "total_approval_steps", 1) or 1,
        action=decision,
        approver_user_id=payload.user_id or 1,
        approver_name=payload.user_name or "Supervisor",
        approver_role=payload.user_role or "CLIENT_ADMIN",
        notes=payload.notes,
        history_json=getattr(ot, "approval_history", None),
    )

    ot.status = new_status
    ot.current_approval_step = new_step
    ot.total_approval_steps = total_steps
    ot.approval_history = updated_history
    ot.reviewed_by = payload.user_name or "Supervisor"
    ot.reviewed_at = datetime.utcnow()
    ot.reviewer_notes = payload.notes or ("Overtime request approved" if decision == "APPROVE" else "Overtime request rejected")

    db.commit()
    return {"message": f"Overtime request {ot.status}", "status": ot.status}


# =====================================================================
# 3. BIOMETRIC TIMESHEET BATCHES & VERIFICATION
# =====================================================================
@router.get("/client/{client_id}/approvals/timesheets")
def get_timesheet_batches(
    client_id: int,
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    seed_approvals_timesheets_if_needed(client_id, db)
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    q = db.query(TimesheetBatch).filter(TimesheetBatch.client_id == client_id)
    if allowed_ids is not None:
        q = q.filter(TimesheetBatch.site_id.in_(allowed_ids))
    if status and status != "ALL":
        q = q.filter(TimesheetBatch.status == status)

    records = q.order_by(TimesheetBatch.period_start.desc()).all()
    sites = {s.id: s.site_name for s in db.query(ClientSite).filter(ClientSite.client_id == client_id).all()}

    return {
        "batches": [
            {
                "id": b.id,
                "client_id": b.client_id,
                "site_id": b.site_id,
                "site_name": sites.get(b.site_id, f"Site #{b.site_id}"),
                "batch_code": b.batch_code,
                "week_label": b.week_label,
                "period_start": b.period_start.isoformat(),
                "period_end": b.period_end.isoformat(),
                "total_workers": b.total_workers,
                "total_regular_hours": b.total_regular_hours,
                "total_overtime_hours": b.total_overtime_hours,
                "total_evening_hours": b.total_evening_hours,
                "total_night_hours": b.total_night_hours,
                "status": b.status,
                "current_approval_step": b.current_approval_step,
                "total_approval_steps": b.total_approval_steps,
                "approval_history": b.approval_history,
                "verified_by_user_id": b.verified_by_user_id,
                "verified_by_name": b.verified_by_name,
                "verified_at": b.verified_at.isoformat() if b.verified_at else None,
                "verification_notes": b.verification_notes,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in records
        ]
    }


@router.get("/client/approvals/timesheets/{batch_id}/details")
def get_timesheet_batch_details(
    batch_id: int,
    db: Session = Depends(get_db),
):
    batch = db.query(TimesheetBatch).filter(TimesheetBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Timesheet batch not found")

    site = db.query(ClientSite).filter(ClientSite.id == batch.site_id).first()

    # Fetch active workers at this plant site
    workers = (
        db.query(WorkerDeployment)
        .filter(WorkerDeployment.client_id == batch.client_id, WorkerDeployment.site_id == batch.site_id)
        .all()
    )

    # Detailed punch breakdown for each worker across Mon..Sun
    worker_rows = []
    for w in workers:
        worker_rows.append({
            "worker_id": w.worker_id,
            "worker_name": w.worker_name,
            "role_title": w.role_title,
            "tes_category": w.tes_category,
            "regular_hours": 37.5,
            "overtime_50_hours": 2.0 if w.worker_id % 3 == 0 else 0.0,
            "overtime_100_hours": 1.5 if w.worker_id % 4 == 0 else 0.0,
            "evening_hours": 6.0 if w.worker_id % 2 == 0 else 0.0,
            "night_hours": 2.5 if w.worker_id % 5 == 0 else 0.0,
            "status": "VERIFIED_ATTENDANCE",
            "daily_punches": [
                {"day": "Mon", "clock_in": "06:01", "clock_out": "14:32", "hours": 7.5, "status": "PRESENT"},
                {"day": "Tue", "clock_in": "05:58", "clock_out": "14:30", "hours": 7.5, "status": "PRESENT"},
                {"day": "Wed", "clock_in": "06:05", "clock_out": "16:35", "hours": 9.5, "status": "OVERTIME"},
                {"day": "Thu", "clock_in": "06:00", "clock_out": "14:31", "hours": 7.5, "status": "PRESENT"},
                {"day": "Fri", "clock_in": "05:55", "clock_out": "14:30", "hours": 7.5, "status": "PRESENT"},
                {"day": "Sat", "clock_in": None, "clock_out": None, "hours": 0.0, "status": "OFF"},
                {"day": "Sun", "clock_in": None, "clock_out": None, "hours": 0.0, "status": "OFF"},
            ]
        })

    return {
        "batch": {
            "id": batch.id,
            "batch_code": batch.batch_code,
            "site_name": site.site_name if site else "Plant Site",
            "week_label": batch.week_label,
            "period_start": batch.period_start.isoformat(),
            "period_end": batch.period_end.isoformat(),
            "total_workers": len(worker_rows),
            "status": batch.status,
            "verified_by": batch.verified_by_name,
            "verified_at": batch.verified_at.isoformat() if batch.verified_at else None,
            "verification_notes": batch.verification_notes,
        },
        "worker_timesheets": worker_rows,
    }


@router.post("/client/approvals/timesheets/{batch_id}/verify")
def verify_timesheet_batch(
    batch_id: int,
    payload: TimesheetVerifyIn,
    db: Session = Depends(get_db),
):
    batch = db.query(TimesheetBatch).filter(TimesheetBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Timesheet batch not found")

    batch.status = "VERIFIED_BY_CLIENT"
    batch.verified_by_user_id = payload.user_id
    batch.verified_by_name = payload.user_name or "Client Admin (Site HR)"
    batch.verified_at = datetime.utcnow()
    batch.verification_notes = payload.notes or "All electronic plant gate punches reconciled and verified by client site supervisor."

    # Notify agency & client channels
    notif = ClientNotification(
        client_id=batch.client_id,
        user_id=payload.user_id or 1,
        title=f"Timesheet Batch {batch.batch_code} Verified",
        message=f"Plant gate electronic punches for {batch.week_label} were signed off by {batch.verified_by_name}. Transmitted to Agency Accounts for invoicing.",
        notification_type="TIMESHEET_VERIFIED",
        target_module="m1.4_timesheets",
        reference_id=batch.id,
    )
    db.add(notif)
    db.commit()

    return {
        "message": "Timesheet batch verified and approved successfully",
        "batch_code": batch.batch_code,
        "status": batch.status,
    }
