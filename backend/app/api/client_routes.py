import json
from datetime import datetime, date, time
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.site_access import get_allowed_site_ids_for_user, assert_user_can_access_site
from app.models.client import (
    ClientCompany,
    ClientSite,
    ClientUser,
    WorkerDeployment,
    BiometricLog,
    TimesheetShiftRecord,
    ClientMasterData,
    ClientApprovalFlow,
    ClientNotification
)
from app.schemas.client import (
    ClientLoginRequest,
    ClientLoginResponse,
    ClientCompanyOut,
    ClientSiteOut,
    WorkerDeploymentOut,
    BiometricSyncRequest,
    BiometricLogOut,
    TimesheetShiftOut,
    SupervisorAdjustmentRequest,
    LiveWorkforceSummary,
    LiveWorkerItem,
    ApprovalLevelConfig,
    ClientApprovalFlowPayload,
    ClientApprovalFlowOut,
    ClientNotificationOut
)

router = APIRouter(prefix="/api/client", tags=["Client Portal"])

@router.post("/auth/login", response_model=ClientLoginResponse)
def client_login(payload: ClientLoginRequest, db: Session = Depends(get_db)):
    """
    Client Portal authentication gate. Validates username/email & stored password strictly and returns scoped access.
    """
    email_clean = payload.email.strip().lower()
    password_clean = (payload.password or "").strip()

    user = db.query(ClientUser).filter(
        or_(
            ClientUser.email == email_clean,
            and_(email_clean == "admin", ClientUser.email == "admin@frcp.in"),
        ),
        ClientUser.is_active == True,
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    # Strict per-user password check
    stored_pwd = (user.password or "").strip()
    if password_clean != stored_pwd:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    company = db.query(ClientCompany).filter(ClientCompany.id == user.client_id).first()

    return ClientLoginResponse(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        client_id=user.client_id,
        client_name=company.name if company else "Client Company",
        assigned_site_ids=user.assigned_site_ids,
        must_change_password=bool(user.must_change_password),
        module_permissions=user.module_permissions or "{}",
        token=f"suomi_session_tk_{user.id}_{int(datetime.utcnow().timestamp())}",
        avatar_url=getattr(user, "avatar_url", None),
    )


class ChangePasswordRequest(BaseModel):
    user_id: int
    current_password: str
    new_password: str


@router.post("/auth/change-password")
def change_client_password(payload: ChangePasswordRequest, db: Session = Depends(get_db)):
    """
    Mandatory first-time password change (or voluntary password update).
    """
    user = db.query(ClientUser).filter(ClientUser.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if (payload.current_password or "").strip() != (user.password or "").strip():
        raise HTTPException(status_code=400, detail="Current / default password is incorrect.")

    new_pwd = (payload.new_password or "").strip()
    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")
    if new_pwd == (user.password or "").strip():
        raise HTTPException(status_code=400, detail="New password must be different from the default password.")

    user.password = new_pwd
    user.must_change_password = False
    db.commit()
    return {"status": "password_updated", "user_id": user.id, "must_change_password": False}

@router.get("/{client_id}/companies", response_model=ClientCompanyOut)
def get_client_company(client_id: int, db: Session = Depends(get_db)):
    company = db.query(ClientCompany).filter(ClientCompany.id == client_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Client company not found")
    return company

@router.get("/{client_id}/sites", response_model=List[ClientSiteOut])
def get_client_sites(
    client_id: int,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, None)
    q = db.query(ClientSite).filter(ClientSite.client_id == client_id, ClientSite.is_active == True)
    if allowed_ids is not None:
        q = q.filter(ClientSite.id.in_(allowed_ids))
    return q.all()

class SiteCreateRequest(BaseModel):
    site_name: str
    site_code: str
    city: str
    address: str
    postal_code: str = "33100"
    tes_industry_sector: str = "Teknologiateollisuus TES"
    biometric_terminal_id: Optional[str] = None

class SiteUpdateRequest(BaseModel):
    site_name: Optional[str] = None
    site_code: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    tes_industry_sector: Optional[str] = None
    biometric_terminal_id: Optional[str] = None

@router.post("/{client_id}/sites/create", response_model=ClientSiteOut)
def create_client_site(client_id: int, payload: SiteCreateRequest, db: Session = Depends(get_db)):
    new_site = ClientSite(
        client_id=client_id,
        site_name=payload.site_name.strip(),
        site_code=payload.site_code.strip().upper(),
        city=payload.city.strip(),
        address=payload.address.strip(),
        postal_code=payload.postal_code.strip(),
        tes_industry_sector=payload.tes_industry_sector.strip(),
        biometric_terminal_id=(payload.biometric_terminal_id or "").strip() or None,
        is_active=True
    )
    db.add(new_site)
    db.commit()
    db.refresh(new_site)
    return new_site

@router.patch("/{client_id}/sites/{site_id}", response_model=ClientSiteOut)
def update_client_site(client_id: int, site_id: int, payload: SiteUpdateRequest, db: Session = Depends(get_db)):
    site = db.query(ClientSite).filter(ClientSite.id == site_id, ClientSite.client_id == client_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    if payload.site_name is not None:
        site.site_name = payload.site_name.strip()
    if payload.site_code is not None:
        site.site_code = payload.site_code.strip().upper()
    if payload.city is not None:
        site.city = payload.city.strip()
    if payload.address is not None:
        site.address = payload.address.strip()
    if payload.postal_code is not None:
        site.postal_code = payload.postal_code.strip()
    if payload.tes_industry_sector is not None:
        site.tes_industry_sector = payload.tes_industry_sector.strip()
    if payload.biometric_terminal_id is not None:
        site.biometric_terminal_id = payload.biometric_terminal_id.strip() or None
    db.commit()
    db.refresh(site)
    return site

@router.delete("/{client_id}/sites/{site_id}")
def delete_client_site(client_id: int, site_id: int, db: Session = Depends(get_db)):
    site = db.query(ClientSite).filter(ClientSite.id == site_id, ClientSite.client_id == client_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    site.is_active = False
    db.commit()
    return {"status": "deleted", "site_id": site_id}

DEFAULT_MASTER_JOB_ROLES = [
    "HR Head",
    "HR Manager",
    "HR Coordinator",
    "Plant Director",
    "Site Manager",
    "Shift Supervisor",
    "Accounts Manager",
    "Accounts Executive",
    "HSE / Safety Officer",
]

DEFAULT_MASTER_SHIFTS = [
    "Day Shift (Päivävuoro) | 07:00–15:30 | 37.5h/wk | Standard TES",
    "Morning Shift (Aamuvuoro) | 06:00–14:30 | 37.5h/wk | 2-Shift Cycle",
    "Evening Shift (Iltavuoro) | 14:30–23:00 | 37.5h/wk | +Iltavuorolisä",
    "Night Shift (Yövuoro) | 22:30–07:00 | 37.5h/wk | +Yövuorolisä",
    "3-Shift Continuous (3-Vuorotyö) | Rotating A/I/Y | 36.0h/wk | Continuous TES",
]

class MasterDataItemCreate(BaseModel):
    category: str
    item_value: str

class MasterDataItemUpdate(BaseModel):
    category: str
    old_value: str
    new_value: str

@router.get("/{client_id}/master-data")
def get_master_data(client_id: int, db: Session = Depends(get_db)):
    # Seed initial defaults once per client if not yet initialized
    init_flag = db.query(ClientMasterData).filter(
        ClientMasterData.client_id == client_id,
        ClientMasterData.category == "_defaults_seeded"
    ).first()
    if not init_flag:
        for role_val in DEFAULT_MASTER_JOB_ROLES:
            db.add(ClientMasterData(client_id=client_id, category="client_job_roles", item_value=role_val))
        for shift_val in DEFAULT_MASTER_SHIFTS:
            db.add(ClientMasterData(client_id=client_id, category="client_shift_templates", item_value=shift_val))
        db.add(ClientMasterData(client_id=client_id, category="_defaults_seeded", item_value="true"))
        db.commit()

    items = db.query(ClientMasterData).filter(
        ClientMasterData.client_id == client_id,
        ClientMasterData.category != "_defaults_seeded"
    ).order_by(ClientMasterData.id.asc()).all()
    grouped = {}
    for it in items:
        grouped.setdefault(it.category, []).append(it.item_value)
    return {"client_id": client_id, "master_data": grouped}

@router.patch("/{client_id}/master-data")
def update_master_data(client_id: int, payload: MasterDataItemUpdate, db: Session = Depends(get_db)):
    existing = db.query(ClientMasterData).filter(
        ClientMasterData.client_id == client_id,
        ClientMasterData.category == payload.category,
        ClientMasterData.item_value == payload.old_value.strip()
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Master data item not found")
    existing.item_value = payload.new_value.strip()
    db.commit()
    db.refresh(existing)
    return {"status": "updated", "category": payload.category, "item_value": existing.item_value}

@router.post("/{client_id}/master-data")
def add_master_data(client_id: int, payload: MasterDataItemCreate, db: Session = Depends(get_db)):
    existing = db.query(ClientMasterData).filter(
        ClientMasterData.client_id == client_id,
        ClientMasterData.category == payload.category,
        ClientMasterData.item_value == payload.item_value.strip()
    ).first()
    if existing:
        return {"status": "exists", "category": payload.category, "item_value": existing.item_value}
    
    new_item = ClientMasterData(
        client_id=client_id,
        category=payload.category,
        item_value=payload.item_value.strip()
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {"status": "created", "id": new_item.id, "category": new_item.category, "item_value": new_item.item_value}

@router.delete("/{client_id}/master-data")
def delete_master_data(
    client_id: int,
    category: str = Query(...),
    item_value: str = Query(...),
    db: Session = Depends(get_db)
):
    existing = db.query(ClientMasterData).filter(
        ClientMasterData.client_id == client_id,
        ClientMasterData.category == category,
        ClientMasterData.item_value == item_value.strip()
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Master data item not found")
    db.delete(existing)
    db.commit()
    return {"status": "deleted", "category": category, "item_value": item_value}


# ---------------- MASTER APPROVAL FLOW ENDPOINTS ----------------
@router.get("/{client_id}/approval-flows")
def get_approval_flows(client_id: int, db: Session = Depends(get_db)):
    """
    Fetch all multi-level approval workflows for the client.
    Returns empty list if none exist.
    """
    flows = db.query(ClientApprovalFlow).filter(
        ClientApprovalFlow.client_id == client_id
    ).order_by(ClientApprovalFlow.id.asc()).all()

    result = []
    for f in flows:
        try:
            parsed_levels = json.loads(f.levels_json) if f.levels_json else []
        except Exception:
            parsed_levels = []
        result.append({
            "id": f.id,
            "client_id": f.client_id,
            "flow_key": f.flow_key,
            "flow_name": f.flow_name,
            "description": f.description,
            "is_active": f.is_active,
            "levels": parsed_levels,
            "updated_at": f.updated_at.isoformat() if f.updated_at else None
        })
    return {"client_id": client_id, "approval_flows": result}


@router.post("/{client_id}/approval-flows")
def save_approval_flow(client_id: int, payload: ClientApprovalFlowPayload, db: Session = Depends(get_db)):
    """
    Create or update an approval workflow configuration and its sequential levels.
    When saved, automatically dispatches formal notification records to each approver user
    specifying the Approval Type, Approver Level, and Next Level Approver User.
    """
    clean_key = payload.flow_key.strip().lower()
    existing = db.query(ClientApprovalFlow).filter(
        ClientApprovalFlow.client_id == client_id,
        ClientApprovalFlow.flow_key == clean_key
    ).first()

    levels_data = [lvl.dict() for lvl in payload.levels]
    for idx, lvl in enumerate(levels_data):
        lvl["level"] = idx + 1

    if existing:
        existing.flow_name = payload.flow_name.strip()
        existing.description = (payload.description or "").strip()
        existing.is_active = payload.is_active
        existing.levels_json = json.dumps(levels_data)
        existing.updated_at = datetime.utcnow()
        flow_record = existing
    else:
        new_flow = ClientApprovalFlow(
            client_id=client_id,
            flow_key=clean_key,
            flow_name=payload.flow_name.strip(),
            description=(payload.description or "").strip(),
            is_active=payload.is_active,
            levels_json=json.dumps(levels_data)
        )
        db.add(new_flow)
        db.flush()
        flow_record = new_flow

    # Do NOT spam all levels with notifications upon saving configuration!
    # Notifications are strictly dispatched level-by-level ONLY when an actual request is raised.
    db.commit()
    db.refresh(flow_record)

    return {
        "status": "saved",
        "flow": {
            "id": flow_record.id,
            "client_id": flow_record.client_id,
            "flow_key": flow_record.flow_key,
            "flow_name": flow_record.flow_name,
            "description": flow_record.description,
            "is_active": flow_record.is_active,
            "levels": levels_data,
            "updated_at": flow_record.updated_at.isoformat() if flow_record.updated_at else None
        },
        "notifications_dispatched": []
    }


@router.delete("/{client_id}/approval-flows/{flow_id}")
def delete_approval_flow(client_id: int, flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(ClientApprovalFlow).filter(
        ClientApprovalFlow.client_id == client_id,
        ClientApprovalFlow.id == flow_id
    ).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Approval flow not found")
    db.delete(flow)
    db.commit()
    return {"status": "deleted", "flow_id": flow_id}


@router.get("/{client_id}/notifications", response_model=List[ClientNotificationOut])
def get_client_notifications(
    client_id: int,
    user_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(ClientNotification).filter(ClientNotification.client_id == client_id)
    if user_id:
        query = query.filter(ClientNotification.user_id == user_id)
    return query.order_by(ClientNotification.created_at.desc()).limit(limit).all()


@router.post("/{client_id}/notifications/{notification_id}/read")
def mark_notification_read(client_id: int, notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(ClientNotification).filter(
        ClientNotification.client_id == client_id,
        ClientNotification.id == notification_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "ok", "id": notification_id}


@router.post("/{client_id}/notifications/mark-all-read")
def mark_all_notifications_read(client_id: int, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ClientNotification).filter(ClientNotification.client_id == client_id)
    if user_id:
        query = query.filter((ClientNotification.user_id == user_id) | (ClientNotification.user_id == None))
    query.update({ClientNotification.is_read: True}, synchronize_session=False)
    db.commit()
    return {"status": "all_read"}


@router.delete("/{client_id}/notifications/clear")
def clear_all_notifications(client_id: int, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(ClientNotification).filter(ClientNotification.client_id == client_id)
    if user_id:
        query = query.filter((ClientNotification.user_id == user_id) | (ClientNotification.user_id == None))
    deleted_count = query.delete(synchronize_session=False)
    db.commit()
    return {"status": "cleared", "deleted_count": deleted_count}


@router.delete("/{client_id}/notifications/{notification_id}")
def delete_single_notification(client_id: int, notification_id: int, db: Session = Depends(get_db)):
    notif = db.query(ClientNotification).filter(
        ClientNotification.client_id == client_id,
        ClientNotification.id == notification_id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"status": "deleted", "id": notification_id}


@router.get("/{client_id}/deployments", response_model=List[WorkerDeploymentOut])
def get_client_deployments(
    client_id: int,
    site_id: Optional[int] = None,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)
    query = db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id)
    if allowed_ids is not None:
        query = query.filter(WorkerDeployment.site_id.in_(allowed_ids))
    deployments = query.all()
    
    # Enrich site_name
    results = []
    for d in deployments:
        site = db.query(ClientSite).filter(ClientSite.id == d.site_id).first()
        out = WorkerDeploymentOut.from_orm(d)
        out.site_name = site.site_name if site else "N/A"
        results.append(out)
    return results

@router.get("/{client_id}/workforce/live", response_model=LiveWorkforceSummary)
def get_live_workforce(
    client_id: int,
    site_id: Optional[int] = None,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    company = db.query(ClientCompany).filter(ClientCompany.id == client_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Client company not found")

    # Resolve strict site scope: all assigned sites for user (for header dropdown),
    # and active query filter (when a specific assigned site is selected)
    user_assigned_ids = get_allowed_site_ids_for_user(db, client_id, user_id, None)
    active_filter_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    sites_query = db.query(ClientSite).filter(ClientSite.client_id == client_id, ClientSite.is_active == True)
    if user_assigned_ids is not None:
        sites_query = sites_query.filter(ClientSite.id.in_(user_assigned_ids))
    sites = sites_query.all()

    # Ensure worker deployments exist for client so data displays autonomously for any operational user
    if db.query(WorkerDeployment).filter(WorkerDeployment.client_id == client_id).count() == 0:
        from app.api.operations_routes import seed_worker_deployments
        seed_worker_deployments(client_id, db)

    deployments_query = db.query(WorkerDeployment).filter(
        WorkerDeployment.client_id == client_id,
        WorkerDeployment.status.in_(["ACTIVE", "SICK_LEAVE", "ON_LEAVE"])
    )
    if active_filter_ids is not None:
        deployments_query = deployments_query.filter(WorkerDeployment.site_id.in_(active_filter_ids))
    deployments = deployments_query.all()

    today = date.today()
    # Today's shift records for these workers
    shifts = db.query(TimesheetShiftRecord).filter(
        TimesheetShiftRecord.client_id == client_id,
        TimesheetShiftRecord.shift_date == today
    ).all()
    shift_map = {s.worker_id: s for s in shifts}

    # Latest biometric punch for each worker today
    worker_items: List[LiveWorkerItem] = []
    currently_on_duty = 0
    on_break = 0
    reported_absent_or_sick = 0

    site_name_map = {s.id: s.site_name for s in sites}

    for dep in deployments:
        shift = shift_map.get(dep.worker_id)
        current_status = "SCHEDULED"
        clock_in = None
        last_punch_type = None
        last_punch_time = None
        hours_so_far = 0.0

        if dep.status == "SICK_LEAVE":
            current_status = "SICK_LEAVE"
            reported_absent_or_sick += 1
        elif dep.status == "ON_LEAVE":
            current_status = "ON_LEAVE"
        elif shift:
            clock_in = shift.clock_in
            last_punch_time = shift.last_biometric_punch or shift.clock_in
            if shift.status == "ON_DUTY":
                current_status = "ON_DUTY"
                currently_on_duty += 1
                last_punch_type = "CLOCK_IN"
                if shift.clock_in:
                    elapsed = (datetime.utcnow() - shift.clock_in).total_seconds() / 3600.0
                    hours_so_far = max(0.0, round(elapsed, 2))
            elif shift.status == "CLOCKED_OUT":
                current_status = "CLOCKED_OUT"
                last_punch_type = "CLOCK_OUT"
                hours_so_far = shift.regular_hours
            elif shift.status in ["ABSENT", "SICK_REPORTED"]:
                current_status = shift.status
                reported_absent_or_sick += 1
        else:
            current_status = "SCHEDULED"

        worker_items.append(LiveWorkerItem(
            worker_id=dep.worker_id,
            worker_name=dep.worker_name,
            site_id=dep.site_id,
            site_name=site_name_map.get(dep.site_id, f"Site #{dep.site_id}"),
            role_title=dep.role_title,
            tes_category=dep.tes_category,
            status=current_status,
            clock_in_time=clock_in,
            last_punch_type=last_punch_type,
            last_punch_time=last_punch_time,
            shift_hours_so_far=hours_so_far
        ))

    return LiveWorkforceSummary(
        client_id=company.id,
        client_name=company.name,
        total_deployed_headcount=len(deployments),
        currently_on_duty=currently_on_duty,
        on_scheduled_break=on_break,
        reported_absent_or_sick=reported_absent_or_sick,
        sites_count=len(sites),
        sites=[ClientSiteOut.from_orm(s) for s in sites],
        workers=worker_items
    )

@router.post("/biometric/sync", response_model=BiometricLogOut)
def sync_biometric_punch(payload: BiometricSyncRequest, db: Session = Depends(get_db)):
    """
    Automated webhook / sync endpoint for physical biometric hardware terminals.
    Processes punch in real time, automatically maintaining Finnish legal shift accounting.
    """
    # 1. Log the raw biometric event
    log = BiometricLog(
        device_id=payload.device_id,
        worker_id=payload.worker_id,
        site_id=payload.site_id,
        timestamp=payload.timestamp,
        direction=payload.direction,
        verification_mode=payload.verification_mode,
        raw_payload=payload.raw_payload
    )
    db.add(log)

    # 2. Find worker deployment
    deployment = db.query(WorkerDeployment).filter(
        WorkerDeployment.worker_id == payload.worker_id,
        WorkerDeployment.site_id == payload.site_id,
        WorkerDeployment.status == "ACTIVE"
    ).first()

    punch_date = payload.timestamp.date()

    if deployment:
        # Find existing shift record for today
        shift = db.query(TimesheetShiftRecord).filter(
            TimesheetShiftRecord.worker_id == payload.worker_id,
            TimesheetShiftRecord.site_id == payload.site_id,
            TimesheetShiftRecord.shift_date == punch_date
        ).first()

        if payload.direction == "CLOCK_IN":
            if not shift:
                shift = TimesheetShiftRecord(
                    worker_id=payload.worker_id,
                    worker_name=deployment.worker_name,
                    client_id=deployment.client_id,
                    site_id=payload.site_id,
                    shift_date=punch_date,
                    clock_in=payload.timestamp,
                    status="ON_DUTY",
                    last_biometric_punch=payload.timestamp
                )
                db.add(shift)
            else:
                shift.clock_in = payload.timestamp
                shift.status = "ON_DUTY"
                shift.last_biometric_punch = payload.timestamp

        elif payload.direction == "CLOCK_OUT":
            if not shift:
                # Clock out without a prior clock in (anomaly - log shift with 0 start)
                shift = TimesheetShiftRecord(
                    worker_id=payload.worker_id,
                    worker_name=deployment.worker_name,
                    client_id=deployment.client_id,
                    site_id=payload.site_id,
                    shift_date=punch_date,
                    clock_out=payload.timestamp,
                    status="CLOCKED_OUT",
                    last_biometric_punch=payload.timestamp
                )
                db.add(shift)
            else:
                shift.clock_out = payload.timestamp
                shift.status = "CLOCKED_OUT"
                shift.last_biometric_punch = payload.timestamp

                # Calculate duration adhering to Finnish Working Hours Act (Työaikalaki)
                if shift.clock_in:
                    total_elapsed_hours = (payload.timestamp - shift.clock_in).total_seconds() / 3600.0
                    
                    # Unpaid break of 30 min (0.5h) applies if shift > 6 hours (Työaikalaki 24 §)
                    break_hrs = 0.5 if total_elapsed_hours > 6.0 else 0.0
                    net_hours = max(0.0, total_elapsed_hours - break_hrs)
                    
                    # Standard daily hours up to 8.0 hours
                    if net_hours <= 8.0:
                        shift.regular_hours = round(net_hours, 2)
                        shift.overtime_50_hours = 0.0
                        shift.overtime_100_hours = 0.0
                    else:
                        shift.regular_hours = 8.0
                        ot_hours = net_hours - 8.0
                        # Daily overtime: first 2 hours at 50%, remaining at 100%
                        shift.overtime_50_hours = round(min(2.0, ot_hours), 2)
                        shift.overtime_100_hours = round(max(0.0, ot_hours - 2.0), 2)

    db.commit()
    db.refresh(log)
    return log

@router.put("/workforce/adjust-hours", response_model=TimesheetShiftOut)
def supervisor_adjust_hours(request: SupervisorAdjustmentRequest, db: Session = Depends(get_db)):
    """
    Supervisor manual adjustment with mandatory justification audit reason.
    Used when worker forgot badge or terminal was in maintenance.
    """
    shift = db.query(TimesheetShiftRecord).filter(TimesheetShiftRecord.id == request.shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift record not found")

    shift.supervisor_override_hours = request.adjusted_regular_hours
    shift.supervisor_override_reason = request.reason
    shift.supervisor_override_by = request.supervisor_name
    shift.regular_hours = request.adjusted_regular_hours
    if request.adjusted_break_minutes is not None:
        shift.break_minutes = request.adjusted_break_minutes

    db.commit()
    db.refresh(shift)

    site = db.query(ClientSite).filter(ClientSite.id == shift.site_id).first()
    out = TimesheetShiftOut.from_orm(shift)
    out.site_name = site.site_name if site else "N/A"
    return out

@router.get("/{client_id}/workforce/shifts", response_model=List[TimesheetShiftOut])
def get_client_shifts(
    client_id: int,
    site_id: Optional[int] = None,
    user_id: Optional[int] = Query(None),
    shift_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)
    query = db.query(TimesheetShiftRecord).filter(TimesheetShiftRecord.client_id == client_id)
    if allowed_ids is not None:
        query = query.filter(TimesheetShiftRecord.site_id.in_(allowed_ids))
    if shift_date:
        query = query.filter(TimesheetShiftRecord.shift_date == shift_date)
    else:
        query = query.filter(TimesheetShiftRecord.shift_date == date.today())
        
    shifts = query.all()
    results = []
    for s in shifts:
        site = db.query(ClientSite).filter(ClientSite.id == s.site_id).first()
        out = TimesheetShiftOut.from_orm(s)
        out.site_name = site.site_name if site else "N/A"
        results.append(out)
    return results


# ==============================================================================
# CLIENT PORTAL OPERATIONAL USER MANAGEMENT (Assigned by Client Admin)
# ==============================================================================
RESTRICTED_ADMIN_ROLES = {"SUPER_ADMIN", "AGENCY_ADMIN", "CLIENT_ADMIN", "HR_ADMIN"}


class OperationalUserCreate(BaseModel):
    full_name: str
    email: str
    role: str  # Operational roles only
    assigned_site_ids: str = "1"  # Single site ID ("1") or comma-separated ("1,2") or "*"
    default_password: Optional[str] = None
    module_permissions: str = "{}"


class OperationalUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    assigned_site_ids: Optional[str] = None
    module_permissions: Optional[str] = None
    reset_password: Optional[str] = None
    is_active: Optional[bool] = None
    availability_status: Optional[str] = None
    not_available_reason: Optional[str] = None
    avatar_url: Optional[str] = None


@router.get("/{client_id}/users")
def list_client_users(client_id: int, db: Session = Depends(get_db)):
    users = (
        db.query(ClientUser)
        .filter(ClientUser.client_id == client_id)
        .order_by(ClientUser.id.asc())
        .all()
    )
    return {
        "client_id": client_id,
        "users": [
            {
                "id": u.id,
                "client_id": u.client_id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "assigned_site_ids": u.assigned_site_ids,
                "must_change_password": bool(u.must_change_password),
                "module_permissions": u.module_permissions or "{}",
                "is_active": u.is_active,
                "is_client_admin": u.role.upper() in RESTRICTED_ADMIN_ROLES,
                "assigned_by": "Agency Super Admin" if u.role.upper() in RESTRICTED_ADMIN_ROLES else "Client Admin",
            }
            for u in users
        ],
    }


@router.post("/{client_id}/users")
def create_operational_user(
    client_id: int,
    payload: OperationalUserCreate,
    db: Session = Depends(get_db),
):
    role_clean = payload.role.strip().upper().replace(" ", "_")
    if role_clean in RESTRICTED_ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Client Admin can only create operational users. Admin accounts are assigned by Agency Super Admin.",
        )

    email_clean = payload.email.strip().lower()
    existing = db.query(ClientUser).filter(ClientUser.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this username/email already exists.")

    import secrets
    temp_pwd = (payload.default_password or "").strip()
    if not temp_pwd:
        temp_pwd = f"Suomi@{secrets.randbelow(9000) + 1000}"

    new_user = ClientUser(
        client_id=client_id,
        full_name=payload.full_name.strip(),
        email=email_clean,
        role=role_clean,
        assigned_site_ids=payload.assigned_site_ids.strip() or "1",
        password=temp_pwd,
        must_change_password=True,
        module_permissions=payload.module_permissions or "{}",
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {
        "id": new_user.id,
        "client_id": new_user.client_id,
        "full_name": new_user.full_name,
        "email": new_user.email,
        "role": new_user.role,
        "assigned_site_ids": new_user.assigned_site_ids,
        "default_password": temp_pwd,
        "must_change_password": True,
        "module_permissions": new_user.module_permissions or "{}",
        "is_active": new_user.is_active,
        "is_client_admin": False,
        "assigned_by": "Client Admin",
    }


@router.patch("/{client_id}/users/{user_id}")
def update_operational_user(
    client_id: int,
    user_id: int,
    payload: OperationalUserUpdate,
    db: Session = Depends(get_db),
):
    user = (
        db.query(ClientUser)
        .filter(ClientUser.id == user_id, ClientUser.client_id == client_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Client user not found")

    is_admin_account = user.role.upper() in RESTRICTED_ADMIN_ROLES

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()

    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url

    if payload.email is not None and payload.email.strip():
        new_email = payload.email.strip().lower()
        if new_email != user.email:
            dup = db.query(ClientUser).filter(ClientUser.email == new_email).first()
            if dup:
                raise HTTPException(status_code=400, detail="This username/email is already in use.")
            user.email = new_email

    if is_admin_account:
        # Client Admin can edit own profile / password / sites, but cannot be demoted or deactivated
        if payload.assigned_site_ids is not None:
            user.assigned_site_ids = payload.assigned_site_ids.strip() or "*"
        if payload.reset_password is not None and payload.reset_password.strip():
            user.password = payload.reset_password.strip()
            user.must_change_password = False
    else:
        if payload.role is not None:
            role_clean = payload.role.strip().upper().replace(" ", "_")
            if role_clean in RESTRICTED_ADMIN_ROLES:
                raise HTTPException(
                    status_code=403,
                    detail="Cannot promote an operational user to Admin. Contact Agency Super Admin.",
                )
            user.role = role_clean
        if payload.assigned_site_ids is not None:
            user.assigned_site_ids = payload.assigned_site_ids.strip() or "1"
        if payload.module_permissions is not None:
            user.module_permissions = payload.module_permissions
        if payload.reset_password is not None and payload.reset_password.strip():
            user.password = payload.reset_password.strip()
            user.must_change_password = True
        if payload.is_active is not None:
            user.is_active = payload.is_active

    if payload.availability_status is not None:
        user.availability_status = payload.availability_status
    if payload.not_available_reason is not None:
        user.not_available_reason = payload.not_available_reason

    db.commit()
    db.refresh(user)
    return {
        "id": user.id,
        "client_id": user.client_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "assigned_site_ids": user.assigned_site_ids,
        "must_change_password": bool(user.must_change_password),
        "module_permissions": user.module_permissions or "{}",
        "is_active": user.is_active,
        "availability_status": user.availability_status,
        "not_available_reason": user.not_available_reason,
        "is_client_admin": is_admin_account,
        "assigned_by": "Agency Super Admin" if is_admin_account else "Client Admin",
    }


@router.delete("/{client_id}/users/{user_id}")
def delete_operational_user(
    client_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    user = (
        db.query(ClientUser)
        .filter(ClientUser.id == user_id, ClientUser.client_id == client_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Client user not found")

    if user.role.upper() in RESTRICTED_ADMIN_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Client Admin accounts cannot be deleted here. Managed by Agency Super Admin.",
        )

    db.delete(user)
    db.commit()
    return {"status": "deleted", "user_id": user_id}
