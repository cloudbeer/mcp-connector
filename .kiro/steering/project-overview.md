# MCP Connector 项目概览

## 项目简介

MCP Connector 是一个基于 Model Context Protocol (MCP) 的服务端集合管理工具，提供智能助手路由和多平台API兼容功能。

## 核心架构

### 技术栈
- **后端**: FastAPI + PostgreSQL + pgvector + Strands Agents SDK
- **前端**: React 19 + TypeScript + Ant Design + Vite
- **包管理**: uv (后端) + bun (前端)
- **数据库**: PostgreSQL with pgvector extension

### 主要功能模块

1. **API Key 管理** ✅
   - 多维度权限控制
   - 助手访问控制
   - 使用统计和安全存储

2. **MCP 工具管理** ✅
   - 支持 stdio、HTTP、SSE 连接方式
   - 按服务器承载量分组管理
   - 自动健康检查和故障重试

3. **智能助手系统** 🚧
   - 专用助手：预配置特定工具集合
   - 通用全域助手：基于意图识别和向量检索

4. **多平台 API 兼容** 🚧
   - OpenAI、Gemini、Bedrock、Anthropic API 标准
   - 流式响应支持

5. **Web 管理界面** ✅
   - React + Ant Design 现代化界面
   - 响应式设计和实时数据更新

## 项目结构

```
mcp-connector/
├── backend/              # FastAPI 后端服务
│   ├── app/             # 应用核心代码
│   │   ├── api/         # API 路由层
│   │   ├── core/        # 核心业务逻辑
│   │   ├── db/          # 数据库操作层
│   │   ├── models/      # 数据模型定义
│   │   └── services/    # 服务层
│   ├── scripts/         # 工具脚本
│   └── tests/           # 测试文件
├── frontend/            # React 前端应用
│   ├── src/
│   │   ├── components/  # UI 组件
│   │   ├── pages/       # 页面组件
│   │   ├── services/    # API 服务
│   │   └── types/       # TypeScript 类型
└── plan/               # 项目规划文档
```

## 开发环境

### 后端启动
```bash
cd backend
uv sync
uv run python scripts/init_db.py
uv run uvicorn app.main:app --reload
```

### 前端启动
```bash
cd frontend
bun install
bun run dev
```

## 重要配置

### 环境变量
- 后端: `backend/.env` (数据库连接、MCP配置)
- 前端: `frontend/.env` (API地址配置)

### 示例API Key
- 管理员: `ak-130984-tdU8Rs604uqVmx-N-c2A3A`
- 助手用户: `ak-130984-5_oHlqm-iyeZFPFPEiWlZQ`

## 开发规范

项目遵循以下开发规范：
- 后端: 参考 `backend/.amazonq/rules/python.md`
- 前端: 参考 `frontend/.amazonq/rules/react.md`