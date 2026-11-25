from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ShiftRosterPlan(Base):
    __tablename__ = "shift_roster_plans"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False)
    roster_code = Column(String(60), unique=True, index=True, nullable=False)
    start_date = Column(Date, nullable=True)  # Monday of the roster week
    week_label = Column(String(120), nullable=False)
    department_line = Column(String(150), nullable=False)
    status = Column(String(40), default="DRAFT")  # DRAFT, PENDING_INTERNAL_APPROVAL, SUBMITTED_TO_AGENCY, PUBLISHED, REJECTED_INTERNAL
    total_planned_hours = Column(Float, default=0.0)
    current_approval_step = Column(Integer, default=1)
    total_approval_steps = Column(Integer, default=1)
    approval_history = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_by = Column(String(150), default="Client Admin")
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)

    allocations = relationship(
        "ShiftAllocationEntry",
        back_populates="roster",
        cascade="all, delete-orphan",
    )


class ShiftAllocationEntry(Base):
    __tablename__ = "shift_allocation_entries"

    id = Column(Integer, primary_key=True, index=True)
    roster_id = Column(Integer, ForeignKey("shift_roster_plans.id"), nullable=False)
    worker_id = Column(Integer, nullable=False)
    worker_name = Column(String(255), nullable=False)
    role_title = Column(String(150), nullable=False)
    tes_category = Column(String(150), nullable=False)

    # Shift names from Shift Schedule Master or standard codes (e.g. "Morning Shift (Aamuvuoro)", "OFF")
    mon = Column(String(120), default="Day Shift (Päivävuoro)")
    tue = Column(String(120), default="Day Shift (Päivävuoro)")
    wed = Column(String(120), default="Day Shift (Päivävuoro)")
    thu = Column(String(120), default="Day Shift (Päivävuoro)")
    fri = Column(String(120), default="Day Shift (Päivävuoro)")
    sat = Column(String(120), default="OFF")
    sun = Column(String(120), default="OFF")
    weekly_hours = Column(Float, default=37.5)

    roster = relationship("ShiftRosterPlan", back_populates="allocations")


class ShiftChangeRequest(Base):
    __tablename__ = "shift_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False)
    roster_id = Column(Integer, ForeignKey("shift_roster_plans.id"), nullable=True)
    worker_id = Column(Integer, nullable=False)
    worker_name = Column(String(255), nullable=False)
    role_title = Column(String(150), nullable=False)
    shift_date = Column(Date, nullable=False)
    day_of_week = Column(String(10), nullable=False)  # mon..sun
    current_shift = Column(String(120), nullable=False)
    requested_shift = Column(String(120), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(30), default="PENDING")  # PENDING, PENDING_INTERNAL_APPROVAL, APPROVED, REJECTED
    attendance_sync_status = Column(String(30), default="PENDING")  # PENDING, SYNCED, SYNC_FAILED
    fallback_resolution = Column(String(40), default="NONE")  # NONE, MARKED_ABSENT, TREATED_AS_OVERTIME
    current_approval_step = Column(Integer, default=1)
    total_approval_steps = Column(Integer, default=1)
    approval_history = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    reviewed_by = Column(String(150), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WorkerDailyShift(Base):
    __tablename__ = "worker_daily_shifts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False, index=True)
    worker_id = Column(Integer, nullable=False, index=True)
    worker_name = Column(String(255), nullable=False)
    role_title = Column(String(150), nullable=False)
    shift_date = Column(Date, nullable=False, index=True)
    shift_name = Column(String(120), nullable=False)  # From Shift Schedule Master or "Weekly Off"
    shift_window = Column(String(60), default="")  # e.g. "06:00–14:30"
    planned_hours = Column(Float, default=7.5)
    is_weekly_off = Column(Boolean, default=False)
    status = Column(String(40), default="DRAFT")  # DRAFT, SUBMITTED_TO_AGENCY, PUBLISHED
    assigned_by = Column(String(150), default="Client Admin")
    updated_at = Column(DateTime, default=datetime.utcnow)
