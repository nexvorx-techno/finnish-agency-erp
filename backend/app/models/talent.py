from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class JobRequisition(Base):
    __tablename__ = "job_requisitions"

    id = Column(Integer, primary_key=True, index=True)
    req_code = Column(String(50), unique=True, index=True, nullable=False)  # e.g. REQ-2026-081
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False)
    role_title = Column(String(255), nullable=False)
    tes_category = Column(String(150), nullable=False)  # e.g. Teknologiateollisuus TVR 4
    vacancies_count = Column(Integer, default=1, nullable=False)
    fulfilled_count = Column(Integer, default=0, nullable=False)
    experience_years_required = Column(Integer, default=2)
    required_certifications = Column(String(255), default="Työturvallisuuskortti")  # comma-separated
    shift_pattern = Column(String(100), default="2-vuorotyö (Day/Evening)")
    salary_range_eur_hr = Column(String(100), default="18.50 - 22.00 €/h")
    start_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="IN_SOURCING")  # IN_SOURCING, INTERVIEWING, OFFER_ACCEPTED, FULFILLED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    candidates = relationship("CandidateShortlist", back_populates="requisition", cascade="all, delete-orphan")


class CandidateShortlist(Base):
    __tablename__ = "candidate_shortlists"

    id = Column(Integer, primary_key=True, index=True)
    requisition_id = Column(Integer, ForeignKey("job_requisitions.id"), nullable=False)
    candidate_id = Column(Integer, index=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    current_location = Column(String(150), nullable=False)
    nationality = Column(String(100), default="Finnish")
    experience_years = Column(Integer, default=3)
    match_percentage = Column(Integer, default=85)  # AI Match Score %
    tes_grade = Column(String(100), nullable=False)
    certifications = Column(String(255), default="Työturvallisuuskortti")
    language_skills = Column(String(150), default="Finnish B1, English Fluent")
    status = Column(String(50), default="SHORTLISTED")  # SHORTLISTED, INTERVIEW_SCHEDULED, OFFER_ACCEPTED, REJECTED
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    requisition = relationship("JobRequisition", back_populates="candidates")
    interviews = relationship("InterviewSlot", back_populates="candidate", cascade="all, delete-orphan")


class InterviewSlot(Base):
    __tablename__ = "interview_slots"

    id = Column(Integer, primary_key=True, index=True)
    shortlist_id = Column(Integer, ForeignKey("candidate_shortlists.id"), nullable=False)
    candidate_name = Column(String(255), nullable=False)
    role_title = Column(String(255), nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    meeting_link = Column(String(255), default="https://meet.google.com/suomi-staff-interview")
    interviewer_name = Column(String(255), nullable=False)
    status = Column(String(50), default="SCHEDULED")  # SCHEDULED, COMPLETED, CANCELLED
    client_rating = Column(Integer, nullable=True)  # 1-5 rating
    client_feedback = Column(Text, nullable=True)
    decision = Column(String(50), default="PENDING")  # PENDING, RECOMMEND_HIRE, DECLINE, SECOND_ROUND

    # Relationships
    candidate = relationship("CandidateShortlist", back_populates="interviews")


class RelocationMilestone(Base):
    __tablename__ = "relocation_milestones"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, index=True, nullable=False)
    candidate_name = Column(String(255), nullable=False)
    role_title = Column(String(255), nullable=False)
    origin_country = Column(String(100), nullable=False)
    destination_city = Column(String(100), default="Tampere")
    migri_permit_status = Column(String(50), default="APPROVED")  # SUBMITTED, PROCESSING, APPROVED
    dvv_registered = Column(Boolean, default=False)  # Digi- ja väestötietovirasto
    tax_card_obtained = Column(Boolean, default=False)  # Verohallinto
    bank_account_opened = Column(Boolean, default=False)  # OP / Nordea
    housing_arranged = Column(Boolean, default=True)  # Furnished apartment
    target_arrival_date = Column(Date, nullable=False)
    plant_start_date = Column(Date, nullable=False)
    current_phase = Column(String(100), default="IMMIGRATION_APPROVED")  # IMMIGRATION_APPROVED, FLIGHT_BOOKED, ARRIVED, ONBOARDED
