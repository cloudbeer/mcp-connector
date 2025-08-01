#!/usr/bin/env python3
"""
创建管理员 API Key 脚本
"""
import asyncio
import hashlib
import secrets
import sys
import logging
from datetime import datetime, timedelta
from pathlib import Path

# 添加父目录到路径以导入应用模块
sys.path.append(str(Path(__file__).parent.parent))

from app.db.connection import db_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def create_admin_key():
    """创建一个具有管理权限的 API Key"""
    # 生成 API Key - 使用与系统相同的格式
    random_part = secrets.token_urlsafe(32)
    timestamp = str(int(datetime.now().timestamp()))
    api_key = f"ak-{timestamp[:6]}-{random_part}"
    
    # 计算哈希值
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    # 创建前缀（用于显示）- 确保不超过20个字符
    key_prefix = f"ak-{timestamp[:6]}-{random_part[:7]}..."
    
    # 插入数据库
    query = """
        INSERT INTO api_key (name, key_hash, key_prefix, can_manage, can_call_assistant, 
                           is_disabled, created_by, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
    """
    
    # 设置10年后的过期时间
    expires_at = datetime.now() + timedelta(days=365 * 10)
    
    try:
        record = await db_manager.fetch_one(
            query, "管理员账号", key_hash, key_prefix, True, True, False, "system", expires_at
        )
        
        logger.info(f"创建成功！API Key ID: {record['id']}")
        logger.info(f"API Key: {api_key}")
        logger.info(f"过期时间: {expires_at.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"请保存此 API Key，它不会再次显示")
        
        return api_key
    except Exception as e:
        logger.error(f"创建管理员账号失败: {e}")
        raise

async def main():
    """主函数"""
    logger.info("开始创建管理员 API Key...")
    
    try:
        await db_manager.connect()
        api_key = await create_admin_key()
        
        # 打印分隔线，使 API Key 更明显
        print("\n" + "=" * 50)
        print(f"管理员 API Key: {api_key}")
        print("请保存此 API Key，它不会再次显示")
        print("=" * 50 + "\n")
        
    except Exception as e:
        logger.error(f"执行失败: {e}")
        sys.exit(1)
    finally:
        await db_manager.disconnect()
        
    logger.info("执行完成")

if __name__ == "__main__":
    asyncio.run(main())