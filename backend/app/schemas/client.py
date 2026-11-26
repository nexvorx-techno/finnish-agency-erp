from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field

# Auth Schemas
class ClientLoginRequest(BaseModel):
    email: str = Field(..., description="Client work email")
    password: str = Field(..., description="Access password or PIN")

class ClientLoginResponse(BaseModel):
    user_id: int
    full_name: str
    username: Optional[str] = None
    email: str
    role: str
    client_id: int
    client_name: str
    assigned_site_ids: str
    must_change_password: bool = False
    module_permissions: str = "{}"
    token: str
    avatar_url: Optional[str] = None

# Client Site Schemas
class ClientSiteBase(BaseModel):
    site_name: str
    site_code: str
    city: str
    address: str
    postal_code: str
    tes_industry_sector: str
    biometric_terminal_id: Optional[str] = None
    is_active: bool = True

class ClientSiteOut(ClientSiteBase):
    id: int
    client_id: int

    class Config:
        from_attributes = True

# Client Company Schemas
class ClientCompanyOut(BaseModel):
    id: int
    name: str
    business_id: str
    vat_number: str
    industry: str
    billing_address: str
    postal_code: str
    city: str
    logo_url: Optional[str] = None
    payment_terms_days: int
    is_active: bool
    sites: List[ClientSiteOut] = []

    class Config:
        from_attributes = True

# Worker Deployment Schemas
class WorkerDeploymentOut(BaseModel):
    id: int
    worker_id: int
    worker_name: str
    worker_hetu_masked: str
    client_id: int
    site_id: int
    site_name: Optional[str] = None
    role_title: str
    tes_category: str
    client_charge_rate: float
    supervisor_name: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    status: str

    class Config:
        from_attributes = True

# Biometric Ingestion & Sync Schemas
class BiometricSyncRequest(BaseModel):
    device_id: str = Field(..., description="Hardware terminal identifier")
    worker_id: int = Field(..., description="Worker ID registered in terminal")
    site_id: int = Field(..., description="Client site where terminal is installed")
    timestamp: datetime = Field(..., description="Hardware UTC/Local ISO timestamp")
    direction: str = Field(..., description="CLOCK_IN or CLOCK_OUT")
    verification_mode: str = Field("FACIAL_SCAN", description="FINGERPRINT, FACIAL_SCAN, RFID_CARD")
    raw_payload: Optional[str] = None

class BiometricLogOut(BaseModel):
    id: int
    device_id: str
    worker_id: int
    site_id: int
    timestamp: datetime
    direction: str
    verification_mode: str

    class Config:
        from_attributes = True

# Shift Record & Supervisor Adjustments
class TimesheetShiftOut(BaseModel):
    id: int
    worker_id: int
    worker_name: str
    client_id: int
    site_id: int
    site_name: Optional[str] = None
    shift_date: date
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    regular_hours: float
    break_minutes: int
    evening_hours: float
    night_hours: float
    overtime_50_hours: float
    overtime_100_hours: float
    status: str
    supervisor_override_hours: Optional[float] = None
    supervisor_override_reason: Optional[str] = None
    supervisor_override_by: Optional[str] = None
    last_biometric_punch: Optional[datetime] = None

    class Config:
        from_attributes = True

class SupervisorAdjustmentRequest(BaseModel):
    shift_id: int
    supervisor_name: str
    adjusted_regular_hours: float
    adjusted_break_minutes: Optional[int] = 30
    reason: str = Field(..., min_length=5, description="Auditable justification for manual adjustment (e.g. terminal offline, forgotten punch)")

# Live Workforce Dashboard Summary
class LiveWorkerItem(BaseModel):
    worker_id: int
    worker_name: str
    site_id: int
    site_name: str
    role_title: str
    tes_category: str
    status: str  # ON_DUTY, ON_BREAK, SCHEDULED, SICK_LEAVE, ABSENT
    clock_in_time: Optional[datetime] = None
    last_punch_type: Optional[str] = None
    last_punch_time: Optional[datetime] = None
    shift_hours_so_far: float = 0.0

class LiveWorkforceSummary(BaseModel):
    client_id: int
    client_name: str
    total_deployed_headcount: int
    currently_on_duty: int
    on_scheduled_break: int
    reported_absent_or_sick: int
    sites_count: int
    sites: List[ClientSiteOut]
    workers: List[LiveWorkerItem]

# Master Approval Flow Schemas
class ApprovalLevelConfig(BaseModel):
    level: int
    level_name: str
    approver_type: str = "USER"  # "USER" or "ROLE"
    approver_id: Optional[int] = None
    approver_name: str
    approver_email: Optional[str] = None
    approver_role: Optional[str] = None
    sla_hours: int = 24
    is_mandatory: bool = True
    auto_escalate: bool = False

class ClientApprovalFlowPayload(BaseModel):
    flow_key: str
    flow_name: str
    description: Optional[str] = None
    is_active: bool = True
    levels: List[ApprovalLevelConfig]

class ClientApprovalFlowOut(BaseModel):
    id: int
    client_id: int
    flow_key: str
    flow_name: str
    description: Optional[str] = None
    is_active: bool
    levels: List[ApprovalLevelConfig]
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Notification Schema
class ClientNotificationOut(BaseModel):
    id: int
    client_id: int
    user_id: Optional[int] = None
    title: str
    message: str
    notification_type: str
    approval_type: Optional[str] = None
    approver_level: Optional[str] = None
    next_level_approver: Optional[str] = None
    target_module: Optional[str] = None
    reference_id: Optional[int] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


