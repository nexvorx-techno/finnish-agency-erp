from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

# Create database tables
Base.metadata.create_all(bind=engine)

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

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "alv_rate": f"{settings.ALV_RATE * 100}%"
    }
