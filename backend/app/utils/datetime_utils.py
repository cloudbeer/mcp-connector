"""
日期时间处理工具函数
"""
from datetime import datetime, timezone
from typing import Optional


def parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """
    通用日期时间解析函数，兼容多种格式
    
    Args:
        dt_str: 日期时间字符串，如 "2029-12-12T16:00:08.000Z"
        
    Returns:
        datetime 对象或 None（如果输入为 None）
    """
    if dt_str is None:
        return None
        
    try:
        # 处理带 Z 的 ISO 格式 (UTC)
        if dt_str.endswith('Z'):
            dt_str = dt_str.replace('Z', '+00:00')
            
        # 尝试解析 ISO 格式
        dt = datetime.fromisoformat(dt_str)
        
        # 如果没有时区信息，添加 UTC 时区
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
            
        # 返回不带时区信息的 datetime 对象，因为 PostgreSQL 的 timestamp 类型不存储时区
        return dt.replace(tzinfo=None)
    except ValueError:
        # 尝试其他格式
        for fmt in [
            '%Y-%m-%dT%H:%M:%S.%f',  # 2029-12-12T16:00:08.000
            '%Y-%m-%d %H:%M:%S',      # 2029-12-12 16:00:08
            '%Y-%m-%d',               # 2029-12-12
        ]:
            try:
                dt = datetime.strptime(dt_str, fmt)
                # 不添加时区信息，保持与数据库一致
                return dt
            except ValueError:
                continue
                
        # 如果所有尝试都失败，抛出异常
        raise ValueError(f"无法解析日期时间字符串: {dt_str}")
