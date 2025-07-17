# 开发标准和最佳实践

## 代码规范

### Python 后端规范
- 使用 FastAPI 异步编程模式
- 遵循 PEP 8 代码风格
- 使用 Black 进行代码格式化
- 使用 mypy 进行类型检查
- 使用 Pydantic 进行数据验证

### TypeScript 前端规范
- 使用严格的 TypeScript 配置
- 遵循 Ant Design 设计规范
- 使用 Prettier 进行代码格式化
- 使用 ESLint 进行代码检查
- 组件使用函数式组件和 Hooks

## 项目结构规范

### 后端结构
```
backend/app/
├── api/v1/              # API 路由版本化
├── core/                # 核心业务逻辑
├── db/                  # 数据库操作层
├── models/              # Pydantic 数据模型
├── services/            # 业务服务层
└── utils/               # 工具函数
```

### 前端结构
```
frontend/src/
├── components/          # 可复用组件
│   ├── common/         # 通用组件
│   ├── forms/          # 表单组件
│   └── layout/         # 布局组件
├── pages/              # 页面组件
├── services/           # API 服务
├── types/              # TypeScript 类型
├── hooks/              # 自定义 Hooks
└── constants/          # 常量定义
```

## 数据库规范

### 表命名
- 使用单数形式：`mcp_tool`, `assistant`, `api_key`
- 使用下划线分隔：`server_group`, `tool_status`

### 字段命名
- 主键统一使用 `id`
- 外键使用 `{table}_id` 格式
- 时间字段使用 `created_at`, `updated_at`
- 布尔字段使用 `is_` 或 `has_` 前缀

## API 设计规范

### RESTful API
- 使用标准 HTTP 方法：GET, POST, PUT, DELETE
- 使用复数形式的资源名：`/api/v1/assistants`
- 使用嵌套资源：`/api/v1/assistants/{id}/tools`

### 响应格式
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### 错误处理
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": {}
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## 测试规范

### 后端测试
- 使用 pytest 进行单元测试
- API 测试使用 FastAPI TestClient
- 数据库测试使用事务回滚
- 测试覆盖率目标 > 80%

### 前端测试
- 组件测试使用 React Testing Library
- API 服务测试使用 Mock
- E2E 测试使用 Playwright（规划中）

## 安全规范

### API 安全
- 所有 API 需要 API Key 认证
- 敏感数据使用哈希存储
- 输入数据严格验证
- 错误信息不暴露内部细节

### 数据安全
- API Key 使用 SHA-256 哈希存储
- 数据库连接使用环境变量
- 敏感配置不提交到版本控制

## 性能规范

### 后端性能
- 数据库查询使用索引优化
- 异步处理长时间操作
- 使用连接池管理数据库连接
- API 响应时间 < 500ms

### 前端性能
- 组件懒加载
- API 请求使用 React Query 缓存
- 图片和静态资源优化
- 页面加载时间 < 3s

## 部署规范

### 环境配置
- 开发环境：本地开发，使用 .env 文件
- 测试环境：Docker 容器化部署
- 生产环境：容器化部署 + 环境变量注入

### 版本管理
- 使用语义化版本：MAJOR.MINOR.PATCH
- Git 分支策略：main/develop/feature
- 提交信息格式：type(scope): description