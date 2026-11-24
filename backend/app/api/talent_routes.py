import json
from datetime import datetime, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.talent import JobRequisition, CandidateShortlist, InterviewSlot, RelocationMilestone
from app.models.client import ClientSite, ClientApprovalFlow

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
    approver_name: Optional[str] = "Site Manager"
    approver_role: Optional[str] = "SITE_MANAGER"
    notes: Optional[str] = None

class InterviewScheduleSchema(BaseModel):
    shortlist_id: int
    candidate_name: str
    role_title: str
    scheduled_at: str  # ISO string or YYYY-MM-DD HH:MM
    interviewer_name: str
    meeting_link: Optional[str] = "https://meet.google.com/suomi-staff-interview"

class InterviewFeedbackSchema(BaseModel):
    slot_id: int
    client_rating: int
    client_feedback: str
    decision: str  # RECOMMEND_HIRE, DECLINE, SECOND_ROUND


@router.get("/{client_id}/requisitions")
def list_requisitions(
    client_id: int,
    site_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(JobRequisition).filter(JobRequisition.client_id == client_id)
    if site_id:
        query = query.filter(JobRequisition.site_id == site_id)
    
    reqs = query.order_by(JobRequisition.created_at.desc()).all()
    
    results = []
    for r in reqs:
        site = db.query(ClientSite).filter(ClientSite.id == r.site_id).first()
        candidates_count = db.query(CandidateShortlist).filter(CandidateShortlist.requisition_id == r.id).count()

        try:
            history = json.loads(r.approval_history) if r.approval_history else []
        except Exception:
            history = []

        results.append({
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
            "current_approval_step": getattr(r, "current_approval_step", 1) or 1,
            "total_approval_steps": getattr(r, "total_approval_steps", 1) or 1,
            "approval_history": history,
            "released_to_agency_at": r.released_to_agency_at.isoformat() if getattr(r, "released_to_agency_at", None) else None,
            "created_by_name": getattr(r, "created_by_name", "Client User") or "Client User",
            "candidates_count": candidates_count,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return {"client_id": client_id, "requisitions": results}


@router.post("/requisitions/create")
def create_requisition(payload: RequisitionCreateSchema, db: Session = Depends(get_db)):
    # Generate unique req_code
    count = db.query(JobRequisition).count() + 1
    req_code = f"REQ-2026-{count:03d}"
    
    try:
        parsed_start_date = datetime.strptime(payload.start_date, "%Y-%m-%d").date()
    except Exception:
        parsed_start_date = date.today()

    # Check if ClientApprovalFlow is configured for "m1.2_req"
    approval_flow = db.query(ClientApprovalFlow).filter(
        ClientApprovalFlow.client_id == payload.client_id,
        ClientApprovalFlow.flow_key == "m1.2_req",
        ClientApprovalFlow.is_active == True,
    ).first()

    levels = []
    if approval_flow and approval_flow.levels_json:
        try:
            levels = json.loads(approval_flow.levels_json)
        except Exception:
            levels = []

    now_iso = datetime.utcnow().isoformat()
    if levels and len(levels) > 0:
        initial_status = "PENDING_INTERNAL_APPROVAL"
        total_steps = len(levels)
        history = [
            {
                "step": 0,
                "action": "CREATED",
                "approver_name": payload.created_by_name or "Client User",
                "role": "INITIATOR",
                "timestamp": now_iso,
                "notes": "Worker requirement submitted for internal approvals",
            }
        ]
        released_at = None
    else:
        # If no internal approval steps configured, release directly to agency
        initial_status = "RELEASED_TO_AGENCY"
        total_steps = 1
        history = [
            {
                "step": 1,
                "action": "AUTO_RELEASED",
                "approver_name": payload.created_by_name or "Client Admin",
                "role": "CLIENT_ADMIN",
                "timestamp": now_iso,
                "notes": "Requirement auto-released to Agency Portal",
            }
        ]
        released_at = datetime.utcnow()

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
        current_approval_step=1,
        total_approval_steps=total_steps,
        approval_history=json.dumps(history),
        released_to_agency_at=released_at,
        created_by_user_id=payload.created_by_user_id,
        created_by_name=payload.created_by_name or "Client User",
        created_at=datetime.utcnow()
    )
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return {"message": "Requisition created successfully", "requisition": new_req}


@router.post("/requisitions/{req_id}/approval-decision")
def approve_requisition_step(
    req_id: int,
    payload: RequisitionApprovalDecisionSchema,
    db: Session = Depends(get_db)
):
    req = db.query(JobRequisition).filter(JobRequisition.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requisition not found")

    try:
        history = json.loads(req.approval_history) if req.approval_history else []
    except Exception:
        history = []

    decision = payload.decision.strip().upper()
    now_iso = datetime.utcnow().isoformat()

    if decision == "APPROVE":
        history.append({
            "step": req.current_approval_step,
            "action": "APPROVED",
            "approver_id": payload.approver_user_id,
            "approver_name": payload.approver_name or "Approver",
            "role": payload.approver_role or "SITE_MANAGER",
            "timestamp": now_iso,
            "notes": payload.notes or "Approved",
        })
        if req.current_approval_step < req.total_approval_steps:
            req.current_approval_step += 1
            # Status stays PENDING_INTERNAL_APPROVAL
        else:
            # All client internal approvals released! Requisition crosses to Agency Portal
            req.status = "RELEASED_TO_AGENCY"
            req.released_to_agency_at = datetime.utcnow()
    elif decision == "REJECT":
        history.append({
            "step": req.current_approval_step,
            "action": "REJECTED",
            "approver_id": payload.approver_user_id,
            "approver_name": payload.approver_name or "Approver",
            "role": payload.approver_role or "SITE_MANAGER",
            "timestamp": now_iso,
            "notes": payload.notes or "Rejected in internal review",
        })
        req.status = "REJECTED_INTERNAL"
    else:
        raise HTTPException(status_code=400, detail="Invalid decision. Allowed: APPROVE, REJECT")

    req.approval_history = json.dumps(history)
    db.commit()
    db.refresh(req)
    return {
        "message": f"Requisition {decision} recorded",
        "status": req.status,
        "current_approval_step": req.current_approval_step,
        "total_approval_steps": req.total_approval_steps
    }


@router.get("/requisitions/{req_id}/candidates")
def get_shortlisted_candidates(req_id: int, db: Session = Depends(get_db)):
    candidates = db.query(CandidateShortlist).filter(CandidateShortlist.requisition_id == req_id).all()
    results = []
    for c in candidates:
        interviews = db.query(InterviewSlot).filter(InterviewSlot.shortlist_id == c.id).all()
        results.append({
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
                    "decision": i.decision
                } for i in interviews
            ]
        })
    return {"requisition_id": req_id, "candidates": results}


@router.get("/{client_id}/interviews")
def list_client_interviews(client_id: int, db: Session = Depends(get_db)):
    # Join CandidateShortlist and JobRequisition to filter by client_id
    interviews = (
        db.query(InterviewSlot)
        .join(CandidateShortlist, InterviewSlot.shortlist_id == CandidateShortlist.id)
        .join(JobRequisition, CandidateShortlist.requisition_id == JobRequisition.id)
        .filter(JobRequisition.client_id == client_id)
        .order_by(InterviewSlot.scheduled_at.asc())
        .all()
    )
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
            "decision": i.decision
        } for i in interviews
    ]


@router.post("/interviews/schedule")
def schedule_interview(payload: InterviewScheduleSchema, db: Session = Depends(get_db)):
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
        decision="PENDING"
    )
    db.add(slot)
    
    # Update candidate status
    candidate = db.query(CandidateShortlist).filter(CandidateShortlist.id == payload.shortlist_id).first()
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

    slot.client_rating = payload.client_rating
    slot.client_feedback = payload.client_feedback
    slot.decision = payload.decision
    slot.status = "COMPLETED"

    # If hired, update candidate status
    candidate = db.query(CandidateShortlist).filter(CandidateShortlist.id == slot.shortlist_id).first()
    if candidate:
        if payload.decision == "RECOMMEND_HIRE":
            candidate.status = "OFFER_ACCEPTED"
            # Update requisition fulfilled count
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
def list_relocation_milestones(client_id: int, db: Session = Depends(get_db)):
    milestones = db.query(RelocationMilestone).order_by(RelocationMilestone.target_arrival_date.asc()).all()
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
            "current_phase": m.current_phase
        } for m in milestones
    ]
