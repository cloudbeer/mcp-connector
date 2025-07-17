# 部署指南

## 部署环境要求

### 系统要求
- **操作系统**: Linux (Ubuntu 20.04+ 推荐) 或 macOS
- **Python**: 3.10 或更高版本
- **Node.js**: 18+ 或 Bun
- **数据库**: PostgreSQL 14+ (需要 pgvector 扩展)
- **内存**: 最少 2GB，推荐 4GB+
- **存储**: 最少 10GB 可用空间

### 依赖服务
- PostgreSQL 数据库服务
- Redis (可选，用于缓存)
- Nginx (生产环境反向代理)

## 开发环境部署

### 1. 环境准备

#### 安装 Python 包管理器 uv
```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# 或使用 pip
pip install uv
```

#### 安装 Bun (前端)
```bash
# macOS/Linux
curl -fsSL https://bun.sh/install.sh | bash

# 或使用 npm
npm install -g bun
```

#### 安装 PostgreSQL 和 pgvector
```bash
# Ubuntu
sudo apt update
sudo apt install postgresql postgresql-contrib postgresql-14-pgvector

# macOS (使用 Homebrew)
brew install postgresql pgvector

# 启动 PostgreSQL
sudo systemctl start postgresql  # Ubuntu
brew services start postgresql   # macOS
```

### 2. 数据库设置

```bash
# 创建数据库用户和数据库
sudo -u postgres psql

CREATE USER mcp_user WITH PASSWORD 'your_password';
CREATE DATABASE mcp_connector OWNER mcp_user;
GRANT ALL PRIVILEGES ON DATABASE mcp_connector TO mcp_user;

# 启用 pgvector 扩展
\c mcp_connector
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 3. 后端部署

```bash
# 克隆项目
git clone <repository-url>
cd mcp-connector/backend

# 安装依赖
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等

# 初始化数据库
uv run python scripts/init_db.py

# 启动开发服务器
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 前端部署

```bash
# 进入前端目录
cd ../frontend

# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动开发服务器
bun run dev
```

## 生产环境部署

### 1. Docker 容器化部署

#### 后端 Dockerfile
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
RUN pip install uv

# 复制依赖文件
COPY pyproject.toml uv.lock ./

# 安装 Python 依赖
RUN uv sync --frozen

# 复制应用代码
COPY app/ ./app/
COPY scripts/ ./scripts/

# 创建非 root 用户
RUN useradd --create-home --shell /bin/bash app
USER app

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 前端 Dockerfile
```dockerfile
# frontend/Dockerfile
FROM oven/bun:1 as builder

WORKDIR /app

# 复制依赖文件
COPY package.json bun.lockb ./

# 安装依赖
RUN bun install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN bun run build

# 生产镜像
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose 配置
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_DB: mcp_connector
      POSTGRES_USER: mcp_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcp_user -d mcp_connector"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://mcp_user:${DB_PASSWORD}@postgres:5432/mcp_connector
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      STRANDS_API_KEY: ${STRANDS_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend/logs:/app/logs
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 2. 环境变量配置

#### 生产环境变量
```bash
# .env.production
# 数据库配置
DATABASE_URL=postgresql://mcp_user:secure_password@postgres:5432/mcp_connector
REDIS_URL=redis://redis:6379

# API Keys
OPENAI_API_KEY=your_openai_api_key
STRANDS_API_KEY=your_strands_api_key

# 安全配置
SECRET_KEY=your_very_secure_secret_key
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# 日志配置
LOG_LEVEL=INFO
LOG_FILE=/app/logs/app.log

# 性能配置
MAX_DB_CONNECTIONS=20
REDIS_CACHE_TTL=300

# MCP 配置
MCP_HEALTH_CHECK_INTERVAL=30
MCP_MAX_RETRIES=3
MCP_TIMEOUT=60
```

### 3. Nginx 反向代理配置

```nginx
# nginx/nginx.conf
upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:80;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 前端静态文件
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API 请求
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4. 部署脚本

#### 部署脚本
```bash
#!/bin/bash
# deploy.sh

set -e

echo "Starting deployment..."

# 拉取最新代码
git pull origin main

# 构建和启动服务
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml build --no-cache
docker-compose -f docker-compose.yml up -d

# 等待服务启动
echo "Waiting for services to start..."
sleep 30

# 健康检查
if curl -f http://localhost:8000/health; then
    echo "Backend health check passed"
else
    echo "Backend health check failed"
    exit 1
fi

if curl -f http://localhost/; then
    echo "Frontend health check passed"
else
    echo "Frontend health check failed"
    exit 1
fi

echo "Deployment completed successfully!"
```

#### 数据库迁移脚本
```bash
#!/bin/bash
# migrate.sh

set -e

echo "Running database migrations..."

# 备份数据库
docker-compose exec postgres pg_dump -U mcp_user mcp_connector > backup_$(date +%Y%m%d_%H%M%S).sql

# 运行迁移
docker-compose exec backend uv run python scripts/migrate.py

echo "Database migration completed!"
```

## 监控和日志

### 1. 日志配置

#### 结构化日志
```python
# app/config/logging.py
import structlog
import logging.config

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": structlog.stdlib.ProcessorFormatter,
            "processor": structlog.dev.ConsoleRenderer(colors=False),
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": "/app/logs/app.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5,
            "formatter": "json",
        },
    },
    "loggers": {
        "": {
            "handlers": ["console", "file"],
            "level": "INFO",
        },
        "uvicorn": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

def setup_logging():
    logging.config.dictConfig(LOGGING_CONFIG)
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
```

### 2. 健康检查端点

```python
# app/api/v1/health.py
from fastapi import APIRouter, Depends
from app.db.connection import get_db_pool
from app.core.mcp_manager import MCPManager

router = APIRouter()

@router.get("/health")
async def health_check():
    """基础健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0"
    }

@router.get("/health/detailed")
async def detailed_health_check():
    """详细健康检查"""
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {}
    }
    
    # 检查数据库连接
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        health_status["services"]["database"] = "healthy"
    except Exception as e:
        health_status["services"]["database"] = f"unhealthy: {e}"
        health_status["status"] = "unhealthy"
    
    # 检查 MCP 工具状态
    try:
        mcp_manager = app.state.mcp_manager
        tool_count = len(mcp_manager.agents)
        running_count = sum(1 for status in mcp_manager.tool_status.values() if status == "running")
        
        health_status["services"]["mcp_tools"] = {
            "total": tool_count,
            "running": running_count,
            "status": "healthy" if running_count > 0 else "warning"
        }
    except Exception as e:
        health_status["services"]["mcp_tools"] = f"unhealthy: {e}"
        health_status["status"] = "unhealthy"
    
    return health_status
```

### 3. 监控指标

#### Prometheus 指标
```python
# app/middleware/metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from fastapi import Request, Response
import time

# 定义指标
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')
ACTIVE_CONNECTIONS = Gauge('active_connections', 'Active database connections')
MCP_TOOL_STATUS = Gauge('mcp_tool_status', 'MCP tool status', ['tool_id', 'status'])

async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    # 记录请求指标
    duration = time.time() - start_time
    REQUEST_DURATION.observe(duration)
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    return response

@router.get("/metrics")
async def get_metrics():
    """Prometheus 指标端点"""
    return Response(generate_latest(), media_type="text/plain")
```

## 备份和恢复

### 1. 数据库备份

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mcp_connector_$DATE.sql"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
docker-compose exec postgres pg_dump -U mcp_user -h localhost mcp_connector > $BACKUP_FILE

# 压缩备份文件
gzip $BACKUP_FILE

# 清理旧备份 (保留最近7天)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### 2. 数据恢复

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

echo "Restoring from $BACKUP_FILE..."

# 停止应用服务
docker-compose stop backend frontend

# 恢复数据库
if [[ $BACKUP_FILE == *.gz ]]; then
    gunzip -c $BACKUP_FILE | docker-compose exec -T postgres psql -U mcp_user -d mcp_connector
else
    docker-compose exec -T postgres psql -U mcp_user -d mcp_connector < $BACKUP_FILE
fi

# 重启服务
docker-compose start backend frontend

echo "Restore completed!"
```

## 安全配置

### 1. SSL/TLS 配置

```bash
# 生成自签名证书 (开发环境)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout nginx/ssl/key.pem \
    -out nginx/ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# 生产环境建议使用 Let's Encrypt
certbot --nginx -d yourdomain.com
```

### 2. 防火墙配置

```bash
# Ubuntu UFW 配置
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5432/tcp   # 禁止外部访问数据库
sudo ufw deny 6379/tcp   # 禁止外部访问 Redis
```

### 3. 环境变量安全

```bash
# 使用 Docker secrets (Docker Swarm)
echo "your_secret_password" | docker secret create db_password -

# 或使用外部密钥管理服务
# AWS Secrets Manager, HashiCorp Vault 等
```

## 性能优化

### 1. 数据库优化

```sql
-- 创建必要的索引
CREATE INDEX CONCURRENTLY idx_api_key_hash ON api_key(key_hash);
CREATE INDEX CONCURRENTLY idx_mcp_tool_enabled ON mcp_tool(is_enabled);
CREATE INDEX CONCURRENTLY idx_tool_vector_embedding ON tool_vector USING ivfflat (embedding vector_cosine_ops);

-- 配置 PostgreSQL
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

### 2. 应用优化

```python
# 连接池配置
DATABASE_CONFIG = {
    "min_size": 10,
    "max_size": 50,
    "command_timeout": 60,
    "server_settings": {
        "application_name": "mcp_connector",
        "jit": "off"
    }
}

# Redis 缓存配置
REDIS_CONFIG = {
    "host": "redis",
    "port": 6379,
    "db": 0,
    "max_connections": 20,
    "retry_on_timeout": True
}
```

## 故障排除

### 常见问题和解决方案

#### 1. 数据库连接问题
```bash
# 检查数据库状态
docker-compose exec postgres pg_isready -U mcp_user

# 查看数据库日志
docker-compose logs postgres

# 重启数据库服务
docker-compose restart postgres
```

#### 2. MCP 工具连接失败
```bash
# 查看 MCP 工具状态
curl -H "Authorization: Bearer your_api_key" http://localhost:8000/api/v1/mcp-tools

# 检查工具日志
docker-compose logs backend | grep mcp

# 手动测试 MCP 工具
uvx mcp-server-filesystem --base-path /tmp
```

#### 3. 前端构建失败
```bash
# 清理缓存
bun run clean
rm -rf node_modules
bun install

# 检查环境变量
cat .env

# 重新构建
bun run build
```

#### 4. 性能问题
```bash
# 检查资源使用
docker stats

# 查看慢查询
docker-compose exec postgres psql -U mcp_user -d mcp_connector -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# 分析日志
tail -f logs/app.log | grep -E "(ERROR|WARN|slow)"
```