"""Deep scans retry failed pages one at a time (backend/scanner/parallel.py)."""
import pytest

from backend.scanner.parallel import retry_failed_pages

START = "https://site.com/"


class FakeScanner:
    def __init__(self, recovers):
        self.recovers, self.calls = recovers, []

    async def scan_page(self, url):
        self.calls.append(url)
        if url in self.recovers:
            return {"url": url, "cookies": [{"name": "c"}], "error": None}
        return {"url": url, "cookies": [], "error": "Page.goto: NS_ERROR_ABORT"}


def failed(url):
    return {"url": url, "cookies": [], "error": "Page.goto: NS_ERROR_ABORT"}


@pytest.mark.anyio
async def test_recovered_pages_replace_their_failed_entry():
    pages = [{"url": START, "cookies": [], "error": None}, failed("https://site.com/a"), failed("https://site.com/b")]
    errors = ["https://site.com/a", "https://site.com/b", "https://site.com/a"]  # duplicates are retried once
    scanner = FakeScanner(recovers={"https://site.com/a"})
    progress = []

    async def on_progress(event):
        progress.append(event)

    assert await retry_failed_pages(scanner, pages, errors, START, on_progress, 10) == 1
    assert scanner.calls == ["https://site.com/a", "https://site.com/b"]
    assert errors == ["https://site.com/b"]
    assert [(p["url"], bool(p["error"])) for p in pages] == [(START, False), ("https://site.com/b", True), ("https://site.com/a", False)]
    assert [e["status"] for e in progress] == ["retrying", "retrying"]


@pytest.mark.anyio
async def test_the_start_page_is_not_retried_and_the_limit_holds(monkeypatch):
    from backend.scanner import parallel
    monkeypatch.setattr(parallel.settings, "MAX_PAGE_RETRIES", 2)
    errors = [START] + [f"https://site.com/{i}" for i in range(5)]
    scanner = FakeScanner(recovers=set())
    assert await retry_failed_pages(scanner, [], errors, START) == 0
    assert scanner.calls == ["https://site.com/0", "https://site.com/1"]

    monkeypatch.setattr(parallel.settings, "MAX_PAGE_RETRIES", 0)
    assert await retry_failed_pages(FakeScanner(recovers=set()), [], ["https://site.com/x"], START) == 0
