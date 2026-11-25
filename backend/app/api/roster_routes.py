from datetime import datetime, date, timedelta
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.site_access import get_allowed_site_ids_for_user, assert_user_can_access_site
from app.core.approval_engine import (
    initiate_global_approval,
    notify_level_1_on_create,
    execute_sequential_approval_step,
    get_approval_step_metadata,
    get_active_flow_levels,
)
from app.models.client import (
    ClientSite,
    ClientMasterData,
    WorkerDeployment,
    TimesheetShiftRecord,
)
from app.models.roster import ShiftRosterPlan, ShiftAllocationEntry, ShiftChangeRequest, WorkerDailyShift

router = APIRouter(prefix="/api/client", tags=["Shift Planning & Rosters"])

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def infer_shift_hours(shift_label: str) -> float:
    s = (shift_label or "OFF").strip().upper()
    if s in ("OFF", "", "REST", "NONE"):
        return 0.0
    if "NIGHT" in s or "YÖ" in s or "22:30" in s:
        return 8.0
    if "12" in s or "07:00–19:00" in s:
        return 11.5
    return 7.5


def infer_shift_type(shift_label: str) -> str:
    s = (shift_label or "OFF").strip().upper()
    if s in ("OFF", "", "REST"):
        return "OFF"
    if "NIGHT" in s or "YÖ" in s:
        return "NIGHT"
    if "EVENING" in s or "ILTA" in s:
        return "EVENING"
    if "MORNING" in s or "AAMU" in s:
        return "MORNING"
    return "DAY"


def check_tyoaikalaki_warnings(days_list: List[str], weekly_hours: float) -> List[str]:
    """
    Finnish Working Hours Act (Työaikalaki) checks:
    - Minimum 11h daily rest between consecutive shifts (flags Night -> Morning/Day or Evening -> Morning)
    - Standard regular weekly ceiling 40h (flags OT)
    """
    warnings = []
    types = [infer_shift_type(d) for d in days_list]
    for i in range(len(types) - 1):
        prev_t, next_t = types[i], types[i + 1]
        if prev_t == "NIGHT" and next_t in ("MORNING", "DAY"):
            warnings.append(f"<11h rest ({DAY_KEYS[i].title()} Night → {DAY_KEYS[i+1].title()} {next_t.title()})")
        elif prev_t == "EVENING" and next_t == "MORNING":
            warnings.append(f"<11h rest ({DAY_KEYS[i].title()} Evening → {DAY_KEYS[i+1].title()} Morning)")
    if weekly_hours > 40.0:
        warnings.append(f"Overtime ({weekly_hours}h > 40h)")
    return warnings


def compute_weekly_hours(mon: str, tue: str, wed: str, thu: str, fri: str, sat: str, sun: str) -> float:
    return round(sum(infer_shift_hours(c) for c in (mon, tue, wed, thu, fri, sat, sun)), 1)


def get_week_dates(start_dt: Optional[date]) -> List[dict]:
    base = start_dt or (date.today() - timedelta(days=date.today().weekday()))
    result = []
    for i, key in enumerate(DAY_KEYS):
        d = base + timedelta(days=i)
        result.append({
            "key": key,
            "label": d.strftime("%a %d %b"),
            "iso": d.isoformat(),
            "is_weekend": i >= 5,
        })
    return result


def serialize_roster(r: ShiftRosterPlan, db: Session):
    site = db.query(ClientSite).filter(ClientSite.id == r.site_id).first()
    allocs = (
        db.query(ShiftAllocationEntry)
        .filter(ShiftAllocationEntry.roster_id == r.id)
        .order_by(ShiftAllocationEntry.id.asc())
        .all()
    )
    serialized_allocs = []
    for a in allocs:
        days_vals = [a.mon, a.tue, a.wed, a.thu, a.fri, a.sat, a.sun]
        warnings = check_tyoaikalaki_warnings(days_vals, a.weekly_hours)
        serialized_allocs.append({
            "id": a.id,
            "roster_id": a.roster_id,
            "worker_id": a.worker_id,
            "worker_name": a.worker_name,
            "role_title": a.role_title,
            "tes_category": a.tes_category,
            "mon": a.mon,
            "tue": a.tue,
            "wed": a.wed,
            "thu": a.thu,
            "fri": a.fri,
            "sat": a.sat,
            "sun": a.sun,
            "weekly_hours": a.weekly_hours,
            "warnings": warnings,
        })

    is_pending = r.status == "PENDING_INTERNAL_APPROVAL"
    step_meta = get_approval_step_metadata(
        db=db,
        client_id=r.client_id,
        flow_key="m1.3_builder",
        current_step=getattr(r, "current_approval_step", 1) or 1,
        total_steps=getattr(r, "total_approval_steps", 1) or 1,
        is_pending=is_pending,
    )

    return {
        "id": r.id,
        "client_id": r.client_id,
        "site_id": r.site_id,
        "site_code": site.site_code if site else "TMP-01",
        "site_name": site.site_name if site else "Main Plant",
        "roster_code": r.roster_code,
        "start_date": r.start_date.isoformat() if r.start_date else None,
        "week_dates": get_week_dates(r.start_date),
        "week_label": r.week_label,
        "department_line": r.department_line,
        "status": r.status,
        "current_approval_step": step_meta["current_approval_step"],
        "total_approval_steps": step_meta["total_approval_steps"],
        "current_approver_id": step_meta["current_approver_id"],
        "current_approver_name": step_meta["current_approver_name"],
        "total_planned_hours": round(sum(a.weekly_hours for a in allocs), 1),
        "workers_count": len(allocs),
        "created_by": r.created_by,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "published_at": r.published_at.isoformat() if r.published_at else None,
        "allocations": serialized_allocs,
    }


def serialize_shift_change(req: ShiftChangeRequest, db: Session):
    site = db.query(ClientSite).filter(ClientSite.id == req.site_id).first()
    is_pending = req.status in ("PENDING", "PENDING_INTERNAL_APPROVAL")
    step_meta = get_approval_step_metadata(
        db=db,
        client_id=req.client_id,
        flow_key="m1.3_changes",
        current_step=getattr(req, "current_approval_step", 1) or 1,
        total_steps=getattr(req, "total_approval_steps", 1) or 1,
        is_pending=is_pending,
    )
    return {
        "id": req.id,
        "client_id": req.client_id,
        "site_id": req.site_id,
        "site_code": site.site_code if site else "TMP-01",
        "roster_id": req.roster_id,
        "worker_id": req.worker_id,
        "worker_name": req.worker_name,
        "role_title": req.role_title,
        "shift_date": req.shift_date.isoformat() if req.shift_date else None,
        "day_of_week": req.day_of_week,
        "current_shift": req.current_shift,
        "requested_shift": req.requested_shift,
        "reason": req.reason,
        "status": req.status,
        "current_approval_step": step_meta["current_approval_step"],
        "total_approval_steps": step_meta["total_approval_steps"],
        "current_approver_id": step_meta["current_approver_id"],
        "current_approver_name": step_meta["current_approver_name"],
        "attendance_sync_status": req.attendance_sync_status,
        "fallback_resolution": req.fallback_resolution,
        "reviewed_by": req.reviewed_by,
        "reviewed_at": req.reviewed_at.isoformat() if req.reviewed_at else None,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


def ensure_default_rosters(client_id: int, db: Session):
    existing = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.client_id == client_id).count()
    if existing > 0:
        return

    sites = db.query(ClientSite).filter(ClientSite.client_id == client_id, ClientSite.is_active == True).all()
    site_tmp = sites[0] if len(sites) > 0 else None
    site_jyk = sites[1] if len(sites) > 1 else site_tmp
    if not site_tmp:
        return

    deployments = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id).all()
    tmp_workers = [w for w in deployments if w.site_id == site_tmp.id]
    jyk_workers = [w for w in deployments if site_jyk and w.site_id == site_jyk.id]

    this_monday = date.today() - timedelta(days=date.today().weekday())
    prev_monday = this_monday - timedelta(days=7)

    # Roster 1: Active Draft for Current Week (Tampere)
    r1 = ShiftRosterPlan(
        client_id=client_id,
        site_id=site_tmp.id,
        roster_code=f"RST-{this_monday.year}-W{this_monday.isocalendar()[1]}-TMP",
        start_date=this_monday,
        week_label=f"Week {this_monday.isocalendar()[1]} ({this_monday.strftime('%d %b')} – {(this_monday + timedelta(days=6)).strftime('%d %b %Y')})",
        department_line="CNC Machining & Assembly Line A",
        status="DRAFT",
        created_by="Client Admin",
    )
    db.add(r1)
    db.flush()

    m_shift = "Morning Shift (Aamuvuoro)"
    e_shift = "Evening Shift (Iltavuoro)"
    d_shift = "Day Shift (Päivävuoro)"
    n_shift = "Night Shift (Yövuoro)"

    patterns = [
        (m_shift, m_shift, m_shift, m_shift, m_shift, "OFF", "OFF"),
        (e_shift, e_shift, e_shift, e_shift, e_shift, "OFF", "OFF"),
        (d_shift, d_shift, d_shift, d_shift, d_shift, "OFF", "OFF"),
        (m_shift, m_shift, m_shift, e_shift, e_shift, "OFF", "OFF"),
        (n_shift, n_shift, n_shift, n_shift, "OFF", "OFF", "OFF"),
    ]
    for idx, w in enumerate(tmp_workers[:5]):
        p = patterns[idx % len(patterns)]
        hrs = compute_weekly_hours(*p)
        db.add(
            ShiftAllocationEntry(
                roster_id=r1.id,
                worker_id=w.worker_id,
                worker_name=w.worker_name,
                role_title=w.role_title,
                tes_category=w.tes_category,
                mon=p[0], tue=p[1], wed=p[2], thu=p[3], fri=p[4], sat=p[5], sun=p[6],
                weekly_hours=hrs,
            )
        )

    # Roster 2: Published Roster for Previous Week (Tampere)
    r2 = ShiftRosterPlan(
        client_id=client_id,
        site_id=site_tmp.id,
        roster_code=f"RST-{prev_monday.year}-W{prev_monday.isocalendar()[1]}-TMP",
        start_date=prev_monday,
        week_label=f"Week {prev_monday.isocalendar()[1]} ({prev_monday.strftime('%d %b')} – {(prev_monday + timedelta(days=6)).strftime('%d %b %Y')})",
        department_line="CNC Machining & Assembly Line A",
        status="PUBLISHED",
        created_by="Client Admin",
        published_at=datetime.utcnow(),
    )
    db.add(r2)
    db.flush()
    for idx, w in enumerate(tmp_workers[:4]):
        p = patterns[idx % len(patterns)]
        hrs = compute_weekly_hours(*p)
        db.add(
            ShiftAllocationEntry(
                roster_id=r2.id,
                worker_id=w.worker_id,
                worker_name=w.worker_name,
                role_title=w.role_title,
                tes_category=w.tes_category,
                mon=p[0], tue=p[1], wed=p[2], thu=p[3], fri=p[4], sat=p[5], sun=p[6],
                weekly_hours=hrs,
            )
        )

    # Seed 2 realistic pending Shift Change Requests linked to r1
    if len(tmp_workers) >= 2:
        w1 = tmp_workers[0]
        w2 = tmp_workers[1]
        db.add(
            ShiftChangeRequest(
                client_id=client_id,
                site_id=site_tmp.id,
                roster_id=r1.id,
                worker_id=w1.worker_id,
                worker_name=w1.worker_name,
                role_title=w1.role_title,
                shift_date=this_monday + timedelta(days=3),  # Thursday
                day_of_week="thu",
                current_shift=m_shift,
                requested_shift=e_shift,
                reason="Morning medical appointment at Tampere Occupational Health; available for full Evening shift.",
                status="PENDING",
                attendance_sync_status="PENDING",
            )
        )
        db.add(
            ShiftChangeRequest(
                client_id=client_id,
                site_id=site_tmp.id,
                roster_id=r1.id,
                worker_id=w2.worker_id,
                worker_name=w2.worker_name,
                role_title=w2.role_title,
                shift_date=this_monday + timedelta(days=4),  # Friday
                day_of_week="fri",
                current_shift=e_shift,
                requested_shift=m_shift,
                reason="Swapping Friday shift with colleague for family travel.",
                status="PENDING",
                attendance_sync_status="PENDING",
            )
        )

    db.commit()


# ---------------- SCHEMAS ----------------
class CreateRosterRequest(BaseModel):
    site_id: int
    start_date: str  # YYYY-MM-DD (Monday)
    department_line: str
    default_shift: str = "Day Shift (Päivävuoro)"
    copy_from_roster_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    created_by: str = "Client Admin"


class AddWorkerToRosterRequest(BaseModel):
    worker_id: int
    default_shift: str = "Day Shift (Päivävuoro)"


class BulkAssignRequest(BaseModel):
    shift_label: str
    days: List[str] = ["mon", "tue", "wed", "thu", "fri"]


class UpdateAllocationRequest(BaseModel):
    mon: Optional[str] = None
    tue: Optional[str] = None
    wed: Optional[str] = None
    thu: Optional[str] = None
    fri: Optional[str] = None
    sat: Optional[str] = None
    sun: Optional[str] = None


class SubmitRosterRequest(BaseModel):
    target_status: str = "SUBMITTED_TO_AGENCY"
    user_id: Optional[int] = None
    user_name: Optional[str] = "Client Admin"


class ShiftChangeCreateRequest(BaseModel):
    site_id: int
    roster_id: Optional[int] = None
    worker_id: int
    shift_date: str  # YYYY-MM-DD
    current_shift: str
    requested_shift: str
    reason: str
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = "Site Supervisor"


class ShiftChangeDecisionRequest(BaseModel):
    decision: str  # APPROVE, REJECT, RESOLVE_ABSENT, RESOLVE_OVERTIME, RETRY_SYNC
    reviewed_by: str = "Client Admin"
    approver_user_id: Optional[int] = None
    approver_role: Optional[str] = "SITE_MANAGER"


# ---------------- ROSTER ENDPOINTS ----------------
@router.get("/{client_id}/rosters")
def list_rosters(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    ensure_default_rosters(client_id, db)
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    query = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.client_id == client_id)
    if allowed_ids is not None:
        query = query.filter(ShiftRosterPlan.site_id.in_(allowed_ids))
    rosters = query.order_by(ShiftRosterPlan.id.desc()).all()

    # Also return available deployed workers for Add Worker modal
    w_query = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id)
    if allowed_ids is not None:
        w_query = w_query.filter(WorkerDeployment.site_id.in_(allowed_ids))
    deployed = [
        {
            "worker_id": w.worker_id,
            "worker_name": w.worker_name,
            "site_id": w.site_id,
            "role_title": w.role_title,
            "tes_category": w.tes_category,
        }
        for w in w_query.all()
    ]

    # Return Shift Master templates for dropdowns
    shift_items = (
        db.query(ClientMasterData)
        .filter(
            ClientMasterData.client_id == client_id,
            ClientMasterData.category == "client_shift_templates",
        )
        .order_by(ClientMasterData.id.asc())
        .all()
    )
    shift_options = []
    for it in shift_items:
        parts = [p.strip() for p in it.item_value.split("|")]
        shift_options.append({
            "name": parts[0],
            "window": parts[1] if len(parts) > 1 else "07:00–15:30",
            "weekly": parts[2] if len(parts) > 2 else "37.5h/wk",
            "tes": parts[3] if len(parts) > 3 else "Standard TES",
        })
    if not shift_options:
        shift_options = [
            {"name": "Day Shift (Päivävuoro)", "window": "07:00–15:30", "weekly": "37.5h/wk", "tes": "Standard TES"},
            {"name": "Morning Shift (Aamuvuoro)", "window": "06:00–14:30", "weekly": "37.5h/wk", "tes": "2-Shift Cycle"},
            {"name": "Evening Shift (Iltavuoro)", "window": "14:30–23:00", "weekly": "37.5h/wk", "tes": "+Iltavuorolisä"},
            {"name": "Night Shift (Yövuoro)", "window": "22:30–07:00", "weekly": "37.5h/wk", "tes": "+Yövuorolisä"},
        ]

    return {
        "client_id": client_id,
        "rosters": [serialize_roster(r, db) for r in rosters],
        "deployed_workers": deployed,
        "shift_master_options": shift_options,
    }


@router.post("/{client_id}/rosters")
def create_roster(
    client_id: int,
    payload: CreateRosterRequest,
    db: Session = Depends(get_db),
):
    assert_user_can_access_site(db, client_id, payload.created_by_user_id, payload.site_id)
    site = db.query(ClientSite).filter(ClientSite.id == payload.site_id).first()
    site_code = site.site_code if site else "SITE"
    try:
        parsed_date = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
        # Snap to Monday of that week
        monday = parsed_date - timedelta(days=parsed_date.weekday())
    except Exception:
        monday = date.today() - timedelta(days=date.today().weekday())

    count = db.query(ShiftRosterPlan).count() + 1
    week_num = monday.isocalendar()[1]
    roster_code = f"RST-{monday.year}-W{week_num}-{site_code.split('-')[0]}-{count:02d}"
    week_label = f"Week {week_num} ({monday.strftime('%d %b')} – {(monday + timedelta(days=6)).strftime('%d %b %Y')})"

    new_roster = ShiftRosterPlan(
        client_id=client_id,
        site_id=payload.site_id,
        roster_code=roster_code,
        start_date=monday,
        week_label=week_label,
        department_line=payload.department_line.strip(),
        status="DRAFT",
        created_by=payload.created_by,
    )
    db.add(new_roster)
    db.flush()

    if payload.copy_from_roster_id:
        source_allocs = (
            db.query(ShiftAllocationEntry)
            .filter(ShiftAllocationEntry.roster_id == payload.copy_from_roster_id)
            .all()
        )
        for sa in source_allocs:
            db.add(
                ShiftAllocationEntry(
                    roster_id=new_roster.id,
                    worker_id=sa.worker_id,
                    worker_name=sa.worker_name,
                    role_title=sa.role_title,
                    tes_category=sa.tes_category,
                    mon=sa.mon, tue=sa.tue, wed=sa.wed, thu=sa.thu, fri=sa.fri, sat=sa.sat, sun=sa.sun,
                    weekly_hours=sa.weekly_hours,
                )
            )
    else:
        workers = (
            db.query(WorkerDeployment)
            .filter(
                WorkerDeployment.client_id == client_id,
                WorkerDeployment.site_id == payload.site_id,
            )
            .all()
        )
        sh = payload.default_shift.strip() or "Day Shift (Päivävuoro)"
        hrs = compute_weekly_hours(sh, sh, sh, sh, sh, "OFF", "OFF")
        for w in workers:
            db.add(
                ShiftAllocationEntry(
                    roster_id=new_roster.id,
                    worker_id=w.worker_id,
                    worker_name=w.worker_name,
                    role_title=w.role_title,
                    tes_category=w.tes_category,
                    mon=sh, tue=sh, wed=sh, thu=sh, fri=sh, sat="OFF", sun="OFF",
                    weekly_hours=hrs,
                )
            )

    db.commit()
    db.refresh(new_roster)
    return serialize_roster(new_roster, db)


@router.post("/rosters/{roster_id}/workers")
def add_worker_to_roster(
    roster_id: int,
    payload: AddWorkerToRosterRequest,
    db: Session = Depends(get_db),
):
    roster = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")

    exists = (
        db.query(ShiftAllocationEntry)
        .filter(ShiftAllocationEntry.roster_id == roster_id, ShiftAllocationEntry.worker_id == payload.worker_id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=400, detail="Worker is already assigned to this roster.")

    dep = db.query(WorkerDeployment).filter(WorkerDeployment.worker_id == payload.worker_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployed worker not found")

    sh = payload.default_shift.strip() or "Day Shift (Päivävuoro)"
    hrs = compute_weekly_hours(sh, sh, sh, sh, sh, "OFF", "OFF")
    db.add(
        ShiftAllocationEntry(
            roster_id=roster_id,
            worker_id=dep.worker_id,
            worker_name=dep.worker_name,
            role_title=dep.role_title,
            tes_category=dep.tes_category,
            mon=sh, tue=sh, wed=sh, thu=sh, fri=sh, sat="OFF", sun="OFF",
            weekly_hours=hrs,
        )
    )
    db.commit()
    return serialize_roster(roster, db)


@router.delete("/rosters/{roster_id}/allocations/{alloc_id}")
def remove_worker_from_roster(roster_id: int, alloc_id: int, db: Session = Depends(get_db)):
    alloc = (
        db.query(ShiftAllocationEntry)
        .filter(ShiftAllocationEntry.id == alloc_id, ShiftAllocationEntry.roster_id == roster_id)
        .first()
    )
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    db.delete(alloc)
    db.commit()
    roster = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.id == roster_id).first()
    return serialize_roster(roster, db)


@router.delete("/rosters/{roster_id}")
def delete_roster(roster_id: int, db: Session = Depends(get_db)):
    roster = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")
    db.query(ShiftAllocationEntry).filter(ShiftAllocationEntry.roster_id == roster_id).delete()
    db.delete(roster)
    db.commit()
    return {"status": "DELETED", "roster_id": roster_id}


@router.post("/rosters/{roster_id}/bulk-assign")
def bulk_assign_shift(roster_id: int, payload: BulkAssignRequest, db: Session = Depends(get_db)):
    roster = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster not found")
    allocs = db.query(ShiftAllocationEntry).filter(ShiftAllocationEntry.roster_id == roster_id).all()
    for a in allocs:
        for d in payload.days:
            if d in DAY_KEYS:
                setattr(a, d, payload.shift_label.strip())
        a.weekly_hours = compute_weekly_hours(a.mon, a.tue, a.wed, a.thu, a.fri, a.sat, a.sun)
    db.commit()
    return serialize_roster(roster, db)


@router.patch("/rosters/{roster_id}/allocations/{alloc_id}")
def update_allocation(
    roster_id: int,
    alloc_id: int,
    payload: UpdateAllocationRequest,
    db: Session = Depends(get_db),
):
    alloc = (
        db.query(ShiftAllocationEntry)
        .filter(ShiftAllocationEntry.id == alloc_id, ShiftAllocationEntry.roster_id == roster_id)
        .first()
    )
    if not alloc:
        raise HTTPException(status_code=404, detail="Shift allocation not found")

    for day in DAY_KEYS:
        val = getattr(payload, day)
        if val is not None:
            setattr(alloc, day, val.strip())

    alloc.weekly_hours = compute_weekly_hours(
        alloc.mon, alloc.tue, alloc.wed, alloc.thu, alloc.fri, alloc.sat, alloc.sun
    )
    db.commit()
    db.refresh(alloc)

    roster = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.id == roster_id).first()
    return serialize_roster(roster, db)


@router.post("/rosters/{roster_id}/submit")
def submit_or_publish_roster(
    roster_id: int,
    payload: SubmitRosterRequest,
    db: Session = Depends(get_db),
):
    roster = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster plan not found")

    if payload.user_id:
        assert_user_can_access_site(db, roster.client_id, payload.user_id, roster.site_id)

    target = payload.target_status.strip().upper()
    if target not in ("DRAFT", "SUBMITTED_TO_AGENCY", "PUBLISHED"):
        raise HTTPException(status_code=400, detail="Invalid roster status")

    if target in ("SUBMITTED_TO_AGENCY", "PUBLISHED") and roster.status == "DRAFT":
        import json as _json
        init_status, cur_step, tot_steps, hist, levels = initiate_global_approval(
            db=db,
            client_id=roster.client_id,
            flow_key="m1.3_builder",
            released_status=target,
            initiator_user_id=payload.user_id,
            initiator_name=payload.user_name or "Client Admin",
        )
        roster.status = init_status
        roster.current_approval_step = cur_step
        roster.total_approval_steps = tot_steps
        roster.approval_history = _json.dumps(hist)
        if payload.user_id:
            roster.created_by_user_id = payload.user_id
        if init_status == "PUBLISHED":
            roster.published_at = datetime.utcnow()
        notify_level_1_on_create(
            db=db,
            client_id=roster.client_id,
            flow_key="m1.3_builder",
            levels=levels,
            reference_id=roster.id,
            reference_code=roster.roster_code,
        )
    else:
        roster.status = target
        if target == "PUBLISHED":
            roster.published_at = datetime.utcnow()

    db.commit()
    db.refresh(roster)
    return serialize_roster(roster, db)


@router.post("/rosters/{roster_id}/approval-decision")
def approve_roster_step(
    roster_id: int,
    payload: ShiftChangeDecisionRequest,
    db: Session = Depends(get_db),
):
    roster = db.query(ShiftRosterPlan).filter(ShiftRosterPlan.id == roster_id).first()
    if not roster:
        raise HTTPException(status_code=404, detail="Roster plan not found")

    if payload.approver_user_id:
        assert_user_can_access_site(db, roster.client_id, payload.approver_user_id, roster.site_id)

    new_status, new_step, tot_steps, updated_hist, _ = execute_sequential_approval_step(
        db=db,
        client_id=roster.client_id,
        flow_key="m1.3_builder",
        current_status=roster.status,
        current_step=getattr(roster, "current_approval_step", 1) or 1,
        total_steps=getattr(roster, "total_approval_steps", 1) or 1,
        history_json=getattr(roster, "approval_history", None),
        decision=payload.decision,
        acting_user_id=payload.approver_user_id,
        acting_user_name=payload.reviewed_by or "Approver",
        acting_user_role=payload.approver_role or "SITE_MANAGER",
        notes=None,
        reference_id=roster.id,
        reference_code=roster.roster_code,
        initiator_user_id=getattr(roster, "created_by_user_id", None),
        released_status="SUBMITTED_TO_AGENCY",
        rejected_status="DRAFT",
    )
    roster.status = new_status
    roster.current_approval_step = new_step
    roster.total_approval_steps = tot_steps
    roster.approval_history = updated_hist
    db.commit()
    db.refresh(roster)
    return serialize_roster(roster, db)


# ---------------- SHIFT CHANGE REQUESTS + ATOMIC ATTENDANCE SYNC ----------------
@router.get("/{client_id}/shift-change-requests")
def list_shift_change_requests(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    ensure_default_rosters(client_id, db)
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)
    q = db.query(ShiftChangeRequest).filter(ShiftChangeRequest.client_id == client_id)
    if allowed_ids is not None:
        q = q.filter(ShiftChangeRequest.site_id.in_(allowed_ids))
    items = q.order_by(ShiftChangeRequest.id.desc()).all()
    return {"client_id": client_id, "requests": [serialize_shift_change(i, db) for i in items]}


@router.post("/{client_id}/shift-change-requests")
def create_shift_change_request(
    client_id: int,
    payload: ShiftChangeCreateRequest,
    db: Session = Depends(get_db),
):
    assert_user_can_access_site(db, client_id, payload.created_by_user_id, payload.site_id)
    dep = db.query(WorkerDeployment).filter(WorkerDeployment.worker_id == payload.worker_id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Worker not found")

    try:
        s_date = datetime.strptime(payload.shift_date, "%Y-%m-%d").date()
    except Exception:
        s_date = date.today()
    day_key = DAY_KEYS[s_date.weekday()]

    levels = get_active_flow_levels(db, client_id, "m1.3_changes")
    if levels:
        init_status, cur_step, tot_steps, hist, _ = initiate_global_approval(
            db=db,
            client_id=client_id,
            flow_key="m1.3_changes",
            released_status="PENDING",
            initiator_user_id=payload.created_by_user_id,
            initiator_name=payload.created_by_name or "Site Supervisor",
        )
    else:
        init_status, cur_step, tot_steps, hist = "PENDING", 1, 1, []

    import json as _json

    req = ShiftChangeRequest(
        client_id=client_id,
        site_id=payload.site_id,
        roster_id=payload.roster_id,
        worker_id=dep.worker_id,
        worker_name=dep.worker_name,
        role_title=dep.role_title,
        shift_date=s_date,
        day_of_week=day_key,
        current_shift=payload.current_shift.strip(),
        requested_shift=payload.requested_shift.strip(),
        reason=payload.reason.strip(),
        status=init_status,
        current_approval_step=cur_step,
        total_approval_steps=tot_steps,
        approval_history=_json.dumps(hist),
        created_by_user_id=payload.created_by_user_id,
        attendance_sync_status="PENDING",
    )
    db.add(req)
    db.flush()

    if levels:
        notify_level_1_on_create(
            db=db,
            client_id=client_id,
            flow_key="m1.3_changes",
            levels=levels,
            reference_id=req.id,
            reference_code=dep.worker_name,
        )

    db.commit()
    db.refresh(req)
    return serialize_shift_change(req, db)


@router.post("/shift-change-requests/{req_id}/decision")
def decide_shift_change_request(
    req_id: int,
    payload: ShiftChangeDecisionRequest,
    db: Session = Depends(get_db),
):
    req = db.query(ShiftChangeRequest).filter(ShiftChangeRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Shift change request not found")

    if payload.approver_user_id:
        assert_user_can_access_site(db, req.client_id, payload.approver_user_id, req.site_id)

    action = payload.decision.strip().upper()
    levels = get_active_flow_levels(db, req.client_id, "m1.3_changes")

    # If active Master Approval Flow exists for m1.3_changes and action is APPROVE / REJECT,
    # run strict sequential multi-level approval before executing roster/attendance sync!
    if levels and action in ("APPROVE", "REJECT") and req.status in ("PENDING", "PENDING_INTERNAL_APPROVAL"):
        new_status, new_step, tot_steps, updated_hist, is_released = execute_sequential_approval_step(
            db=db,
            client_id=req.client_id,
            flow_key="m1.3_changes",
            current_status="PENDING_INTERNAL_APPROVAL",
            current_step=getattr(req, "current_approval_step", 1) or 1,
            total_steps=getattr(req, "total_approval_steps", len(levels)) or len(levels),
            history_json=getattr(req, "approval_history", None),
            decision=action,
            acting_user_id=payload.approver_user_id,
            acting_user_name=payload.reviewed_by or "Approver",
            acting_user_role=payload.approver_role or "SITE_MANAGER",
            notes=None,
            reference_id=req.id,
            reference_code=req.worker_name,
            initiator_user_id=getattr(req, "created_by_user_id", None),
            released_status="APPROVED",
            rejected_status="REJECTED",
        )
        req.current_approval_step = new_step
        req.total_approval_steps = tot_steps
        req.approval_history = updated_hist
        if action == "APPROVE" and not is_released:
            req.status = "PENDING_INTERNAL_APPROVAL"
            req.reviewed_by = payload.reviewed_by
            req.reviewed_at = datetime.utcnow()
            db.commit()
            db.refresh(req)
            return serialize_shift_change(req, db)
        elif action == "REJECT":
            req.status = "REJECTED"
            req.reviewed_by = payload.reviewed_by
            req.reviewed_at = datetime.utcnow()
            db.commit()
            db.refresh(req)
            return serialize_shift_change(req, db)

    req.reviewed_by = payload.reviewed_by
    req.reviewed_at = datetime.utcnow()

    if action in ("APPROVE", "RETRY_SYNC"):
        req.status = "APPROVED"
        req.fallback_resolution = "NONE"

        # 1. Update Roster Allocation if linked
        if req.roster_id and req.day_of_week in DAY_KEYS:
            alloc = (
                db.query(ShiftAllocationEntry)
                .filter(
                    ShiftAllocationEntry.roster_id == req.roster_id,
                    ShiftAllocationEntry.worker_id == req.worker_id,
                )
                .first()
            )
            if alloc:
                setattr(alloc, req.day_of_week, req.requested_shift)
                alloc.weekly_hours = compute_weekly_hours(
                    alloc.mon, alloc.tue, alloc.wed, alloc.thu, alloc.fri, alloc.sat, alloc.sun
                )

        # 1b. Update WorkerDailyShift (Monthly Calendar record) if present
        daily = (
            db.query(WorkerDailyShift)
            .filter(
                WorkerDailyShift.client_id == req.client_id,
                WorkerDailyShift.worker_id == req.worker_id,
                WorkerDailyShift.shift_date == req.shift_date,
            )
            .first()
        )
        is_off = req.requested_shift.strip().upper() in ("OFF", "WEEKLY OFF", "REST")
        if daily:
            daily.shift_name = "Weekly Off" if is_off else req.requested_shift
            daily.is_weekly_off = is_off
            daily.planned_hours = 0.0 if is_off else infer_shift_hours(req.requested_shift)
            daily.updated_at = datetime.utcnow()

        # 2. Atomically sync to ERP Attendance Register (TimesheetShiftRecord)
        try:
            att = (
                db.query(TimesheetShiftRecord)
                .filter(
                    TimesheetShiftRecord.worker_id == req.worker_id,
                    TimesheetShiftRecord.shift_date == req.shift_date,
                )
                .first()
            )
            expected_hrs = infer_shift_hours(req.requested_shift)
            if att:
                att.regular_hours = expected_hrs
                att.supervisor_override_reason = f"Approved Shift Change: {req.current_shift} → {req.requested_shift}"
                att.supervisor_override_by = payload.reviewed_by
            else:
                db.add(
                    TimesheetShiftRecord(
                        worker_id=req.worker_id,
                        worker_name=req.worker_name,
                        client_id=req.client_id,
                        site_id=req.site_id,
                        shift_date=req.shift_date,
                        regular_hours=expected_hrs,
                        status="PENDING_APPROVAL",
                        supervisor_override_reason=f"Approved Shift Change: {req.current_shift} → {req.requested_shift}",
                        supervisor_override_by=payload.reviewed_by,
                    )
                )
            req.attendance_sync_status = "SYNCED"
        except Exception:
            req.attendance_sync_status = "SYNC_FAILED"

    elif action == "REJECT":
        req.status = "REJECTED"
        req.attendance_sync_status = "PENDING"

    elif action == "RESOLVE_ABSENT":
        req.fallback_resolution = "MARKED_ABSENT"
        req.attendance_sync_status = "SYNCED"
        att = (
            db.query(TimesheetShiftRecord)
            .filter(
                TimesheetShiftRecord.worker_id == req.worker_id,
                TimesheetShiftRecord.shift_date == req.shift_date,
            )
            .first()
        )
        if att:
            att.regular_hours = 0.0
            att.status = "ABSENT"
            att.supervisor_override_reason = "Unapproved / Unsynced Shift Change — Marked Absent"
            att.supervisor_override_by = payload.reviewed_by

    elif action == "RESOLVE_OVERTIME":
        req.fallback_resolution = "TREATED_AS_OVERTIME"
        req.attendance_sync_status = "SYNCED"
        att = (
            db.query(TimesheetShiftRecord)
            .filter(
                TimesheetShiftRecord.worker_id == req.worker_id,
                TimesheetShiftRecord.shift_date == req.shift_date,
            )
            .first()
        )
        hrs = infer_shift_hours(req.requested_shift)
        if att:
            att.overtime_50_hours = hrs
            att.supervisor_override_reason = "Unapproved / Unsynced Shift Change — Treated as Overtime"
            att.supervisor_override_by = payload.reviewed_by

    else:
        raise HTTPException(status_code=400, detail="Invalid decision action")

    db.commit()
    db.refresh(req)
    return serialize_shift_change(req, db)


# ==============================================================================
# DATE-RANGE & ROTATIONAL SHIFT ASSIGNMENT + MONTHLY CALENDAR ENGINE
# ==============================================================================
def get_shift_master_list(client_id: int, db: Session) -> List[dict]:
    items = (
        db.query(ClientMasterData)
        .filter(
            ClientMasterData.client_id == client_id,
            ClientMasterData.category == "client_shift_templates",
        )
        .order_by(ClientMasterData.id.asc())
        .all()
    )
    options = []
    for it in items:
        parts = [p.strip() for p in it.item_value.split("|")]
        options.append({
            "name": parts[0],
            "window": parts[1] if len(parts) > 1 else "07:00–15:30",
            "weekly": parts[2] if len(parts) > 2 else "37.5h/wk",
            "tes": parts[3] if len(parts) > 3 else "Standard TES",
        })
    if not options:
        options = [
            {"name": "Day Shift (Päivävuoro)", "window": "07:00–15:30", "weekly": "37.5h/wk", "tes": "Standard TES"},
            {"name": "Morning Shift (Aamuvuoro)", "window": "06:00–14:30", "weekly": "37.5h/wk", "tes": "2-Shift Cycle"},
            {"name": "Evening Shift (Iltavuoro)", "window": "14:30–23:00", "weekly": "37.5h/wk", "tes": "+Iltavuorolisä"},
            {"name": "Night Shift (Yövuoro)", "window": "22:30–07:00", "weekly": "37.5h/wk", "tes": "+Yövuorolisä"},
        ]
    return options


def ensure_default_monthly_shifts(client_id: int, year: int, month: int, db: Session):
    existing_any = db.query(WorkerDailyShift).filter(WorkerDailyShift.client_id == client_id).count()
    if existing_any > 0:
        return

    deployments = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id).all()
    if not deployments:
        return

    opts = get_shift_master_list(client_id, db)
    first_day = date(year, month, 1)
    next_month = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    last_day = next_month - timedelta(days=1)

    cur = first_day
    while cur <= last_day:
        is_off = cur.weekday() >= 5  # Sat/Sun off
        week_idx = (cur - first_day).days // 7
        for idx, w in enumerate(deployments):
            sh = opts[(idx + week_idx) % min(len(opts), 3)]
            db.add(
                WorkerDailyShift(
                    client_id=client_id,
                    site_id=w.site_id,
                    worker_id=w.worker_id,
                    worker_name=w.worker_name,
                    role_title=w.role_title,
                    shift_date=cur,
                    shift_name="Weekly Off" if is_off else sh["name"],
                    shift_window="" if is_off else sh["window"],
                    planned_hours=0.0 if is_off else infer_shift_hours(sh["name"]),
                    is_weekly_off=is_off,
                    status="PUBLISHED" if cur < date.today() else "DRAFT",
                    assigned_by="Client Admin",
                )
            )
        cur += timedelta(days=1)
    db.commit()


class DateRangeAssignRequest(BaseModel):
    worker_ids: List[int]
    from_date: str  # YYYY-MM-DD
    to_date: str  # YYYY-MM-DD
    mode: str = "FIXED"  # FIXED or ROTATIONAL
    shift_name: str = "Morning Shift (Aamuvuoro)"
    rotation_shifts: List[str] = []
    weekly_offs: List[int] = [5, 6]  # 0=Mon .. 6=Sun
    assigned_by: str = "Client Admin"


class SingleDayShiftUpdate(BaseModel):
    worker_id: int
    shift_date: str  # YYYY-MM-DD
    shift_name: str  # Shift Master name or "Weekly Off"
    assigned_by: str = "Client Admin"


class MonthPublishRequest(BaseModel):
    year: int
    month: int
    site_id: Optional[int] = None
    target_status: str = "SUBMITTED_TO_AGENCY"  # SUBMITTED_TO_AGENCY or PUBLISHED


@router.get("/{client_id}/shift-calendar")
def get_monthly_shift_calendar(
    client_id: int,
    year: int = Query(...),
    month: int = Query(...),
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    worker_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    ensure_default_rosters(client_id, db)
    ensure_default_monthly_shifts(client_id, year, month, db)

    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    first_day = date(year, month, 1)
    next_month = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    last_day = next_month - timedelta(days=1)

    q = db.query(WorkerDailyShift).filter(
        WorkerDailyShift.client_id == client_id,
        WorkerDailyShift.shift_date >= first_day,
        WorkerDailyShift.shift_date <= last_day,
    )
    if allowed_ids is not None:
        q = q.filter(WorkerDailyShift.site_id.in_(allowed_ids))
    if worker_id:
        q = q.filter(WorkerDailyShift.worker_id == worker_id)

    rows = q.order_by(WorkerDailyShift.shift_date.asc(), WorkerDailyShift.worker_id.asc()).all()

    w_q = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id)
    if allowed_ids is not None:
        w_q = w_q.filter(WorkerDeployment.site_id.in_(allowed_ids))
    deployed = [
        {
            "worker_id": w.worker_id,
            "worker_name": w.worker_name,
            "site_id": w.site_id,
            "role_title": w.role_title,
            "tes_category": w.tes_category,
        }
        for w in w_q.order_by(WorkerDeployment.worker_id.asc()).all()
    ]

    return {
        "client_id": client_id,
        "year": year,
        "month": month,
        "shift_master_options": get_shift_master_list(client_id, db),
        "deployed_workers": deployed,
        "entries": [
            {
                "id": r.id,
                "site_id": r.site_id,
                "worker_id": r.worker_id,
                "worker_name": r.worker_name,
                "role_title": r.role_title,
                "shift_date": r.shift_date.isoformat(),
                "shift_name": r.shift_name,
                "shift_window": r.shift_window,
                "planned_hours": r.planned_hours,
                "is_weekly_off": bool(r.is_weekly_off),
                "status": r.status,
            }
            for r in rows
        ],
    }


@router.post("/{client_id}/shift-calendar/assign")
def assign_date_range_shifts(
    client_id: int,
    payload: DateRangeAssignRequest,
    db: Session = Depends(get_db),
):
    if not payload.worker_ids:
        raise HTTPException(status_code=400, detail="Please select at least one worker.")
    try:
        start_dt = datetime.strptime(payload.from_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(payload.to_date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    if end_dt < start_dt:
        raise HTTPException(status_code=400, detail="To Date must be on or after From Date.")
    if (end_dt - start_dt).days > 92:
        raise HTTPException(status_code=400, detail="Maximum assignment range is 90 days at a time.")

    shift_master = {o["name"]: o["window"] for o in get_shift_master_list(client_id, db)}
    rot_list = [s for s in payload.rotation_shifts if s.strip()]
    if payload.mode.upper() == "ROTATIONAL" and not rot_list:
        rot_list = [payload.shift_name]

    workers = (
        db.query(WorkerDeployment)
        .filter(
            WorkerDeployment.client_id == client_id,
            WorkerDeployment.worker_id.in_(payload.worker_ids),
        )
        .all()
    )
    if not workers:
        raise HTTPException(status_code=404, detail="Selected workers not found.")

    # Calculate Monday of start_dt so rotational shifts switch cleanly every Monday
    start_monday = start_dt - timedelta(days=start_dt.weekday())
    offs = set(payload.weekly_offs)
    updated_count = 0

    cur = start_dt
    while cur <= end_dt:
        is_off = cur.weekday() in offs
        week_num = (cur - start_monday).days // 7
        chosen_shift = (
            "Weekly Off"
            if is_off
            else (
                rot_list[week_num % len(rot_list)]
                if payload.mode.upper() == "ROTATIONAL"
                else payload.shift_name
            )
        )
        win = "" if is_off else shift_master.get(chosen_shift, "07:00–15:30")
        hrs = 0.0 if is_off else infer_shift_hours(chosen_shift)

        for w in workers:
            existing = (
                db.query(WorkerDailyShift)
                .filter(
                    WorkerDailyShift.client_id == client_id,
                    WorkerDailyShift.worker_id == w.worker_id,
                    WorkerDailyShift.shift_date == cur,
                )
                .first()
            )
            if existing:
                existing.shift_name = chosen_shift
                existing.shift_window = win
                existing.planned_hours = hrs
                existing.is_weekly_off = is_off
                existing.status = "DRAFT"
                existing.assigned_by = payload.assigned_by
                existing.updated_at = datetime.utcnow()
            else:
                db.add(
                    WorkerDailyShift(
                        client_id=client_id,
                        site_id=w.site_id,
                        worker_id=w.worker_id,
                        worker_name=w.worker_name,
                        role_title=w.role_title,
                        shift_date=cur,
                        shift_name=chosen_shift,
                        shift_window=win,
                        planned_hours=hrs,
                        is_weekly_off=is_off,
                        status="DRAFT",
                        assigned_by=payload.assigned_by,
                    )
                )
            updated_count += 1
        cur += timedelta(days=1)

    db.commit()
    return {
        "status": "assigned",
        "workers_count": len(workers),
        "days_assigned": (end_dt - start_dt).days + 1,
        "total_records": updated_count,
    }


@router.patch("/{client_id}/shift-calendar/day")
def update_single_day_shift(
    client_id: int,
    payload: SingleDayShiftUpdate,
    db: Session = Depends(get_db),
):
    try:
        target_dt = datetime.strptime(payload.shift_date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid shift_date")

    dep = (
        db.query(WorkerDeployment)
        .filter(
            WorkerDeployment.client_id == client_id,
            WorkerDeployment.worker_id == payload.worker_id,
        )
        .first()
    )
    if not dep:
        raise HTTPException(status_code=404, detail="Worker not found")

    shift_master = {o["name"]: o["window"] for o in get_shift_master_list(client_id, db)}
    is_off = payload.shift_name.strip().upper() in ("OFF", "WEEKLY OFF", "REST")
    chosen = "Weekly Off" if is_off else payload.shift_name.strip()
    win = "" if is_off else shift_master.get(chosen, "07:00–15:30")
    hrs = 0.0 if is_off else infer_shift_hours(chosen)

    existing = (
        db.query(WorkerDailyShift)
        .filter(
            WorkerDailyShift.client_id == client_id,
            WorkerDailyShift.worker_id == dep.worker_id,
            WorkerDailyShift.shift_date == target_dt,
        )
        .first()
    )
    if existing:
        existing.shift_name = chosen
        existing.shift_window = win
        existing.planned_hours = hrs
        existing.is_weekly_off = is_off
        existing.assigned_by = payload.assigned_by
        existing.updated_at = datetime.utcnow()
    else:
        db.add(
            WorkerDailyShift(
                client_id=client_id,
                site_id=dep.site_id,
                worker_id=dep.worker_id,
                worker_name=dep.worker_name,
                role_title=dep.role_title,
                shift_date=target_dt,
                shift_name=chosen,
                shift_window=win,
                planned_hours=hrs,
                is_weekly_off=is_off,
                status="DRAFT",
                assigned_by=payload.assigned_by,
            )
        )
    db.commit()
    return {"status": "updated", "worker_id": dep.worker_id, "shift_date": payload.shift_date, "shift_name": chosen}


@router.post("/{client_id}/shift-calendar/publish")
def publish_month_shifts(
    client_id: int,
    payload: MonthPublishRequest,
    db: Session = Depends(get_db),
):
    first_day = date(payload.year, payload.month, 1)
    next_month = date(payload.year + 1, 1, 1) if payload.month == 12 else date(payload.year, payload.month + 1, 1)
    last_day = next_month - timedelta(days=1)

    q = db.query(WorkerDailyShift).filter(
        WorkerDailyShift.client_id == client_id,
        WorkerDailyShift.shift_date >= first_day,
        WorkerDailyShift.shift_date <= last_day,
    )
    if payload.site_id:
        q = q.filter(WorkerDailyShift.site_id == payload.site_id)

    target = payload.target_status.strip().upper()
    if target not in ("DRAFT", "SUBMITTED_TO_AGENCY", "PUBLISHED"):
        raise HTTPException(status_code=400, detail="Invalid status")

    count = q.update({"status": target, "updated_at": datetime.utcnow()}, synchronize_session=False)
    db.commit()
    return {"status": target, "updated_records": count}
