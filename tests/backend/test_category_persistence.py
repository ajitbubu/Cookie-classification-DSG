"""Regression tests for honest persistence reporting in CategoryManager.

`update_category()` used to return a bare ``True`` whenever it caught an
exception from the database layer, after quietly writing the override to local
file storage instead. `category_routes` then compounded it by deriving
``knowledge_base_updated`` from ``manager.db_pool is not None`` — the existence
of a connection pool object, not the outcome of the write.

Net effect: a user overriding a cookie category saw a success response for a
change that never reached Postgres, and any "published" count built on top of
it was wrong.

These tests pin the corrected contract: the return value distinguishes a durable
database write from a file-only fallback.
"""
import pytest

from backend.db.category_manager import CategoryManager


class _FailingPool:
    """Stands in for an asyncpg pool that exists but whose writes fail.

    This is the case the old code got wrong: `db_pool` is truthy, so the route
    reported success, while every write raised.
    """

    def acquire(self, *args, **kwargs):
        raise RuntimeError("connection refused")


@pytest.fixture
def manager(tmp_path, monkeypatch):
    mgr = CategoryManager()
    # Keep the file fallback inside the test's tmp dir.
    monkeypatch.setattr(
        mgr, "_persist_to_file", _make_recorder(), raising=False
    )
    return mgr


def _make_recorder():
    async def _recorder(*args, **kwargs):
        _recorder.calls.append((args, kwargs))
        return True

    _recorder.calls = []
    return _recorder


@pytest.mark.anyio
async def test_reports_not_persisted_when_no_pool(manager):
    """With no database configured the change is file-only, not persisted."""
    manager.db_pool = None

    result = await manager.update_category(
        scan_id="scan-1",
        cookie_name="_ga",
        cookie_domain="example.com",
        old_category="Unclassified",
        new_category="Analytics",
    )

    assert result["ok"] is True, "the override should still be recorded locally"
    assert result["persisted"] is False, "no database means nothing was persisted"
    assert result["file_fallback"] is True
    assert manager._persist_to_file.calls, "file fallback should have been used"


@pytest.mark.anyio
async def test_does_not_claim_success_when_db_write_fails(manager):
    """A pool that exists but fails must not be reported as persisted.

    This is the exact shape of the original bug.
    """
    manager.db_pool = _FailingPool()

    result = await manager.update_category(
        scan_id="scan-2",
        cookie_name="_fbp",
        cookie_domain="example.com",
        old_category="Analytics",
        new_category="Marketing",
    )

    assert result["ok"] is True
    assert result["persisted"] is False, (
        "database write failed, so persisted must be False — "
        "returning True here was the original defect"
    )
    assert result["file_fallback"] is True


@pytest.mark.anyio
async def test_result_shape_is_stable(manager):
    """Callers depend on these keys; keep them present."""
    manager.db_pool = None

    result = await manager.update_category(
        scan_id="scan-3",
        cookie_name="sessionid",
        cookie_domain="example.com",
        old_category="Unclassified",
        new_category="Strictly Necessary",
    )

    for key in ("ok", "persisted", "feedback_recorded", "file_fallback", "error"):
        assert key in result, f"missing key in update_category result: {key}"


@pytest.mark.anyio
async def test_no_feedback_recorded_when_category_unchanged(manager):
    """Re-selecting the same category is not a correction worth feeding back."""
    manager.db_pool = None

    result = await manager.update_category(
        scan_id="scan-4",
        cookie_name="_gid",
        cookie_domain="example.com",
        old_category="Analytics",
        new_category="Analytics",
    )

    assert result["feedback_recorded"] is False


@pytest.mark.anyio
@pytest.mark.parametrize("scan_id", ["../escape", "../../tmp/escape", "/tmp/escape"])
async def test_file_fallback_refuses_paths_outside_its_folder(tmp_path, monkeypatch, scan_id):
    """The file fallback must never write outside data/category_overrides/."""
    monkeypatch.chdir(tmp_path)
    mgr = CategoryManager()

    with pytest.raises(ValueError):
        await mgr._persist_to_file(scan_id, "_ga", "example.com", "Analytics", "Marketing", None)

    written = [p for p in tmp_path.rglob("*.json")]
    assert written == []


@pytest.mark.anyio
async def test_file_fallback_writes_iso_timestamp_scan_inside_its_folder(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    mgr = CategoryManager()

    await mgr._persist_to_file(
        "2026-10-11T20:20:08.737Z", "_ga", "example.com", "Analytics", "Marketing", None
    )

    assert (tmp_path / "data" / "category_overrides" / "2026-10-11T20:20:08.737Z.json").is_file()
