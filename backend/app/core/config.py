import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "RekrySilta ERP - Client Portal API"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+pg8000://postgres.fsvjbmuspbxqhasswlkb:Rishikesh%401996@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
    )
    ALV_RATE: float = 0.255  # Finnish statutory ALV rate 25.5% as of Sept 1, 2024
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
