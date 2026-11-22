import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.client import (
    ClientCompany,
    ClientSite,
    ClientUser,
    ClientMasterData,
    WorkerDeployment,
    BiometricLog,
    TimesheetShiftRecord,
    ClientApprovalFlow,
    ClientNotification,
)
from app.models.roster import (
    ShiftRosterPlan,
    ShiftAllocationEntry,
    ShiftChangeRequest,
    WorkerDailyShift,
)
from app.models.talent import (
    JobRequisition,
    CandidateShortlist,
    InterviewSlot,
    RelocationMilestone,
)
from app.models.chat import InternalChatMessage

SUPABASE_URL = "postgresql+pg8000://postgres.fsvjbmuspbxqhasswlkb:Rishikesh%401996@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

def migrate():
    print("1. Connecting to Supabase PostgreSQL...")
    engine = create_engine(SUPABASE_URL, echo=False)
    
    print("2. Creating all schema tables in Supabase...")
    Base.metadata.create_all(bind=engine)
    print("   Tables created successfully!")
    
    Session = sessionmaker(bind=engine)
    pg_db = Session()
    
    print("3. Reading existing records from local SQLite (agency_erp.db)...")
    sq_conn = sqlite3.connect("agency_erp.db")
    sq_conn.row_factory = sqlite3.Row
    sq_cur = sq_conn.cursor()
    
    models_mapping = [
        (ClientCompany, "client_companies"),
        (ClientSite, "client_sites"),
        (ClientUser, "client_users"),
        (ClientMasterData, "client_master_data"),
        (WorkerDeployment, "worker_deployments"),
        (BiometricLog, "biometric_logs"),
        (TimesheetShiftRecord, "timesheet_shifts"),
        (JobRequisition, "job_requisitions"),
        (CandidateShortlist, "candidate_shortlists"),
        (InterviewSlot, "interview_slots"),
        (RelocationMilestone, "relocation_milestones"),
        (ShiftRosterPlan, "shift_roster_plans"),
        (ShiftAllocationEntry, "shift_allocation_entries"),
        (ShiftChangeRequest, "shift_change_requests"),
        (WorkerDailyShift, "worker_daily_shifts"),
        (InternalChatMessage, "internal_chat_messages"),
        (ClientApprovalFlow, "client_approval_flows"),
        (ClientNotification, "client_notifications"),
    ]
    
    total_migrated = 0
    for model_cls, table_name in models_mapping:
        try:
            sq_cur.execute(f"SELECT * FROM {table_name}")
            rows = sq_cur.fetchall()
            count = 0
            for row in rows:
                data = dict(row)
                pk_val = data.get("id")
                if pk_val:
                    existing = pg_db.query(model_cls).filter(model_cls.id == pk_val).first()
                    if existing:
                        continue
                obj = model_cls(**data)
                pg_db.add(obj)
                count += 1
            pg_db.commit()
            print(f"   [Migrated] {table_name}: {count} records copied")
            total_migrated += count
        except Exception as e:
            pg_db.rollback()
            print(f"   [Notice] {table_name}: {e}")
            
    print(f"\n4. MIGRATION COMPLETE! Total records migrated: {total_migrated}")
    
    # Reset postgres serial sequences
    for _, table_name in models_mapping:
        try:
            with engine.connect() as con:
                con.execute(text(f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name};"))
                con.commit()
        except:
            pass

    pg_db.close()
    sq_conn.close()

if __name__ == "__main__":
    migrate()
