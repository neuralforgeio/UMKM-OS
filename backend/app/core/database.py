"""Async database engine and request-scoped session dependency.

The ML service connects READ-ONLY: it only issues SELECT statements
against tables owned by the Prisma schema on the frontend side. No
table is ever created, altered or migrated from this service.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# pool_pre_ping lets long-lived dev servers survive database restarts.
engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)

session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding exactly one session per request."""
    async with session_factory() as session:
        yield session
