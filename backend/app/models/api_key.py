"""
API Key related models.
"""
from datetime import datetime
from typing import Optional, List, Union
from enum import Enum

from pydantic import BaseModel, Field, validator

from app.utils.datetime_utils import parse_datetime


class APIKeyPermission(str, Enum):
    """API Key permission types."""
    MANAGE = "manage"  # 后台管理权限
    CALL_ASSISTANT = "call_assistant"  # 调用助手权限


class APIKeyBase(BaseModel):
    """Base API Key model."""
    name: str = Field(..., max_length=100, description="API Key 名称/描述")
    can_manage: bool = Field(default=False, description="是否能后台管理")
    can_call_assistant: bool = Field(default=True, description="是否能调用助手")
    is_disabled: bool = Field(default=False, description="是否禁用")
    created_by: Optional[str] = Field(None, max_length=100, description="创建者")
    expires_at: Optional[datetime] = Field(None, description="过期时间")
    
    @validator('expires_at', pre=True)
    def parse_expires_at(cls, v):
        """解析过期时间，确保时区一致性"""
        if v is None:
            return None
        if isinstance(v, datetime):
            # 如果已经是 datetime 对象，确保没有时区信息
            return v.replace(tzinfo=None) if v.tzinfo else v
        return parse_datetime(v)


class APIKeyCreate(APIKeyBase):
    """API Key creation model."""
    assistant_ids: Optional[List[int]] = Field(default=[], description="关联的助手ID列表")


class APIKeyUpdate(BaseModel):
    """API Key update model."""
    name: Optional[str] = Field(None, max_length=100)
    can_manage: Optional[bool] = None
    can_call_assistant: Optional[bool] = None
    is_disabled: Optional[bool] = None
    expires_at: Optional[datetime] = None
    assistant_ids: Optional[List[int]] = None
    
    @validator('expires_at', pre=True)
    def parse_expires_at(cls, v):
        """解析过期时间，确保时区一致性"""
        if v is None:
            return None
        if isinstance(v, datetime):
            # 如果已经是 datetime 对象，确保没有时区信息
            return v.replace(tzinfo=None) if v.tzinfo else v
        return parse_datetime(v)


class APIKey(APIKeyBase):
    """API Key model."""
    id: int
    key_prefix: str = Field(..., description="API Key 前缀")
    last_used_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class APIKeyWithSecret(APIKey):
    """API Key model with secret (only returned on creation)."""
    api_key: str = Field(..., description="完整的API Key")


class APIKeyAssistantBase(BaseModel):
    """Base API Key-Assistant relationship model."""
    pass


class APIKeyAssistantCreate(APIKeyAssistantBase):
    """API Key-Assistant relationship creation model."""
    api_key_id: int
    assistant_id: int


class APIKeyAssistant(APIKeyAssistantBase):
    """API Key-Assistant relationship model."""
    id: int
    api_key_id: int
    assistant_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class APIKeyUsageLogBase(BaseModel):
    """Base API Key usage log model."""
    endpoint: str = Field(..., max_length=200)
    assistant_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_size: Optional[int] = None
    response_size: Optional[int] = None
    status_code: int
    error_message: Optional[str] = None


class APIKeyUsageLogCreate(APIKeyUsageLogBase):
    """API Key usage log creation model."""
    api_key_id: int


class APIKeyUsageLog(APIKeyUsageLogBase):
    """API Key usage log model."""
    id: int
    api_key_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class APIKeyStats(BaseModel):
    """API Key statistics model."""
    total_requests: int
    successful_requests: int
    failed_requests: int
    last_used_at: Optional[datetime]
    most_used_endpoint: Optional[str]
    most_used_assistant: Optional[str]


class APIKeyListResponse(BaseModel):
    """API Key list response model."""
    success: bool
    message: str
    data: List[APIKey]
    total: int


class APIKeyResponse(BaseModel):
    """API Key response model."""
    success: bool
    message: str
    data: Optional[APIKey] = None


class APIKeyCreateResponse(BaseModel):
    """API Key creation response model."""
    success: bool
    message: str
    data: Optional[APIKeyWithSecret] = None
