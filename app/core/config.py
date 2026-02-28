import os
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "Document Automation System"
    API_V1_STR: str = "/api/v1"
    
    # MySQL Configuration
    MYSQL_HOST: str = "localhost"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "docuser"
    MYSQL_PASSWORD: str = "docpass123"
    MYSQL_DATABASE: str = "doc_automation"
    
    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DATABASE}?charset=utf8mb4"
    
    # Auth Configuration
    JWT_SECRET_KEY: str = "doc_auto_jwt_secret_2026_xK9mN3pQ"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 480  # 8 hours
    API_KEY: str = "Test_apikey_doc_automation_2026"
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Storage Configuration
    STORAGE_BUCKET: str = "documents"
    
    # Local storage path
    LOCAL_STORAGE_PATH: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage")
    
    model_config = {
        "case_sensitive": True,
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
