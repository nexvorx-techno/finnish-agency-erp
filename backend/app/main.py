from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import Base, engine
import app.models.client
import app.models.talent
import app.models.roster
import app.models.chat
from app.api.client_routes import router as client_router
from app.api.talent_routes import router as talent_router
from app.api.roster_routes import router as roster_router
from app.api.chat_routes import router as chat_router
from app.api.invoice_routes import router as invoice_router
from app.api.operations_routes import router as operations_router

# Create database tables
Base.metadata.create_all(bind=engine)


def ensure_schema_columns() -> None:
    """
    Idempotently adds new global approval & notification routing columns
    on existing PostgreSQL / SQLite deployments without downtime.
    """
    alter_statements = [
        ("client_notifications", "target_module", "VARCHAR(100)"),
        ("client_notifications", "reference_id", "INTEGER"),
        ("client_invoices", "created_by_user_id", "INTEGER"),
        ("worker_action_requests", "current_approval_step", "INTEGER DEFAULT 1"),
        ("worker_action_requests", "total_approval_steps", "INTEGER DEFAULT 1"),
        ("worker_action_requests", "approval_history", "TEXT"),
        ("worker_action_requests", "created_by_user_id", "INTEGER"),
        ("safety_incident_logs", "current_approval_step", "INTEGER DEFAULT 1"),
        ("safety_incident_logs", "total_approval_steps", "INTEGER DEFAULT 1"),
        ("safety_incident_logs", "approval_history", "TEXT"),
        ("safety_incident_logs", "created_by_user_id", "INTEGER"),
        ("shift_roster_plans", "current_approval_step", "INTEGER DEFAULT 1"),
        ("shift_roster_plans", "total_approval_steps", "INTEGER DEFAULT 1"),
        ("shift_roster_plans", "approval_history", "TEXT"),
        ("shift_roster_plans", "created_by_user_id", "INTEGER"),
        ("shift_change_requests", "current_approval_step", "INTEGER DEFAULT 1"),
        ("shift_change_requests", "total_approval_steps", "INTEGER DEFAULT 1"),
        ("shift_change_requests", "approval_history", "TEXT"),
        ("shift_change_requests", "created_by_user_id", "INTEGER"),
    ]
    is_postgres = not settings.DATABASE_URL.startswith("sqlite")
    with engine.begin() as conn:
        for table_name, col_name, col_type in alter_statements:
            try:
                if is_postgres:
                    conn.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                    )
                else:
                    cols = [r[1] for r in conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()]
                    if col_name not in cols:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
            except Exception:
                pass


ensure_schema_columns()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(client_router)
app.include_router(talent_router)
app.include_router(roster_router)
app.include_router(chat_router)
app.include_router(invoice_router)
app.include_router(operations_router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "alv_rate": f"{settings.ALV_RATE * 100}%"
    }
