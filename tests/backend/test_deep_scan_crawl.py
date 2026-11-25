"""Deep scan crawl (backend/scanner/parallel.py) against a fake browser: page and depth
limits, link scope, the start page's CMP declaration, retries, how many times each page
loads, and how many pages are open at once."""
import asyncio

import pytest

from backend.scanner import cookie_scanner, parallel
from backend.scanner.cmp_declarations import COOKIEBOT_JS, DETECT_JS, ONETRUST_JS
from backend.scanner.parallel import deep_scan_parallel

ROOT = "https://site.com"
START = ROOT + "/"
_real_sleep = asyncio.sleep


def url(path):
    return ROOT + path


def cookie(name, domain="site.com"):
    return {"name": name, "value": "v", "domain": domain, "path": "/", "expires": -1,
            "httpOnly": False, "secure": True, "sameSite": "Lax"}


class FakeSite:
    """A website: url -> {"links": [hrefs], "cookies": [cookies]}. Unknown URLs load as empty pages."""

    def __init__(self, pages, fail=(), flaky=(), declarations=(), slow=None):
        self.pages, self.fail, self.flaky = pages, set(fail), set(flaky)
        self.declarations = list(declarations)
        self.slow = slow                      # this URL's load waits until every other known page has loaded
        self.others_loaded = asyncio.Event()
        self.loads, self.cmp_reads, self.link_reads, self.settled = [], [], [], []
        self.open = self.max_open = 0

    def page(self, target):
        return self.pages.get(target, {})


class FakePage:
    def __init__(self, site, jar):
        self.site, self.jar, self.url = site, jar, "about:blank"
        site.open += 1
        site.max_open = max(site.max_open, site.open)

    async def goto(self, target, wait_until=None, timeout=None):
        site = self.site
        site.loads.append(target)
        await _real_sleep(0)                  # let other pages start, as a real load would
        if target == site.slow:
            await site.others_loaded.wait()
        if target in site.fail or (target in site.flaky and site.loads.count(target) == 1):
            raise Exception("Page.goto: NS_ERROR_ABORT")
        self.url = target
        for c in site.page(target).get("cookies", []):
            self.jar[(c["name"], c["domain"])] = c
        if set(site.pages) - {site.slow} <= set(site.loads):
            site.others_loaded.set()
        return None

    async def evaluate(self, script, *args):
        if script == DETECT_JS:
            self.site.cmp_reads.append(self.url)
            return bool(self.site.declarations)
        if script == ONETRUST_JS:
            return self.site.declarations
        if script == COOKIEBOT_JS:
            return {}
        links = self.site.page(self.url).get("links", [])
        if "anchorCount" in script:
            return {"title": "", "bodyLength": 1, "anchorCount": len(links), "anchorWithHrefCount": len(links)}
        if "scrollTo" in script and "href" not in script:
            return None
        self.site.link_reads.append(self.url)
        return list(links)

    async def wait_for_timeout(self, ms):
        return None

    async def wait_for_load_state(self, state=None, timeout=None):
        self.site.settled.append(self.url)

    async def close(self):
        self.site.open -= 1


class FakeContext:
    def __init__(self, site):
        self.site, self.jar = site, {}

    async def new_page(self):
        return FakePage(self.site, self.jar)

    async def cookies(self):
        return list(self.jar.values())


@pytest.fixture
def fast(monkeypatch):
    """No real waits or DNS: the crawl logic is what's under test."""
    async def no_check(_url):
        return None

    async def no_wait(*_args, **_kwargs):
        await _real_sleep(0)

    monkeypatch.setattr(cookie_scanner, "check_url", no_check)
    monkeypatch.setattr(asyncio, "sleep", no_wait)
    for name in ("COOKIE_WAIT_TIME", "INTER_SCAN_DELAY", "LINK_EXTRACTION_WAIT"):
        monkeypatch.setattr(parallel.settings, name, 0)


def scan(site, **kwargs):
    options = {"max_pages": 50, "concurrency": 4, "max_depth": 5}
    options.update(kwargs)
    return deep_scan_parallel(START, FakeContext(site), **options)


def tree():
    """/ -> a, b, c; a -> d; b -> e. Every page links home, so none is link-less."""
    return {
        START: {"links": ["/a", "/b", "/c"], "cookies": [cookie("sid")]},
        url("/a"): {"links": ["/", "/d"], "cookies": [cookie("_ga")]},
        url("/b"): {"links": ["/", "/e"]},
        url("/c"): {"links": ["/"]},
        url("/d"): {"links": ["/"]},
        url("/e"): {"links": ["/"], "cookies": [cookie("IDE", "doubleclick.net")]},
    }


def scanned(result):
    return sorted(p["url"] for p in result["pageResults"])


@pytest.mark.anyio
async def test_every_page_is_found_and_loaded_once(fast):
    site = FakeSite(tree())
    result = await scan(site)
    assert scanned(result) == sorted(tree())
    assert sorted(site.loads) == sorted(tree())
    assert {c["name"] for c in result["cookies"]} == {"sid", "_ga", "IDE"}


@pytest.mark.anyio
async def test_max_pages_holds(fast):
    pages = {START: {"links": [f"/p{i}" for i in range(30)]}}
    pages.update({url(f"/p{i}"): {"links": ["/"]} for i in range(30)})
    site = FakeSite(pages)
    result = await scan(site, max_pages=5)
    assert result["totalPagesScanned"] == 5
    assert len(set(scanned(result))) == 5
    # The start page's links fill the page budget, so no other page's links are read or waited on
    assert site.link_reads == [START]
    assert site.settled == [START]


@pytest.mark.anyio
async def test_max_depth_holds_and_reports_the_deepest_level_scanned(fast):
    chain = {START: {"links": ["/1"]}}
    chain.update({url(f"/{i}"): {"links": ["/", f"/{i + 1}"]} for i in range(1, 4)})
    chain[url("/4")] = {"links": ["/"]}

    shallow = await scan(FakeSite(chain), max_depth=2)
    assert scanned(shallow) == sorted([START, url("/1"), url("/2")])
    assert shallow["maxDepthReached"] == 2

    whole = await scan(FakeSite(chain), max_depth=10)
    assert len(whole["pageResults"]) == 5
    assert whole["maxDepthReached"] == 4


@pytest.mark.anyio
@pytest.mark.parametrize("include_subdomains", [False, True])
async def test_links_outside_the_site_are_not_followed(fast, include_subdomains):
    site = FakeSite({
        START: {"links": ["/a", "https://other.com/x", "https://blog.site.com/y"]},
        url("/a"): {"links": ["/"]},
        "https://blog.site.com/y": {"links": ["/a"]},
    })
    await scan(site, include_subdomains=include_subdomains)
    assert "https://other.com/x" not in site.loads
    assert ("https://blog.site.com/y" in site.loads) == include_subdomains


@pytest.mark.anyio
async def test_the_start_page_declaration_applies_to_cookies_found_on_other_pages(fast):
    declared = {"group": "Performance Cookies", "name": "_ga", "host": "site.com", "length": 365,
                "session": False, "pattern": False, "description": "", "cmp": "OneTrust"}
    site = FakeSite(tree(), declarations=[declared])
    result = await scan(site)
    assert site.cmp_reads == [START]
    # Pages whose links are followed wait for late cookies (network idle); the rest don't
    assert site.settled and sorted(site.settled) == sorted(site.link_reads)
    assert result["cmp"]["vendor"] == "OneTrust"
    ga = next(c for c in result["cookies"] if c["name"] == "_ga")
    assert ga["websiteDeclaration"]["group"] == "Performance Cookies"


@pytest.mark.anyio
async def test_failed_pages_are_retried_and_recovered_ones_replace_the_failure(fast):
    site = FakeSite(tree(), flaky={url("/a")}, fail={url("/b")})
    result = await scan(site)
    assert result["errorPages"] == [url("/b")]
    by_url = {p["url"]: p for p in result["pageResults"]}
    assert by_url[url("/a")]["error"] is None
    assert by_url[url("/b")]["error"]
    # /d is only linked from /a, which failed first time: the retry still follows its links
    assert url("/d") in by_url


@pytest.mark.anyio
async def test_a_one_page_scan_loads_only_the_start_page(fast):
    site = FakeSite({START: {"links": []}})
    result = await scan(site, max_pages=1)
    assert len(result["pageResults"]) == 1
    assert site.loads == [START] and site.link_reads == [] and site.settled == []


@pytest.mark.anyio
async def test_a_failing_start_page_fails_the_scan(fast):
    with pytest.raises(Exception, match="Failed to scan main page"):
        await scan(FakeSite(tree(), fail={START}))


@pytest.mark.anyio
async def test_a_slow_page_does_not_hold_up_the_rest(fast):
    pages = {START: {"links": ["/slow"] + [f"/p{i}" for i in range(8)]}, url("/slow"): {"links": ["/"]}}
    pages.update({url(f"/p{i}"): {"links": ["/"]} for i in range(8)})
    site = FakeSite(pages, slow=url("/slow"))
    # /slow only finishes once every other page has loaded: a crawl that waits for it first never ends.
    result = await asyncio.wait_for(scan(site, concurrency=2), timeout=5)
    assert len(result["pageResults"]) == 10


@pytest.mark.anyio
async def test_pages_open_at_once_stay_within_the_site_limit(fast, monkeypatch):
    monkeypatch.setattr(parallel.settings, "START_CONCURRENT_PAGES", 3)
    monkeypatch.setattr(parallel.settings, "MAX_CONCURRENT_PAGES", 3)
    pages = {START: {"links": [f"/p{i}" for i in range(20)]}}
    pages.update({url(f"/p{i}"): {"links": ["/"]} for i in range(20)})
    site = FakeSite(pages)
    result = await scan(site, concurrency=50)
    assert len(result["pageResults"]) == 21
    assert site.max_open == 3


def test_concurrency_starts_low_and_grows_to_the_ceiling_while_pages_succeed(monkeypatch):
    from backend.scanner.adaptive import AdaptiveConcurrencyManager
    monkeypatch.setattr(parallel.settings, "START_CONCURRENT_PAGES", 4)
    monkeypatch.setattr(parallel.settings, "MAX_CONCURRENT_PAGES", 7)
    assert AdaptiveConcurrencyManager(initial_concurrency=2).get_concurrency() == 2
    manager = AdaptiveConcurrencyManager(initial_concurrency=20)   # the UI's default request
    assert manager.get_concurrency() == 4
    seen = []
    for _ in range(40):
        manager.record_batch_result(1, 0, 2.0)                      # fast, successful pages
        seen.append(manager.get_concurrency())
    assert seen[-1] == 7 and 5 in seen and 6 in seen                # +1 at a time, no skipping past 7
    for _ in range(80):
        manager.record_batch_result(0, 1, 2.0)                      # the site starts aborting
    assert manager.get_concurrency() == 1


@pytest.mark.anyio
async def test_a_start_page_without_links_falls_back_to_common_paths(fast):
    site = FakeSite({START: {"links": []}}, )
    result = await scan(site, max_pages=3, max_depth=1)
    assert len(result["pageResults"]) == 3
    assert url("/about") in site.loads


@pytest.mark.anyio
async def test_progress_events_carry_a_count_and_end_complete(fast):
    events = []

    async def on_progress(event):
        events.append(event)

    await scan(FakeSite(tree()), on_progress=on_progress)
    assert all("current" in e and "total" in e for e in events)
    assert events[-1]["type"] == "complete"
    assert any(e["status"] == "scanning" and e.get("currentUrl") for e in events)
