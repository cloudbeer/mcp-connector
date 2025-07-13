"""
MCP Tool related models.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field


class ConnectionType(str, Enum):
    """Connection type for MCP tools."""
    STDIO = "stdio"
    HTTP = "http"
    SSE = "sse"


class MCPToolBase(BaseModel):
    """Base MCP Tool model."""
    name: str = Field(..., max_length=100, description="Tool name")
    description: Optional[str] = Field(None, description="Tool description")
    connection_type: ConnectionType = Field(..., description="Connection type")
    command: Optional[str] = Field(None, description="Command to execute")
    args: Optional[List[str]] = Field(None, description="Command arguments")
    env: Optional[Dict[str, str]] = Field(None, description="Environment variables")
    url: Optional[str] = Field(None, description="URL for HTTP/SSE connections")
    headers: Optional[Dict[str, str]] = Field(None, description="HTTP headers")
    timeout: int = Field(30, ge=1, le=300, description="Connection timeout in seconds")
    retry_count: int = Field(3, ge=0, le=10, description="Number of retries")
    retry_delay: int = Field(5, ge=1, le=60, description="Delay between retries in seconds")
    disabled: bool = Field(False, description="Whether the tool is disabled")
    auto_approve: Optional[List[str]] = Field(None, description="Auto-approve actions")
    enabled: bool = Field(True, description="Whether the tool is enabled")


class MCPToolCreate(MCPToolBase):
    """MCP Tool creation model."""
    group_ids: Optional[List[int]] = Field(None, description="Server group IDs")


class MCPToolUpdate(BaseModel):
    """MCP Tool update model."""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    connection_type: Optional[ConnectionType] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    env: Optional[Dict[str, str]] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    timeout: Optional[int] = Field(None, ge=1, le=300)
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    retry_delay: Optional[int] = Field(None, ge=1, le=60)
    disabled: Optional[bool] = None
    auto_approve: Optional[List[str]] = None
    enabled: Optional[bool] = None
    group_ids: Optional[List[int]] = Field(None, description="Server group IDs")


class ServerGroupInfo(BaseModel):
    """Server group information for tool."""
    id: int
    name: str
    description: Optional[str]
    max_tools: int


class MCPTool(MCPToolBase):
    """MCP Tool model."""
    id: int
    created_at: datetime
    updated_at: datetime
    groups: Optional[List[ServerGroupInfo]] = Field(default_factory=list, description="Associated server groups")
    
    class Config:
        from_attributes = True


class MCPToolResponse(BaseModel):
    """MCP Tool response model."""
    success: bool
    message: str
    data: Optional[MCPTool] = None


class MCPToolListResponse(BaseModel):
    """MCP Tool list response model."""
    success: bool
    message: str
    data: List[MCPTool]
    total: int
