"""
db/database.py
SQLAlchemy engine, session factory, Base, and get_db() dependency.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/ez_compliance")

# ---------------------------------------------------------------------------
# Engine — postgresql+psycopg2 dialect (psycopg2-binary handles the driver)
# ---------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,          # healthcheck before using a pooled connection
    pool_size=10,
    max_overflow=20,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ---------------------------------------------------------------------------
# Declarative base — imported by models.py
# ---------------------------------------------------------------------------
Base = declarative_base()


# ---------------------------------------------------------------------------
# FastAPI dependency — yields a DB session and guarantees cleanup
# ---------------------------------------------------------------------------
def get_db():
    """
    Yield a SQLAlchemy session for use in a FastAPI route dependency.
    Rolls back on exception and always closes the session.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
