"""
Assistant related models.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from pydantic import BaseModel, Field


class AssistantType(str, Enum):
    """Assistant types."""
    DEDICATED = "dedicated"  # 专用助手，固定工具集
    UNIVERSAL = "universal"  # 通用全域助手，动态工具召回


class AssistantBase(BaseModel):
    """Base Assistant model."""
    name: str = Field(..., max_length=100, description="助手名称")
    description: Optional[str] = Field(None, description="助手描述")
    type: AssistantType = Field(default=AssistantType.DEDICATED, description="助手类型")
    intent_model: Optional[str] = Field(None, description="意图识别模型（通用助手使用）")
    max_tools: int = Field(default=5, description="最大工具数量（通用助手使用）")
    enabled: bool = Field(default=True, description="是否启用")


class AssistantCreate(AssistantBase):
    """Assistant creation model."""
    tool_ids: Optional[List[int]] = Field(default=[], description="关联的工具ID列表（专用助手使用）")


class AssistantUpdate(BaseModel):
    """Assistant update model."""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    type: Optional[AssistantType] = None
    intent_model: Optional[str] = None
    max_tools: Optional[int] = None
    enabled: Optional[bool] = None
    tool_ids: Optional[List[int]] = None


class AssistantTool(BaseModel):
    """Assistant-Tool relationship model."""
    id: int
    assistant_id: int
    tool_id: int
    priority: int
    created_at: datetime
    tool_name: Optional[str] = None
    tool_description: Optional[str] = None
    
    class Config:
        from_attributes = True


class Assistant(AssistantBase):
    """Assistant model."""
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AssistantWithTools(Assistant):
    """Assistant model with tools."""
    tools: List[Dict[str, Any]] = []
    
    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        """确保 tools 字段是一个列表"""
        if isinstance(obj, dict) and 'tools' in obj:
            if not isinstance(obj['tools'], list):
                import json
                if isinstance(obj['tools'], str):
                    try:
                        obj['tools'] = json.loads(obj['tools'])
                    except json.JSONDecodeError:
                        obj['tools'] = []
                else:
                    obj['tools'] = []
        return super().model_validate(obj, *args, **kwargs)


class AssistantListResponse(BaseModel):
    """Assistant list response model."""
    success: bool
    message: str
    data: List[Assistant]
    total: int


class AssistantResponse(BaseModel):
    """Assistant response model."""
    success: bool
    message: str
    data: Optional[AssistantWithTools] = None


class AssistantToolsResponse(BaseModel):
    """Assistant tools response model."""
    success: bool
    message: str
    data: List[Dict[str, Any]]
    total: int
