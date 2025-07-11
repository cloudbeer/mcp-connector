"""
Health check endpoints.
"""
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.db.connection import db_manager

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: datetime
    version: str
    database: str
    server_group: str


class DetailedHealthResponse(BaseModel):
    """Detailed health check response model."""
    status: str
    timestamp: datetime
    version: str
    database: Dict[str, Any]
    configuration: Dict[str, Any]


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint."""
    try:
        # Test database connection
        await db_manager.fetch_val("SELECT 1")
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"
    
    return HealthResponse(
        status="healthy" if db_status == "healthy" else "unhealthy",
        timestamp=datetime.utcnow(),
        version=settings.app_version,
        database=db_status,
        server_group=settings.server_group
    )


@router.get("/health/detailed", response_model=DetailedHealthResponse)
async def detailed_health_check():
    """Detailed health check endpoint."""
    try:
        # Test database connection and get info
        db_version = await db_manager.fetch_val("SELECT version()")
        db_status = {
            "status": "healthy",
            "version": db_version,
            "url": settings.database_url.split("@")[-1] if "@" in settings.database_url else "unknown"
        }
    except Exception as e:
        db_status = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    config_info = {
        "model_provider": settings.model_provider,
        "model_name": settings.model_name,
        "server_group": settings.server_group,
        "embedding_model": settings.embedding_model,
        "max_recalled_tools": settings.max_recalled_tools
    }
    
    overall_status = "healthy" if db_status["status"] == "healthy" else "unhealthy"
    
    return DetailedHealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow(),
        version=settings.app_version,
        database=db_status,
        configuration=config_info
    )


@router.get("/health/ready")
async def readiness_check():
    """Readiness check endpoint."""
    try:
        # Check database connection
        await db_manager.fetch_val("SELECT 1")
        
        # Check if required tables exist
        tables_query = """
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name IN 
            ('server_group', 'mcp_tool', 'assistant', 'tool_status')
        """
        tables = await db_manager.fetch_all(tables_query)
        
        if len(tables) < 4:
            raise HTTPException(
                status_code=503,
                detail="Database tables not ready"
            )
        
        return {"status": "ready", "timestamp": datetime.utcnow()}
        
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service not ready: {str(e)}"
        )


@router.get("/health/live")
async def liveness_check():
    """Liveness check endpoint."""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow(),
        "version": settings.app_version
    }
