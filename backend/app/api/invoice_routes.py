import json
from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.core.site_access import get_allowed_site_ids_for_user, assert_user_can_access_site
from app.core.approval_engine import (
    execute_sequential_approval_step,
    get_approval_step_metadata,
)
from app.models.client import ClientInvoice, ClientCompany, ClientSite, ClientApprovalFlow

router = APIRouter(prefix="/api/client", tags=["Client Invoices & Settlement"])

class InvoiceApprovalDecisionSchema(BaseModel):
    decision: str  # "APPROVE" or "REJECT"
    approver_user_id: Optional[int] = None
    approver_name: Optional[str] = "Approver"
    approver_role: Optional[str] = "PLANT_MANAGER"
    notes: Optional[str] = None

class InvoicePaymentSubmitSchema(BaseModel):
    payment_date: str  # YYYY-MM-DD
    bank_name: str
    reference_number: str  # Finnish Viitenumero
    paid_amount_eur: float
    payment_receipt_url: Optional[str] = None
    notes: Optional[str] = None
    submitted_by_name: Optional[str] = "Accounts Department"

class InvoiceCreateDemoSchema(BaseModel):
    client_id: int
    site_id: Optional[int] = None
    invoice_number: str
    billing_period_start: str
    billing_period_end: str
    total_regular_hours: float
    total_overtime_hours: float
    subtotal_eur: float
    alv_percentage: float = 25.5
    notes: Optional[str] = None


@router.get("/{client_id}/invoices")
def list_client_invoices(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns agency invoices strictly scoped to the user's assigned plant site(s).
    """
    # Ensure demo invoices exist once for the client before applying site filter
    total_client_invoices = db.query(ClientInvoice).filter(ClientInvoice.client_id == client_id).count()
    if total_client_invoices == 0:
        seed_invoices_for_client(client_id, db)

    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    query = db.query(ClientInvoice).filter(ClientInvoice.client_id == client_id)
    if allowed_ids is not None:
        query = query.filter(ClientInvoice.site_id.in_(allowed_ids))
    if status:
        query = query.filter(ClientInvoice.client_status == status)

    invoices = query.order_by(ClientInvoice.id.desc()).all()

    results = []
    for inv in invoices:
        site = db.query(ClientSite).filter(ClientSite.id == inv.site_id).first() if inv.site_id else None

        try:
            history = json.loads(inv.approval_history) if inv.approval_history else []
        except Exception:
            history = []

        try:
            items = json.loads(inv.items_breakdown_json) if inv.items_breakdown_json else []
        except Exception:
            items = []

        is_pending = inv.client_status == "PENDING_INTERNAL_APPROVAL"
        step_meta = get_approval_step_metadata(
            db=db,
            client_id=inv.client_id,
            flow_key="m1.6_invoices",
            current_step=inv.current_approval_step or 1,
            total_steps=inv.total_approval_steps or 1,
            is_pending=is_pending,
        )

        results.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "client_id": inv.client_id,
            "site_id": inv.site_id,
            "site_name": site.site_name if site else "All Plant Sites",
            "billing_period_start": inv.billing_period_start.isoformat() if inv.billing_period_start else "",
            "billing_period_end": inv.billing_period_end.isoformat() if inv.billing_period_end else "",
            "issue_date": inv.issue_date.isoformat() if inv.issue_date else "",
            "due_date": inv.due_date.isoformat() if inv.due_date else "",
            "total_regular_hours": inv.total_regular_hours,
            "total_overtime_hours": inv.total_overtime_hours,
            "subtotal_eur": inv.subtotal_eur,
            "alv_percentage": inv.alv_percentage,
            "alv_amount_eur": inv.alv_amount_eur,
            "total_amount_eur": inv.total_amount_eur,
            "currency": inv.currency,
            "agency_approval_status": inv.agency_approval_status,
            "client_status": inv.client_status,
            "current_approval_step": step_meta["current_approval_step"],
            "total_approval_steps": step_meta["total_approval_steps"],
            "current_approver_id": step_meta["current_approver_id"],
            "current_approver_name": step_meta["current_approver_name"],
            "current_approver_role": step_meta["current_approver_role"],
            "approval_levels": step_meta["approval_levels"],
            "approval_history": history,
            "items_breakdown": items,
            "notes": inv.notes,
            "payment_date": inv.payment_date.isoformat() if inv.payment_date else None,
            "bank_name": inv.bank_name,
            "reference_number": inv.reference_number,
            "paid_amount_eur": inv.paid_amount_eur,
            "payment_receipt_url": inv.payment_receipt_url,
            "payment_confirmed_at": inv.payment_confirmed_at.isoformat() if inv.payment_confirmed_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        })

    return {
        "client_id": client_id,
        "total_count": len(results),
        "invoices": results
    }


@router.post("/invoices/{invoice_id}/approval-decision")
def approve_invoice_step(
    invoice_id: int,
    payload: InvoiceApprovalDecisionSchema,
    db: Session = Depends(get_db)
):
    """
    Client internal manager sequential approval flow (global engine).
    When all internal steps approve, status advances to RELEASED_TO_ACCOUNTS.
    """
    inv = db.query(ClientInvoice).filter(ClientInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if inv.site_id and payload.approver_user_id:
        assert_user_can_access_site(db, inv.client_id, payload.approver_user_id, inv.site_id)

    new_status, new_step, total_steps, updated_history, _ = execute_sequential_approval_step(
        db=db,
        client_id=inv.client_id,
        flow_key="m1.6_invoices",
        current_status=inv.client_status,
        current_step=inv.current_approval_step or 1,
        total_steps=inv.total_approval_steps or 1,
        history_json=inv.approval_history,
        decision=payload.decision,
        acting_user_id=payload.approver_user_id,
        acting_user_name=payload.approver_name or "Manager",
        acting_user_role=payload.approver_role or "PLANT_MANAGER",
        notes=payload.notes,
        reference_id=inv.id,
        reference_code=inv.invoice_number,
        initiator_user_id=getattr(inv, "created_by_user_id", None),
        released_status="RELEASED_TO_ACCOUNTS",
        rejected_status="DISPUTED",
    )

    inv.client_status = new_status
    inv.current_approval_step = new_step
    inv.total_approval_steps = total_steps
    inv.approval_history = updated_history
    db.commit()
    db.refresh(inv)
    return {
        "message": f"Invoice {payload.decision.strip().upper()} recorded",
        "client_status": inv.client_status,
        "current_approval_step": inv.current_approval_step,
        "total_approval_steps": inv.total_approval_steps
    }


@router.post("/invoices/{invoice_id}/submit-payment")
def submit_invoice_payment(
    invoice_id: int,
    payload: InvoicePaymentSubmitSchema,
    db: Session = Depends(get_db)
):
    """
    Client Accounts updates bank payment execution details:
    - Payment Date
    - Finnish Bank Reference Number (Viitenumero)
    - Bank Name
    - Amount Paid
    Advances status to PAID_SUBMITTED and dispatches notification to Agency.
    """
    inv = db.query(ClientInvoice).filter(ClientInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        parsed_payment_date = datetime.strptime(payload.payment_date, "%Y-%m-%d").date()
    except Exception:
        parsed_payment_date = date.today()

    try:
        history = json.loads(inv.approval_history) if inv.approval_history else []
    except Exception:
        history = []

    now_iso = datetime.utcnow().isoformat()
    history.append({
        "step": inv.total_approval_steps + 1,
        "action": "PAYMENT_SUBMITTED",
        "approver_name": payload.submitted_by_name or "Client Accounts",
        "role": "ACCOUNTS",
        "timestamp": now_iso,
        "notes": f"Bank Transfer via {payload.bank_name}. Viitenumero: {payload.reference_number}. Amount: €{payload.paid_amount_eur:,.2f}",
    })

    inv.payment_date = parsed_payment_date
    inv.bank_name = payload.bank_name.strip()
    inv.reference_number = payload.reference_number.strip()
    inv.paid_amount_eur = payload.paid_amount_eur
    inv.payment_receipt_url = payload.payment_receipt_url
    inv.client_status = "PAID_SUBMITTED"
    inv.approval_history = json.dumps(history)

    db.commit()
    db.refresh(inv)
    return {
        "message": "Payment details successfully submitted to Agency Portal",
        "invoice_number": inv.invoice_number,
        "client_status": inv.client_status,
        "reference_number": inv.reference_number,
        "paid_amount_eur": inv.paid_amount_eur,
        "payment_date": inv.payment_date.isoformat(),
    }


@router.post("/invoices/{invoice_id}/agency-confirm")
def agency_confirm_invoice_payment(
    invoice_id: int,
    db: Session = Depends(get_db)
):
    """
    Agency confirms receipt of payment in bank account:
    Marks invoice as SETTLED.
    """
    inv = db.query(ClientInvoice).filter(ClientInvoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        history = json.loads(inv.approval_history) if inv.approval_history else []
    except Exception:
        history = []

    history.append({
        "step": inv.total_approval_steps + 2,
        "action": "AGENCY_CONFIRMED",
        "approver_name": "Agency Finance Desk",
        "role": "AGENCY_BILLING",
        "timestamp": datetime.utcnow().isoformat(),
        "notes": "Bank wire verified. Invoice fully settled and archived.",
    })

    inv.client_status = "SETTLED"
    inv.payment_confirmed_at = datetime.utcnow()
    inv.approval_history = json.dumps(history)

    db.commit()
    db.refresh(inv)
    return {"message": "Payment confirmed and settled by Agency", "client_status": inv.client_status}


def seed_invoices_for_client(client_id: int, db: Session):
    """Seeds initial demonstration invoices with realistic Finnish statutory ALV 25.5%"""
    site = db.query(ClientSite).filter(ClientSite.client_id == client_id).first()
    site_id = site.id if site else None

    # Invoice 1: Received & Awaiting Client Internal Approval
    inv1_subtotal = 8640.00
    inv1_alv = round(inv1_subtotal * 0.255, 2)
    inv1_total = round(inv1_subtotal + inv1_alv, 2)
    inv1 = ClientInvoice(
        invoice_number="INV-2026-0038",
        client_id=client_id,
        site_id=site_id,
        billing_period_start=date(2026, 10, 1),
        billing_period_end=date(2026, 10, 15),
        issue_date=date(2026, 10, 16),
        due_date=date(2026, 11, 15),
        total_regular_hours=320.0,
        total_overtime_hours=18.5,
        subtotal_eur=inv1_subtotal,
        alv_percentage=25.5,
        alv_amount_eur=inv1_alv,
        total_amount_eur=inv1_total,
        currency="EUR",
        agency_approval_status="APPROVED",
        client_status="PENDING_INTERNAL_APPROVAL",
        current_approval_step=1,
        total_approval_steps=2,
        approval_history=json.dumps([
            {
                "step": 0,
                "action": "AGENCY_ISSUED",
                "approver_name": "Agency Billing Manager",
                "role": "AGENCY_ADMIN",
                "timestamp": datetime(2026, 10, 16, 10, 0).isoformat(),
                "notes": "Invoice generated from biometrics & approved by Agency CEO",
            }
        ]),
        items_breakdown_json=json.dumps([
            {"role": "CNC Machinist (Fanuc)", "workers": 2, "hours": 160.0, "rate": 27.00, "total": 4320.00},
            {"role": "MIG/MAG Welder (ISO 9606-1)", "workers": 2, "hours": 160.0, "rate": 26.00, "total": 4160.00},
            {"role": "Approved TES Evening & Sunday Surcharges", "workers": 4, "hours": 18.5, "rate": 8.65, "total": 160.00},
        ]),
        notes="Valmet Technologies Oy - Production Hall 2 staffing services (Weeks 40-41)",
        created_at=datetime.utcnow() - timedelta(days=2)
    )

    # Invoice 2: Approved by Client Managers, Ready in Accounts Desk for Payment
    inv2_subtotal = 12480.00
    inv2_alv = round(inv2_subtotal * 0.255, 2)
    inv2_total = round(inv2_subtotal + inv2_alv, 2)
    inv2 = ClientInvoice(
        invoice_number="INV-2026-0029",
        client_id=client_id,
        site_id=site_id,
        billing_period_start=date(2026, 9, 15),
        billing_period_end=date(2026, 9, 30),
        issue_date=date(2026, 10, 1),
        due_date=date(2026, 10, 31),
        total_regular_hours=480.0,
        total_overtime_hours=24.0,
        subtotal_eur=inv2_subtotal,
        alv_percentage=25.5,
        alv_amount_eur=inv2_alv,
        total_amount_eur=inv2_total,
        currency="EUR",
        agency_approval_status="APPROVED",
        client_status="RELEASED_TO_ACCOUNTS",
        current_approval_step=2,
        total_approval_steps=2,
        approval_history=json.dumps([
            {
                "step": 0,
                "action": "AGENCY_ISSUED",
                "approver_name": "Agency Billing Manager",
                "role": "AGENCY_ADMIN",
                "timestamp": datetime(2026, 10, 1, 9, 0).isoformat(),
                "notes": "Agency verified & approved",
            },
            {
                "step": 1,
                "action": "APPROVED",
                "approver_name": "Heikki Härkönen",
                "role": "SITE_MANAGER",
                "timestamp": datetime(2026, 10, 3, 14, 30).isoformat(),
                "notes": "Attendance and machine hours verified",
            },
            {
                "step": 2,
                "action": "APPROVED",
                "approver_name": "Client Admin",
                "role": "CLIENT_ADMIN",
                "timestamp": datetime(2026, 10, 4, 11, 15).isoformat(),
                "notes": "Released to Accounts for corporate bank dispatch",
            }
        ]),
        items_breakdown_json=json.dumps([
            {"role": "CNC Machinist (Fanuc)", "workers": 3, "hours": 240.0, "rate": 27.00, "total": 6480.00},
            {"role": "MIG/MAG Welder (ISO 9606-1)", "workers": 3, "hours": 240.0, "rate": 25.00, "total": 6000.00},
        ]),
        notes="Valmet Technologies Oy - Main Assembly plant (Weeks 38-39)",
        created_at=datetime.utcnow() - timedelta(days=5)
    )

    # Invoice 3: Settled with Finnish Bank Viitenumero
    inv3_subtotal = 9800.00
    inv3_alv = round(inv3_subtotal * 0.255, 2)
    inv3_total = round(inv3_subtotal + inv3_alv, 2)
    inv3 = ClientInvoice(
        invoice_number="INV-2026-0015",
        client_id=client_id,
        site_id=site_id,
        billing_period_start=date(2026, 9, 1),
        billing_period_end=date(2026, 9, 14),
        issue_date=date(2026, 9, 15),
        due_date=date(2026, 10, 15),
        total_regular_hours=380.0,
        total_overtime_hours=12.0,
        subtotal_eur=inv3_subtotal,
        alv_percentage=25.5,
        alv_amount_eur=inv3_alv,
        total_amount_eur=inv3_total,
        currency="EUR",
        agency_approval_status="APPROVED",
        client_status="SETTLED",
        current_approval_step=2,
        total_approval_steps=2,
        payment_date=date(2026, 10, 10),
        bank_name="Nordea Corporate Bank",
        reference_number="284910248102941",
        paid_amount_eur=inv3_total,
        payment_confirmed_at=datetime(2026, 10, 11, 10, 20),
        approval_history=json.dumps([
            {
                "step": 0,
                "action": "AGENCY_ISSUED",
                "approver_name": "Agency Billing Manager",
                "role": "AGENCY_ADMIN",
                "timestamp": datetime(2026, 9, 15, 9, 0).isoformat(),
                "notes": "Agency verified & approved",
            },
            {
                "step": 1,
                "action": "APPROVED",
                "approver_name": "Site Manager",
                "role": "SITE_MANAGER",
                "timestamp": datetime(2026, 9, 18, 14, 0).isoformat(),
                "notes": "Approved",
            },
            {
                "step": 2,
                "action": "PAYMENT_SUBMITTED",
                "approver_name": "Accounts Desk",
                "role": "ACCOUNTS",
                "timestamp": datetime(2026, 10, 10, 15, 30).isoformat(),
                "notes": "Nordea wire transfer dispatched. Viitenumero: 284910248102941",
            },
            {
                "step": 3,
                "action": "AGENCY_CONFIRMED",
                "approver_name": "Agency Finance Desk",
                "role": "AGENCY_BILLING",
                "timestamp": datetime(2026, 10, 11, 10, 20).isoformat(),
                "notes": "Bank settlement verified. Fully settled.",
            }
        ]),
        notes="Valmet Technologies Oy - September Staffing Cycle 1",
        created_at=datetime.utcnow() - timedelta(days=12)
    )

    db.add(inv1)
    db.add(inv2)
    db.add(inv3)
    db.commit()
