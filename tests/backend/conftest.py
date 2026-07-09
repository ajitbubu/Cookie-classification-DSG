"""Shared pytest fixtures for backend API tests.

The app is exercised in-process with Starlette's TestClient — no running
server or network is required. Import of `backend.main` is light because the
ML classifier is loaded lazily (on first ML request), not at import time.
"""
import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="session")
def client():
    """A single in-process TestClient for the whole test session."""
    with TestClient(app) as c:
        yield c
