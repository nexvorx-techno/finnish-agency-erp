from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class ClientCompany(Base):
    __tablename__ = "client_companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    business_id = Column(String(20), unique=True, nullable=False)  # Finnish Y-tunnus e.g. 1234567-8
    vat_number = Column(String(30), unique=True, nullable=False)   # e.g. FI12345678
    industry = Column(String(100), nullable=False)
    billing_address = Column(String(255), nullable=False)
    postal_code = Column(String(20), nullable=False)
    city = Column(String(100), nullable=False)
    logo_url = Column(String(500), nullable=True)  # Company Logo URL / SVG
    payment_terms_days = Column(Integer, default=14)  # Standard Finnish commercial terms
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    sites = relationship("ClientSite", back_populates="company", cascade="all, delete-orphan")
    users = relationship("ClientUser", back_populates="company", cascade="all, delete-orphan")
    deployments = relationship("WorkerDeployment", back_populates="company")
    shifts = relationship("TimesheetShiftRecord", back_populates="company")
    approval_flows = relationship("ClientApprovalFlow", back_populates="company", cascade="all, delete-orphan")


class ClientSite(Base):
    __tablename__ = "client_sites"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    site_name = Column(String(255), nullable=False)
    site_code = Column(String(50), nullable=False)  # e.g. TMP-01
    city = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    postal_code = Column(String(20), nullable=False)
    tes_industry_sector = Column(String(150), nullable=False)  # Finnish TES framework
    biometric_terminal_id = Column(String(100), nullable=True)  # Terminal HW ID
    is_active = Column(Boolean, default=True)

    # Relationships
    company = relationship("ClientCompany", back_populates="sites")
    deployments = relationship("WorkerDeployment", back_populates="site")
    shifts = relationship("TimesheetShiftRecord", back_populates="site")


class ClientUser(Base):
    __tablename__ = "client_users"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    role = Column(String(50), nullable=False)  # CLIENT_ADMIN or operational role
    assigned_site_ids = Column(String(255), default="*")  # "*" or comma-separated site IDs
    password = Column(String(255), nullable=False, default="Welcome@2026")
    must_change_password = Column(Boolean, default=True)
    module_permissions = Column(Text, default="{}")  # JSON string of module -> {view,create,edit,approve}
    is_active = Column(Boolean, default=True)

    # Availability & Chat Settings
    availability_status = Column(String(50), default="OFFLINE")  # ONLINE, BUSY, LUNCH, OFF_DUTY, BREAK, OUTSIDE, NOT_AVAILABLE, OFFLINE
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    not_available_from = Column(String(50), nullable=True)  # YYYY-MM-DD HH:MM
    not_available_to = Column(String(50), nullable=True)    # YYYY-MM-DD HH:MM
    not_available_reason = Column(String(255), nullable=True)
    disappearing_messages_ttl = Column(String(50), default="OFF")  # OFF, 24H, 7D, 30D

    company = relationship("ClientCompany", back_populates="users")


class WorkerDeployment(Base):
    __tablename__ = "worker_deployments"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, index=True, nullable=False)
    worker_name = Column(String(255), nullable=False)
    worker_hetu_masked = Column(String(20), nullable=False)  # e.g. 150892-***A for privacy
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False)
    role_title = Column(String(150), nullable=False)
    tes_category = Column(String(150), nullable=False)
    client_charge_rate = Column(Float, nullable=False)  # EUR/hr billed to client
    supervisor_name = Column(String(255), nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    status = Column(String(50), default="ACTIVE")  # ACTIVE, SICK_LEAVE, ON_LEAVE, ENDED

    company = relationship("ClientCompany", back_populates="deployments")
    site = relationship("ClientSite", back_populates="deployments")


class BiometricLog(Base):
    __tablename__ = "biometric_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(100), nullable=False)
    worker_id = Column(Integer, index=True, nullable=False)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    direction = Column(String(20), nullable=False)  # CLOCK_IN, CLOCK_OUT
    verification_mode = Column(String(50), default="FACIAL_SCAN")  # FINGERPRINT, FACIAL_SCAN, RFID_CARD
    raw_payload = Column(Text, nullable=True)


class TimesheetShiftRecord(Base):
    __tablename__ = "timesheet_shifts"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, index=True, nullable=False)
    worker_name = Column(String(255), nullable=False)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("client_sites.id"), nullable=False)
    shift_date = Column(Date, nullable=False, default=date.today)
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)
    regular_hours = Column(Float, default=0.0)
    break_minutes = Column(Integer, default=30)  # Standard 30 min unpaid meal break
    evening_hours = Column(Float, default=0.0)    # Iltalisä (TES)
    night_hours = Column(Float, default=0.0)      # Yölisä (TES)
    overtime_50_hours = Column(Float, default=0.0)
    overtime_100_hours = Column(Float, default=0.0)
    status = Column(String(50), default="ON_DUTY")  # ON_DUTY, CLOCKED_OUT, ABSENT, SICK_REPORTED
    supervisor_override_hours = Column(Float, nullable=True)
    supervisor_override_reason = Column(String(255), nullable=True)
    supervisor_override_by = Column(String(255), nullable=True)
    last_biometric_punch = Column(DateTime, nullable=True)

    company = relationship("ClientCompany", back_populates="shifts")
    site = relationship("ClientSite", back_populates="shifts")


class ClientMasterData(Base):
    __tablename__ = "client_master_data"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    category = Column(String(100), nullable=False)  # "job_titles", "machine_types", "cnc_controllers", "materials", "certifications", "measuring_tools"
    item_value = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ClientApprovalFlow(Base):
    __tablename__ = "client_approval_flows"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    flow_key = Column(String(100), nullable=False, index=True)
    flow_name = Column(String(200), nullable=False)
    description = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    levels_json = Column(Text, default="[]")  # JSON array of ApprovalLevel objects
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company = relationship("ClientCompany", back_populates="approval_flows")


class ClientNotification(Base):
    __tablename__ = "client_notifications"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("client_companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("client_users.id"), nullable=True)  # Target recipient approver
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="APPROVAL_FLOW")
    approval_type = Column(String(100), nullable=True)  # e.g. "Invoice"
    approver_level = Column(String(50), nullable=True)  # e.g. "Level 1"
    next_level_approver = Column(String(200), nullable=True)  # e.g. "Client Admin"
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


