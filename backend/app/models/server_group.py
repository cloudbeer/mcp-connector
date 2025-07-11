"""
Server Group related models.
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class ServerGroupBase(BaseModel):
    """Base Server Group model."""
    name: str = Field(..., max_length=100, description="Group name")
    description: Optional[str] = Field(None, description="Group description")
    max_tools: int = Field(10, ge=1, le=100, description="Maximum number of tools in this group")


class ServerGroupCreate(ServerGroupBase):
    """Server Group creation model."""
    pass


class ServerGroupUpdate(BaseModel):
    """Server Group update model."""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    max_tools: Optional[int] = Field(None, ge=1, le=100)


class ServerGroup(ServerGroupBase):
    """Server Group model."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ServerGroupResponse(BaseModel):
    """Server Group response model."""
    success: bool
    message: str
    data: Optional[ServerGroup] = None


class ServerGroupListResponse(BaseModel):
    """Server Group list response model."""
    success: bool
    message: str
    data: List[ServerGroup]
    total: int
