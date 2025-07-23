# MCP Connector Backend

MCP (Model Context Protocol) 服务端集合管理工具的后端服务。

## 功能特性

- MCP 工具管理和配置
- 智能助手系统（专用助手 + 通用全域助手）
- 多平台 API 兼容（OpenAI、Gemini、Bedrock、Anthropic）
- 向量检索和意图识别
- 异步处理和健康检查

## 技术栈

- FastAPI - Web 框架
- PostgreSQL + pgvector - 数据库和向量存储
- Strands Agents SDK - MCP 集成
- asyncpg - 异步数据库驱动
- Pydantic - 数据验证

## 快速开始

```bash
# 安装依赖
uv sync

# 初始化数据库
uv run python scripts/init_db.py

# 创建管理员 API Key
uv run python scripts/create_admin_key.py

# 启动服务（后台运行）
nohup uv run uvicorn app.main:app --reload --host 0.0.0.0 > app.log 2>&1 &
```

## API 文档

启动服务后访问 http://localhost:8000/docs 查看 API 文档。
