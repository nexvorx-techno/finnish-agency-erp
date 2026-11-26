from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ClientLeaveRequest(Base):
    __tablename__ = "client_leave_requests"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False, index=True)
    worker_id = Column(Integer, nullable=False, index=True)
    worker_name = Column(String(255), nullable=False)
    role_title = Column(String(150), nullable=False)
    leave_type = Column(String(60), nullable=False)  # SICK_LEAVE (Sairausloma), ANNUAL_VACATION (Vuosiloma), UNPAID_LEAVE, PARENTAL_LEAVE
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Integer, default=1)
    reason = Column(Text, nullable=False)
    doctor_certificate_url = Column(String(500), nullable=True)
    doctor_certificate_verified = Column(Boolean, default=False)
    status = Column(String(40), default="PENDING")  # PENDING, APPROVED, REJECTED
    current_approval_step = Column(Integer, default=1)
    total_approval_steps = Column(Integer, default=1)
    approval_history = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    reviewed_by = Column(String(150), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClientOvertimeRequest(Base):
    __tablename__ = "client_overtime_requests"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False, index=True)
    worker_id = Column(Integer, nullable=False, index=True)
    worker_name = Column(String(255), nullable=False)
    role_title = Column(String(150), nullable=False)
    shift_date = Column(Date, nullable=False)
    planned_shift = Column(String(120), default="Morning Shift (06:00–14:30)")
    overtime_hours = Column(Float, nullable=False)
    ot_50_hours = Column(Float, default=0.0)   # First 2 hours at 50%
    ot_100_hours = Column(Float, default=0.0)  # Hours beyond 2 at 100%
    tes_rule = Column(String(150), default="Teknologiateollisuus TES - Työaikalaki 50%/100%")
    justification_reason = Column(Text, nullable=False)
    status = Column(String(40), default="PENDING")  # PENDING, APPROVED, REJECTED
    current_approval_step = Column(Integer, default=1)
    total_approval_steps = Column(Integer, default=1)
    approval_history = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    reviewed_by = Column(String(150), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class TimesheetBatch(Base):
    __tablename__ = "timesheet_batches"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False, index=True)
    batch_code = Column(String(80), unique=True, index=True, nullable=False)  # e.g. TS-2026-W48-TMP01
    week_label = Column(String(120), nullable=False)  # Week 48 (23.11 - 29.11.2026)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    total_workers = Column(Integer, default=0)
    total_regular_hours = Column(Float, default=0.0)
    total_overtime_hours = Column(Float, default=0.0)
    total_evening_hours = Column(Float, default=0.0)
    total_night_hours = Column(Float, default=0.0)
    status = Column(String(40), default="SUBMITTED_FOR_VERIFICATION")  # SUBMITTED_FOR_VERIFICATION, VERIFIED_BY_CLIENT, INVOICED
    current_approval_step = Column(Integer, default=1)
    total_approval_steps = Column(Integer, default=1)
    approval_history = Column(Text, nullable=True)
    verified_by_user_id = Column(Integer, nullable=True)
    verified_by_name = Column(String(150), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
