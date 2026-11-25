import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.client import ClientApprovalFlow, ClientNotification, ClientUser


# Global mapping of module flow_key -> short human labels & next-step descriptions
FLOW_METADATA: Dict[str, Dict[str, str]] = {
    "m1.2_req": {
        "short_item": "new work requirement",
        "target_module": "m1.2_req",
        "next_step_label": "Agency Portal",
    },
    "m1.6_invoices": {
        "short_item": "invoice payment",
        "target_module": "m1.6_invoices",
        "next_step_label": "Accounts desk",
    },
    "m1.3_changes": {
        "short_item": "shift change request",
        "target_module": "m1.3_changes",
        "next_step_label": "Attendance Register",
    },
    "m1.3_builder": {
        "short_item": "shift roster schedule",
        "target_module": "m1.3_builder",
        "next_step_label": "Agency Portal",
    },
    "m1.3_published": {
        "short_item": "published plant roster",
        "target_module": "m1.3_published",
        "next_step_label": "Plant Workforce",
    },
    "m1.5_actions": {
        "short_item": "worker action request",
        "target_module": "m1.5_actions",
        "next_step_label": "Agency Portal",
    },
    "m1.5_safety": {
        "short_item": "safety incident report",
        "target_module": "m1.5_safety",
        "next_step_label": "Agency HSE Desk",
    },
    "m1.4_overtime": {
        "short_item": "overtime request",
        "target_module": "m1.4_overtime",
        "next_step_label": "Payroll & Timesheets",
    },
    "m1.4_leaves": {
        "short_item": "leave request",
        "target_module": "m1.4_leaves",
        "next_step_label": "Attendance Register",
    },
    "m1.4_timesheets": {
        "short_item": "timesheet batch",
        "target_module": "m1.4_timesheets",
        "next_step_label": "Agency Billing",
    },
}


def get_flow_meta(flow_key: str) -> Dict[str, str]:
    clean = (flow_key or "").strip().lower()
    return FLOW_METADATA.get(
        clean,
        {
            "short_item": "operational request",
            "target_module": clean or "dashboard",
            "next_step_label": "next workflow step",
        },
    )


def get_active_flow_levels(db: Session, client_id: int, flow_key: str) -> List[Dict[str, Any]]:
    """
    Returns ordered sequential approval levels for `(client_id, flow_key)` if an active
    Master Approval Flow exists; otherwise returns `[]`.
    """
    clean_key = (flow_key or "").strip().lower()
    flow = (
        db.query(ClientApprovalFlow)
        .filter(
            ClientApprovalFlow.client_id == client_id,
            ClientApprovalFlow.flow_key == clean_key,
            ClientApprovalFlow.is_active == True,
        )
        .first()
    )
    if not flow or not flow.levels_json:
        return []
    try:
        levels = json.loads(flow.levels_json)
        if isinstance(levels, list):
            # Ensure sorted by level number 1..N
            return sorted(levels, key=lambda x: int(x.get("level", 1)))
    except Exception:
        pass
    return []


def create_short_notification(
    db: Session,
    client_id: int,
    recipient_user_id: Optional[int],
    short_text: str,
    target_module: str,
    reference_id: Optional[int] = None,
    approver_level: Optional[str] = None,
) -> Optional[ClientNotification]:
    """
    Creates a concise, single-line notification strictly targeted to `recipient_user_id`.
    Does NOT broadcast to all users if `recipient_user_id` is missing.
    """
    if not recipient_user_id:
        return None

    notif = ClientNotification(
        client_id=client_id,
        user_id=recipient_user_id,
        title=short_text,
        message=short_text,
        notification_type="APPROVAL_REQUEST",
        approval_type=target_module,
        approver_level=approver_level,
        next_level_approver=None,
        target_module=target_module,
        reference_id=reference_id,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(notif)
    return notif


def resolve_level_approver_user_id(db: Session, client_id: int, level_cfg: Dict[str, Any]) -> Optional[int]:
    """
    Resolves the exact target user ID for a given approval level configuration.
    """
    approver_id = level_cfg.get("approver_id")
    if approver_id:
        return int(approver_id)
    approver_email = (level_cfg.get("approver_email") or "").strip().lower()
    if approver_email:
        u = (
            db.query(ClientUser)
            .filter(ClientUser.client_id == client_id, ClientUser.email == approver_email)
            .first()
        )
        if u:
            return u.id
    approver_role = (level_cfg.get("approver_role") or "").strip().upper()
    if approver_role:
        u = (
            db.query(ClientUser)
            .filter(ClientUser.client_id == client_id, ClientUser.role == approver_role, ClientUser.is_active == True)
            .first()
        )
        if u:
            return u.id
    return None


def get_approval_step_metadata(
    db: Session,
    client_id: int,
    flow_key: str,
    current_step: int,
    total_steps: int,
    is_pending: bool,
) -> Dict[str, Any]:
    """
    Computes live sequential approval metadata for API serialization so the UI knows:
    - Which exact user (`current_approver_id`, `current_approver_name`) is allowed to approve right now
    - Full ordered `approval_levels` chain
    - Synced `total_approval_steps` if an active flow was updated
    """
    levels = get_active_flow_levels(db, client_id, flow_key)
    effective_total = len(levels) if (is_pending and len(levels) >= max(1, current_step)) else max(1, total_steps or 1)
    step_num = max(1, current_step or 1)

    current_approver_id: Optional[int] = None
    current_approver_name: Optional[str] = None
    current_approver_role: Optional[str] = None

    if is_pending and levels and step_num <= len(levels):
        lvl = levels[step_num - 1]
        current_approver_id = resolve_level_approver_user_id(db, client_id, lvl)
        current_approver_name = lvl.get("approver_name") or f"Level {step_num} Approver"
        current_approver_role = lvl.get("approver_role")

    levels_summary = [
        {
            "level": int(l.get("level", idx + 1)),
            "approver_id": resolve_level_approver_user_id(db, client_id, l),
            "approver_name": l.get("approver_name") or f"Level {idx + 1}",
            "approver_role": l.get("approver_role") or "",
        }
        for idx, l in enumerate(levels)
    ]

    return {
        "current_approval_step": step_num,
        "total_approval_steps": effective_total,
        "current_approver_id": current_approver_id,
        "current_approver_name": current_approver_name,
        "current_approver_role": current_approver_role,
        "approval_levels": levels_summary,
    }


def reconcile_record_approval_state(
    db: Session,
    client_id: int,
    flow_key: str,
    record: Any,
    reference_code: Optional[str] = None,
    item_label_override: Optional[str] = None,
) -> bool:
    """
    Guarantees strict sequential approval integrity:
    If an active Master Approval Flow exists with N levels, and a record has fewer than N approved
    steps in its history (e.g. approved step 1 of 2), it is strictly held in PENDING_INTERNAL_APPROVAL
    (step K+1 of N), preventing premature RELEASED_TO_AGENCY status, and ensures Level K+1 approver is notified!
    """
    levels = get_active_flow_levels(db, client_id, flow_key)
    if not levels:
        return False

    try:
        raw_history = getattr(record, "approval_history", None)
        history = json.loads(raw_history) if raw_history else []
        if not isinstance(history, list):
            history = []
    except Exception:
        history = []

    approved_steps = len([h for h in history if str(h.get("action", "")).upper() == "APPROVED"])
    total_levels = len(levels)

    if approved_steps < total_levels:
        needed_step = approved_steps + 1
        meta = get_flow_meta(flow_key)
        short_item = item_label_override or meta["short_item"]
        code_suffix = f" ({reference_code})" if (reference_code and reference_code not in short_item) else ""

        changed = False
        if getattr(record, "status", None) != "PENDING_INTERNAL_APPROVAL":
            record.status = "PENDING_INTERNAL_APPROVAL"
            changed = True
        if getattr(record, "current_approval_step", None) != needed_step:
            record.current_approval_step = needed_step
            changed = True
        if getattr(record, "total_approval_steps", None) != total_levels:
            record.total_approval_steps = total_levels
            changed = True

        # Ensure Level `needed_step` approver has a pending notification
        next_lvl = levels[needed_step - 1]
        next_user_id = resolve_level_approver_user_id(db, client_id, next_lvl)
        if next_user_id:
            existing_notif = (
                db.query(ClientNotification)
                .filter(
                    ClientNotification.client_id == client_id,
                    ClientNotification.user_id == next_user_id,
                    ClientNotification.target_module == meta["target_module"],
                    ClientNotification.reference_id == record.id,
                    ClientNotification.approver_level == f"Level {needed_step}",
                )
                .first()
            )
            if not existing_notif:
                create_short_notification(
                    db=db,
                    client_id=client_id,
                    recipient_user_id=next_user_id,
                    short_text=f"Approval requested for {short_item}{code_suffix} (Level {needed_step}).",
                    target_module=meta["target_module"],
                    reference_id=record.id,
                    approver_level=f"Level {needed_step}",
                )
                changed = True

        if changed:
            db.commit()
            return True
    return False


def initiate_global_approval(
    db: Session,
    client_id: int,
    flow_key: str,
    released_status: str,
    initiator_user_id: Optional[int] = None,
    initiator_name: str = "Client User",
    item_label_override: Optional[str] = None,
) -> Tuple[str, int, int, List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Initializes approval state when a new record is raised:
    - If active Master Approval Flow exists for `flow_key`:
      Returns `("PENDING_INTERNAL_APPROVAL", 1, len(levels), history, levels)`.
    - Otherwise auto-releases with `(released_status, 1, 1, history, [])`.
    Call `notify_level_1_on_create(...)` right after `db.flush()` once `record.id` is available!
    """
    levels = get_active_flow_levels(db, client_id, flow_key)
    now_iso = datetime.utcnow().isoformat()
    meta = get_flow_meta(flow_key)
    short_item = item_label_override or meta["short_item"]

    if levels:
        history = [
            {
                "step": 0,
                "action": "SUBMITTED",
                "approver_id": initiator_user_id,
                "approver_name": initiator_name,
                "role": "INITIATOR",
                "timestamp": now_iso,
                "notes": f"Submitted {short_item} for Level 1 approval.",
            }
        ]
        return "PENDING_INTERNAL_APPROVAL", 1, len(levels), history, levels
    else:
        history = [
            {
                "step": 1,
                "action": "AUTO_RELEASED",
                "approver_id": initiator_user_id,
                "approver_name": initiator_name,
                "role": "SYSTEM",
                "timestamp": now_iso,
                "notes": f"Auto-released to {meta['next_step_label']} (no approval flow configured).",
            }
        ]
        return released_status, 1, 1, history, []


def notify_level_1_on_create(
    db: Session,
    client_id: int,
    flow_key: str,
    levels: List[Dict[str, Any]],
    reference_id: int,
    reference_code: Optional[str] = None,
    item_label_override: Optional[str] = None,
) -> None:
    """
    Strictly notifies ONLY Level 1 Approver when a new item enters approval!
    Level 2+ approvers receive NOTHING until Level 1 approves.
    """
    if not levels:
        return
    meta = get_flow_meta(flow_key)
    short_item = item_label_override or meta["short_item"]
    lvl1 = levels[0]
    lvl1_user_id = resolve_level_approver_user_id(db, client_id, lvl1)
    code_suffix = f" ({reference_code})" if reference_code else ""
    short_text = f"Approval requested for {short_item}{code_suffix}."

    create_short_notification(
        db=db,
        client_id=client_id,
        recipient_user_id=lvl1_user_id,
        short_text=short_text,
        target_module=meta["target_module"],
        reference_id=reference_id,
        approver_level="Level 1",
    )


def execute_sequential_approval_step(
    db: Session,
    client_id: int,
    flow_key: str,
    current_status: str,
    current_step: int,
    total_steps: int,
    history_json: Optional[str],
    decision: str,
    acting_user_id: Optional[int],
    acting_user_name: str,
    acting_user_role: str,
    notes: Optional[str],
    reference_id: int,
    reference_code: Optional[str],
    initiator_user_id: Optional[int],
    released_status: str,
    rejected_status: str,
    item_label_override: Optional[str] = None,
) -> Tuple[str, int, int, str, bool]:
    """
    Global strict sequential multi-level approval processor:
    1. Verifies item is currently awaiting approval.
    2. STRICT SEQUENTIAL GUARD: Checks active flow's expected approver for `current_step`.
       Blocks any other user (including Level 2+ approvers!) with HTTP 403 before Level 1 approves.
    3. On APPROVE:
       - If `current_step < effective_total`: advances to `current_step + 1` and notifies ONLY Level `current_step + 1` approver.
       - If final level: sets `released_status` and notifies ONLY `initiator_user_id` that it is approved, released, and submitted to next step!
    4. On REJECT:
       - Sets `rejected_status` and notifies ONLY `initiator_user_id`.

    Returns: `(new_status, new_step, effective_total, updated_history_json, is_fully_released)`
    """
    if current_status != "PENDING_INTERNAL_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"This item is no longer pending internal approval (current status: {current_status}).",
        )

    levels = get_active_flow_levels(db, client_id, flow_key)
    step_num = max(1, current_step or 1)
    effective_total = len(levels) if (levels and len(levels) >= step_num) else max(1, total_steps or 1)

    # STRICT SEQUENTIAL APPROVER AUTHORIZATION CHECK
    if levels and step_num <= len(levels):
        expected_lvl = levels[step_num - 1]
        expected_user_id = resolve_level_approver_user_id(db, client_id, expected_lvl)
        expected_name = expected_lvl.get("approver_name") or f"Level {step_num} Approver"
        expected_role = (expected_lvl.get("approver_role") or "").strip().upper()
        approver_type = (expected_lvl.get("approver_type") or "USER").strip().upper()

        if approver_type == "USER" and expected_user_id is not None:
            if not acting_user_id or int(acting_user_id) != int(expected_user_id):
                raise HTTPException(
                    status_code=403,
                    detail=f"Sequential approval locked: Only Level {step_num} approver ({expected_name}) can act on this step.",
                )
        elif approver_type == "ROLE" and expected_role:
            if (acting_user_role or "").strip().upper() != expected_role:
                raise HTTPException(
                    status_code=403,
                    detail=f"Sequential approval locked: Only role {expected_role} can act on Level {step_num}.",
                )

    try:
        history = json.loads(history_json) if history_json else []
        if not isinstance(history, list):
            history = []
    except Exception:
        history = []

    clean_decision = (decision or "").strip().upper()
    if clean_decision not in ("APPROVE", "REJECT"):
        raise HTTPException(status_code=400, detail="Invalid decision. Allowed: APPROVE, REJECT")

    meta = get_flow_meta(flow_key)
    short_item = item_label_override or meta["short_item"]
    code_suffix = f" ({reference_code})" if reference_code else ""
    now_iso = datetime.utcnow().isoformat()

    if clean_decision == "APPROVE":
        history.append(
            {
                "step": step_num,
                "action": "APPROVED",
                "approver_id": acting_user_id,
                "approver_name": acting_user_name or "Approver",
                "role": acting_user_role or "APPROVER",
                "timestamp": now_iso,
                "notes": notes or f"Level {step_num} approved.",
            }
        )

        if step_num < effective_total:
            next_step = step_num + 1
            # Strictly notify ONLY the next sequential level approver now!
            if levels and next_step <= len(levels):
                next_lvl = levels[next_step - 1]
                next_user_id = resolve_level_approver_user_id(db, client_id, next_lvl)
                create_short_notification(
                    db=db,
                    client_id=client_id,
                    recipient_user_id=next_user_id,
                    short_text=f"Approval requested for {short_item}{code_suffix} (Level {next_step}).",
                    target_module=meta["target_module"],
                    reference_id=reference_id,
                    approver_level=f"Level {next_step}",
                )
            return "PENDING_INTERNAL_APPROVAL", next_step, effective_total, json.dumps(history), False
        else:
            # Final level approved -> Release & notify Raised User!
            if initiator_user_id:
                create_short_notification(
                    db=db,
                    client_id=client_id,
                    recipient_user_id=initiator_user_id,
                    short_text=f"Approved & released: {short_item.capitalize()}{code_suffix} submitted to {meta['next_step_label']}.",
                    target_module=meta["target_module"],
                    reference_id=reference_id,
                    approver_level="Released",
                )
            return released_status, step_num, effective_total, json.dumps(history), True

    else:
        # REJECT
        history.append(
            {
                "step": step_num,
                "action": "REJECTED",
                "approver_id": acting_user_id,
                "approver_name": acting_user_name or "Approver",
                "role": acting_user_role or "APPROVER",
                "timestamp": now_iso,
                "notes": notes or f"Rejected at Level {step_num}.",
            }
        )
        if initiator_user_id:
            create_short_notification(
                db=db,
                client_id=client_id,
                recipient_user_id=initiator_user_id,
                short_text=f"Rejected at Level {step_num}: {short_item.capitalize()}{code_suffix}.",
                target_module=meta["target_module"],
                reference_id=reference_id,
                approver_level="Rejected",
            )
        return rejected_status, step_num, effective_total, json.dumps(history), False
