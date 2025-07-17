"""
FastAPI main application for MCP Connector.
"""
import logging
import asyncio
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

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


# Background task for agent cleanup
cleanup_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global cleanup_task
    
    # Startup
    logger.info("Starting MCP Connector...")
    await db_manager.connect()
    
    # Start agent cleanup task
    from app.core.agent_manager import cleanup_idle_agents_task
    cleanup_task = asyncio.create_task(cleanup_idle_agents_task())
    logger.info("Started agent cleanup background task")
    
    logger.info("MCP Connector started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down MCP Connector...")
    
    # Cancel cleanup task
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
    
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


# Import and include MCP servers router
from app.api.v1 import mcp_servers
app.include_router(mcp_servers.router, prefix="/api/v1", tags=["mcp-servers"])

# Import and include assistants router
from app.api.v1 import assistants
app.include_router(assistants.router, prefix="/api/v1", tags=["assistants"])

# Import and include OpenAI compatible API router
from app.api.v1 import openai_compatible
app.include_router(openai_compatible.router, tags=["openai-compatible"])

# Import and include sessions router
from app.api.v1 import sessions
app.include_router(sessions.router, prefix="/api/v1", tags=["sessions"])

# Import and include my assistants router
from app.api.v1 import my_assistants
app.include_router(my_assistants.router, prefix="/api/v1", tags=["my-assistants"])


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
