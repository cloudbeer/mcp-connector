"""
FastAPI main application for MCP Connector.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.connection import db_manager
from app.api.v1 import health


# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.app_log_level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting MCP Connector...")
    await db_manager.connect()
    logger.info("MCP Connector started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down MCP Connector...")
    await db_manager.disconnect()
    logger.info("MCP Connector shut down successfully")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="MCP (Model Context Protocol) 服务端集合管理工具",
    lifespan=lifespan,
    debug=settings.app_debug,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])

# Import and include MCP tools router
from app.api.v1 import mcp_tools
app.include_router(mcp_tools.router, prefix="/api/v1", tags=["mcp-tools"])

# Import and include API keys router
from app.api.v1 import api_keys
app.include_router(api_keys.router, prefix="/api/v1", tags=["api-keys"])

# Import and include server groups router
from app.api.v1 import server_groups
app.include_router(server_groups.router, prefix="/api/v1", tags=["server-groups"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to MCP Connector",
        "version": settings.app_version,
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug,
        log_level=settings.app_log_level.lower()
    )
