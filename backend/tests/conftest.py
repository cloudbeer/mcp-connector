"""
Test configuration and fixtures.
"""
import asyncio
import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.main import app
from app.config import settings


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client():
    """Create test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def test_settings():
    """Test settings."""
    return settings
