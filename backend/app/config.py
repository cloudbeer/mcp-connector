"""
Configuration management for MCP Connector.
"""
import os
from typing import Optional, List
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # 应用配置
    app_name: str = "MCP Connector"
    app_version: str = "0.1.0"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_debug: bool = False
    app_log_level: str = "INFO"
    
    # 数据库配置
    database_url: Optional[str] = None
    database_host: str = "localhost"
    database_port: int = 5432
    database_name: str = "mcp_connector"
    database_user: str = "postgres"
    database_password: str = ""
    
    # Strands Model Provider 配置
    model_provider: str = "openai"
    model_name: str = "gpt-4"
    
    # OpenAI 配置
    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://api.openai.com/v1"
    
    # Anthropic 配置
    anthropic_api_key: Optional[str] = None
    
    # AWS Bedrock 配置
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"
    
    # Google Gemini 配置
    google_api_key: Optional[str] = None
    
    # 服务器分组配置
    server_group: str = "default"
    
    # 向量化配置
    embedding_model: str = "text-embedding-3-small"
    embedding_dimension: int = 1536
    
    # 工具配置
    tool_timeout: int = 30
    tool_retry_count: int = 3
    tool_retry_delay: int = 5
    
    # 助手配置
    max_recalled_tools: int = 5
    intent_extraction_model: str = "gpt-4o-mini"
    
    @field_validator("database_url", mode="before")
    @classmethod
    def build_database_url(cls, v: Optional[str], info) -> str:
        """Build database URL if not provided."""
        if isinstance(v, str):
            return v
        values = info.data if hasattr(info, 'data') else {}
        return (
            f"postgresql://{values.get('database_user')}:"
            f"{values.get('database_password')}@"
            f"{values.get('database_host')}:"
            f"{values.get('database_port')}/"
            f"{values.get('database_name')}"
        )
    
    @field_validator("model_provider")
    @classmethod
    def validate_model_provider(cls, v: str) -> str:
        """Validate model provider."""
        allowed_providers = ["openai", "anthropic", "bedrock", "gemini"]
        if v not in allowed_providers:
            raise ValueError(f"Model provider must be one of: {allowed_providers}")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# 全局设置实例
settings = Settings()
