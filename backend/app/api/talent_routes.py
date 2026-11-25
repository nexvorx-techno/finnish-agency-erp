import json
from datetime import datetime, date
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
    reconcile_record_approval_state,
)
from app.models.talent import JobRequisition, CandidateShortlist, InterviewSlot, RelocationMilestone
from app.models.client import ClientSite

router = APIRouter(prefix="/api/client", tags=["Client Talent Acquisition"])


# Pydantic Schemas
class RequisitionCreateSchema(BaseModel):
    client_id: int
    site_id: int
    role_title: str
    tes_category: str
    vacancies_count: int
    experience_years_required: int = 2
    required_certifications: str = "Työturvallisuuskortti"
    shift_pattern: str = "2-vuorotyö (Day/Evening)"
    salary_range_eur_hr: str = "18.50 - 22.00 €/h"
    start_date: str  # YYYY-MM-DD
    notes: Optional[str] = None
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = "Client User"


class RequisitionApprovalDecisionSchema(BaseModel):
    decision: str  # "APPROVE" or "REJECT"
    approver_user_id: Optional[int] = None
    approver_name: Optional[str] = "Approver"
    approver_role: Optional[str] = "SITE_MANAGER"
    notes: Optional[str] = None


class InterviewScheduleSchema(BaseModel):
    shortlist_id: int
    candidate_name: str
    role_title: str
    scheduled_at: str  # ISO string or YYYY-MM-DD HH:MM
    interviewer_name: str
    meeting_link: Optional[str] = "https://meet.google.com/suomi-staff-interview"
    user_id: Optional[int] = None


class InterviewFeedbackSchema(BaseModel):
    slot_id: int
    client_rating: int
    client_feedback: str
    decision: str  # RECOMMEND_HIRE, DECLINE, SECOND_ROUND
    user_id: Optional[int] = None


def serialize_requisition(r: JobRequisition, db: Session) -> dict:
    reconcile_record_approval_state(
        db=db,
        client_id=r.client_id,
        flow_key="m1.2_req",
        record=r,
        reference_code=r.req_code,
        item_label_override=f"new work requirement ({r.req_code})",
    )
    site = db.query(ClientSite).filter(ClientSite.id == r.site_id).first()
    candidates_count = (
        db.query(CandidateShortlist)
        .filter(CandidateShortlist.requisition_id == r.id)
        .count()
    )

    try:
        history = json.loads(r.approval_history) if r.approval_history else []
    except Exception:
        history = []

    is_pending = r.status == "PENDING_INTERNAL_APPROVAL"
    step_meta = get_approval_step_metadata(
        db=db,
        client_id=r.client_id,
        flow_key="m1.2_req",
        current_step=getattr(r, "current_approval_step", 1) or 1,
        total_steps=getattr(r, "total_approval_steps", 1) or 1,
        is_pending=is_pending,
    )

    return {
        "id": r.id,
        "req_code": r.req_code,
        "client_id": r.client_id,
        "site_id": r.site_id,
        "site_name": site.site_name if site else "Main Plant",
        "site_code": site.site_code if site else "TMP-01",
        "role_title": r.role_title,
        "tes_category": r.tes_category,
        "vacancies_count": r.vacancies_count,
        "fulfilled_count": r.fulfilled_count,
        "experience_years_required": r.experience_years_required,
        "required_certifications": r.required_certifications,
        "shift_pattern": r.shift_pattern,
        "salary_range_eur_hr": r.salary_range_eur_hr,
        "start_date": r.start_date.isoformat() if r.start_date else None,
        "notes": r.notes,
        "status": r.status,
        "current_approval_step": step_meta["current_approval_step"],
        "total_approval_steps": step_meta["total_approval_steps"],
        "current_approver_id": step_meta["current_approver_id"],
        "current_approver_name": step_meta["current_approver_name"],
        "current_approver_role": step_meta["current_approver_role"],
        "approval_levels": step_meta["approval_levels"],
        "approval_history": history,
        "released_to_agency_at": r.released_to_agency_at.isoformat()
        if getattr(r, "released_to_agency_at", None)
        else None,
        "created_by_user_id": getattr(r, "created_by_user_id", None),
        "created_by_name": getattr(r, "created_by_name", "Client User") or "Client User",
        "candidates_count": candidates_count,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/{client_id}/requisitions")
def list_requisitions(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    query = db.query(JobRequisition).filter(JobRequisition.client_id == client_id)
    if allowed_ids is not None:
        query = query.filter(JobRequisition.site_id.in_(allowed_ids))

    reqs = query.order_by(JobRequisition.created_at.desc()).all()
    results = [serialize_requisition(r, db) for r in reqs]
    return {"client_id": client_id, "requisitions": results}


@router.post("/requisitions/create")
def create_requisition(payload: RequisitionCreateSchema, db: Session = Depends(get_db)):
    # Strictly verify creator can operate on target site
    assert_user_can_access_site(db, payload.client_id, payload.created_by_user_id, payload.site_id)

    count = db.query(JobRequisition).count() + 1
    req_code = f"REQ-2026-{count:03d}"
    while db.query(JobRequisition).filter(JobRequisition.req_code == req_code).first():
        count += 1
        req_code = f"REQ-2026-{count:03d}"

    try:
        parsed_start_date = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
    except Exception:
        parsed_start_date = date.today()

    initial_status, current_step, total_steps, history, levels = initiate_global_approval(
        db=db,
        client_id=payload.client_id,
        flow_key="m1.2_req",
        released_status="RELEASED_TO_AGENCY",
        initiator_user_id=payload.created_by_user_id,
        initiator_name=payload.created_by_name or "Client User",
    )
    released_at = datetime.utcnow() if initial_status == "RELEASED_TO_AGENCY" else None

    new_req = JobRequisition(
        req_code=req_code,
        client_id=payload.client_id,
        site_id=payload.site_id,
        role_title=payload.role_title,
        tes_category=payload.tes_category,
        vacancies_count=payload.vacancies_count,
        fulfilled_count=0,
        experience_years_required=payload.experience_years_required,
        required_certifications=payload.required_certifications,
        shift_pattern=payload.shift_pattern,
        salary_range_eur_hr=payload.salary_range_eur_hr,
        start_date=parsed_start_date,
        notes=payload.notes,
        status=initial_status,
        current_approval_step=current_step,
        total_approval_steps=total_steps,
        approval_history=json.dumps(history),
        released_to_agency_at=released_at,
        created_by_user_id=payload.created_by_user_id,
        created_by_name=payload.created_by_name or "Client User",
        created_at=datetime.utcnow(),
    )
    db.add(new_req)
    db.flush()

    # Notify STRICTLY Level 1 Approver ONLY (Level 2+ notified only after Level 1 approves!)
    notify_level_1_on_create(
        db=db,
        client_id=payload.client_id,
        flow_key="m1.2_req",
        levels=levels,
        reference_id=new_req.id,
        reference_code=req_code,
    )

    db.commit()
    db.refresh(new_req)
    return {
        "message": "Requisition created successfully",
        "requisition": serialize_requisition(new_req, db),
    }


@router.post("/requisitions/{req_id}/approval-decision")
def approve_requisition_step(
    req_id: int,
    payload: RequisitionApprovalDecisionSchema,
    db: Session = Depends(get_db),
):
    req = db.query(JobRequisition).filter(JobRequisition.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found")

    # Enforce site access if approver is restricted to specific site(s)
    assert_user_can_access_site(db, req.client_id, payload.approver_user_id, req.site_id)

    new_status, new_step, total_steps, updated_history, is_released = execute_sequential_approval_step(
        db=db,
        client_id=req.client_id,
        flow_key="m1.2_req",
        current_status=req.status,
        current_step=req.current_approval_step or 1,
        total_steps=req.total_approval_steps or 1,
        history_json=req.approval_history,
        decision=payload.decision,
        acting_user_id=payload.approver_user_id,
        acting_user_name=payload.approver_name or "Approver",
        acting_user_role=payload.approver_role or "SITE_MANAGER",
        notes=payload.notes,
        reference_id=req.id,
        reference_code=req.req_code,
        initiator_user_id=req.created_by_user_id,
        released_status="RELEASED_TO_AGENCY",
        rejected_status="REJECTED_INTERNAL",
    )

    req.status = new_status
    req.current_approval_step = new_step
    req.total_approval_steps = total_steps
    req.approval_history = updated_history
    if is_released:
        req.released_to_agency_at = datetime.utcnow()

    db.commit()
    db.refresh(req)
    return {
        "message": f"Requisition {payload.decision.strip().upper()} recorded",
        "status": req.status,
        "current_approval_step": req.current_approval_step,
        "total_approval_steps": req.total_approval_steps,
        "requisition": serialize_requisition(req, db),
    }


@router.get("/requisitions/{req_id}/candidates")
def get_shortlisted_candidates(
    req_id: int,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    req = db.query(JobRequisition).filter(JobRequisition.id == req_id).first()
    if req and user_id:
        assert_user_can_access_site(db, req.client_id, user_id, req.site_id)

    candidates = db.query(CandidateShortlist).filter(CandidateShortlist.requisition_id == req_id).all()
    results = []
    for c in candidates:
        interviews = db.query(InterviewSlot).filter(InterviewSlot.shortlist_id == c.id).all()
        results.append(
            {
                "id": c.id,
                "requisition_id": c.requisition_id,
                "candidate_id": c.candidate_id,
                "full_name": c.full_name,
                "current_location": c.current_location,
                "nationality": c.nationality,
                "experience_years": c.experience_years,
                "match_percentage": c.match_percentage,
                "tes_grade": c.tes_grade,
                "certifications": c.certifications,
                "language_skills": c.language_skills,
                "status": c.status,
                "summary": c.summary,
                "interviews": [
                    {
                        "id": i.id,
                        "scheduled_at": i.scheduled_at.isoformat(),
                        "meeting_link": i.meeting_link,
                        "interviewer_name": i.interviewer_name,
                        "status": i.status,
                        "client_rating": i.client_rating,
                        "client_feedback": i.client_feedback,
                        "decision": i.decision,
                    }
                    for i in interviews
                ],
            }
        )
    return {"requisition_id": req_id, "candidates": results}


@router.get("/{client_id}/interviews")
def list_client_interviews(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)

    q = (
        db.query(InterviewSlot)
        .join(CandidateShortlist, InterviewSlot.shortlist_id == CandidateShortlist.id)
        .join(JobRequisition, CandidateShortlist.requisition_id == JobRequisition.id)
        .filter(JobRequisition.client_id == client_id)
    )
    if allowed_ids is not None:
        q = q.filter(JobRequisition.site_id.in_(allowed_ids))

    interviews = q.order_by(InterviewSlot.scheduled_at.asc()).all()
    return [
        {
            "id": i.id,
            "shortlist_id": i.shortlist_id,
            "candidate_name": i.candidate_name,
            "role_title": i.role_title,
            "scheduled_at": i.scheduled_at.isoformat(),
            "meeting_link": i.meeting_link,
            "interviewer_name": i.interviewer_name,
            "status": i.status,
            "client_rating": i.client_rating,
            "client_feedback": i.client_feedback,
            "decision": i.decision,
        }
        for i in interviews
    ]


@router.post("/interviews/schedule")
def schedule_interview(payload: InterviewScheduleSchema, db: Session = Depends(get_db)):
    candidate = db.query(CandidateShortlist).filter(CandidateShortlist.id == payload.shortlist_id).first()
    if candidate and payload.user_id:
        req = db.query(JobRequisition).filter(JobRequisition.id == candidate.requisition_id).first()
        if req:
            assert_user_can_access_site(db, req.client_id, payload.user_id, req.site_id)

    try:
        dt = datetime.fromisoformat(payload.scheduled_at)
    except Exception:
        dt = datetime.utcnow()

    slot = InterviewSlot(
        shortlist_id=payload.shortlist_id,
        candidate_name=payload.candidate_name,
        role_title=payload.role_title,
        scheduled_at=dt,
        meeting_link=payload.meeting_link or "https://meet.google.com/suomi-staff-interview",
        interviewer_name=payload.interviewer_name,
        status="SCHEDULED",
        decision="PENDING",
    )
    db.add(slot)

    if candidate:
        candidate.status = "INTERVIEW_SCHEDULED"

    db.commit()
    db.refresh(slot)
    return {"message": "Interview booked successfully", "slot": slot}


@router.put("/interviews/{slot_id}/feedback")
def submit_interview_feedback(slot_id: int, payload: InterviewFeedbackSchema, db: Session = Depends(get_db)):
    slot = db.query(InterviewSlot).filter(InterviewSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Interview slot not found")

    candidate = db.query(CandidateShortlist).filter(CandidateShortlist.id == slot.shortlist_id).first()
    if candidate and payload.user_id:
        req = db.query(JobRequisition).filter(JobRequisition.id == candidate.requisition_id).first()
        if req:
            assert_user_can_access_site(db, req.client_id, payload.user_id, req.site_id)

    slot.client_rating = payload.client_rating
    slot.client_feedback = payload.client_feedback
    slot.decision = payload.decision
    slot.status = "COMPLETED"

    if candidate:
        if payload.decision == "RECOMMEND_HIRE":
            candidate.status = "OFFER_ACCEPTED"
            req = db.query(JobRequisition).filter(JobRequisition.id == candidate.requisition_id).first()
            if req:
                req.fulfilled_count = min(req.vacancies_count, req.fulfilled_count + 1)
                if req.fulfilled_count >= req.vacancies_count:
                    req.status = "FULFILLED"
                else:
                    req.status = "INTERVIEWING"
        elif payload.decision == "DECLINE":
            candidate.status = "REJECTED"

    db.commit()
    return {"message": "Feedback recorded", "decision": payload.decision}


@router.get("/{client_id}/relocation-tracker")
def list_relocation_milestones(
    client_id: int,
    site_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_ids = get_allowed_site_ids_for_user(db, client_id, user_id, site_id)
    allowed_cities: Optional[List[str]] = None
    if allowed_ids is not None:
        sites = (
            db.query(ClientSite)
            .filter(ClientSite.client_id == client_id, ClientSite.id.in_(allowed_ids))
            .all()
        )
        allowed_cities = [s.city.strip().lower() for s in sites if s.city]

    milestones = db.query(RelocationMilestone).order_by(RelocationMilestone.target_arrival_date.asc()).all()
    if allowed_cities is not None:
        milestones = [
            m for m in milestones if (m.destination_city or "").strip().lower() in allowed_cities
        ]

    return [
        {
            "id": m.id,
            "candidate_id": m.candidate_id,
            "candidate_name": m.candidate_name,
            "role_title": m.role_title,
            "origin_country": m.origin_country,
            "destination_city": m.destination_city,
            "migri_permit_status": m.migri_permit_status,
            "dvv_registered": m.dvv_registered,
            "tax_card_obtained": m.tax_card_obtained,
            "bank_account_opened": m.bank_account_opened,
            "housing_arranged": m.housing_arranged,
            "target_arrival_date": m.target_arrival_date.isoformat(),
            "plant_start_date": m.plant_start_date.isoformat(),
            "current_phase": m.current_phase,
        }
        for m in milestones
    ]
