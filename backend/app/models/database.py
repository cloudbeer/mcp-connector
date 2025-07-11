"""
Database models using Pydantic.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field


class ConnectionType(str, Enum):
    """MCP connection types."""
    STDIO = "stdio"
    HTTP = "http"
    SSE = "sse"


class ToolStatus(str, Enum):
    """Tool status types."""
    RUNNING = "running"
    STOPPED = "stopped"
    FAILED = "failed"
    STARTING = "starting"


class AssistantType(str, Enum):
    """Assistant types."""
    DEDICATED = "dedicated"
    UNIVERSAL = "universal"


class ServerGroupBase(BaseModel):
    """Base server group model."""
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    max_tools: int = Field(default=10, ge=1)


class ServerGroupCreate(ServerGroupBase):
    """Server group creation model."""
    pass


class ServerGroup(ServerGroupBase):
    """Server group model."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class MCPToolBase(BaseModel):
    """Base MCP tool model."""
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    connection_type: ConnectionType
    
    # stdio configuration
    command: Optional[str] = Field(None, max_length=500)
    args: Optional[List[str]] = None
    env: Optional[Dict[str, str]] = None  # 环境变量
    
    # http/sse configuration
    url: Optional[str] = Field(None, max_length=500)
    headers: Optional[Dict[str, str]] = None
    
    # common configuration
    timeout: int = Field(default=30, ge=1)
    retry_count: int = Field(default=3, ge=0)
    retry_delay: int = Field(default=5, ge=1)
    disabled: bool = False  # 是否禁用
    auto_approve: Optional[List[str]] = None  # 自动批准的操作列表
    
    enabled: bool = True


class MCPToolCreate(MCPToolBase):
    """MCP tool creation model."""
    group_id: int


class MCPTool(MCPToolBase):
    """MCP tool model."""
    id: int
    group_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ToolStatusBase(BaseModel):
    """Base tool status model."""
    status: ToolStatus
    error_message: Optional[str] = None
    retry_count: int = Field(default=0, ge=0)


class ToolStatusCreate(ToolStatusBase):
    """Tool status creation model."""
    tool_id: int


class ToolStatusRecord(ToolStatusBase):
    """Tool status record model."""
    id: int
    tool_id: int
    last_health_check: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AssistantBase(BaseModel):
    """Base assistant model."""
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    type: AssistantType
    
    # Universal assistant configuration
    intent_model: Optional[str] = Field(None, max_length=100)
    max_tools: int = Field(default=5, ge=1, le=10)
    
    enabled: bool = True


class AssistantCreate(AssistantBase):
    """Assistant creation model."""
    pass


class Assistant(AssistantBase):
    """Assistant model."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AssistantToolBase(BaseModel):
    """Base assistant-tool relationship model."""
    priority: int = Field(default=1, ge=1)


class AssistantToolCreate(AssistantToolBase):
    """Assistant-tool relationship creation model."""
    assistant_id: int
    tool_id: int


class AssistantTool(AssistantToolBase):
    """Assistant-tool relationship model."""
    id: int
    assistant_id: int
    tool_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ToolVectorBase(BaseModel):
    """Base tool vector model."""
    content: str
    model_name: str = Field(..., max_length=100)


class ToolVectorCreate(ToolVectorBase):
    """Tool vector creation model."""
    tool_id: int
    embedding: List[float]


class ToolVector(ToolVectorBase):
    """Tool vector model."""
    id: int
    tool_id: int
    embedding: List[float]
    created_at: datetime
    
    class Config:
        from_attributes = True
