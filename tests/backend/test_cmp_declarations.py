"""Reading a site's own cookie declaration during scans (backend/scanner/cmp_declarations.py)."""
import pytest

from backend.scanner import cmp_declarations as cmp
from backend.scanner.cmp_declarations import annotate_cookies, declaration_for, read_site_declarations


def _decl(group, name, host="shop.com", pattern=False, cmp_name="OneTrust", session=False, length=365):
    return {"group": group, "name": name, "host": host, "length": length, "session": session,
            "pattern": pattern, "description": "", "cmp": cmp_name}


DECLARATIONS = [
    _decl("Strictly Necessary Cookies", "sid"),
    _decl("Performance Cookies", "_ga_xxxxxxxxxx"),            # templated: matches _ga_ABC123
    _decl("Targeting Cookies", "IDE", host="doubleclick.net"),
    _decl("Functional Cookies", "IDE", host="other.com"),       # same name, other host
    _decl("Other", "share"),                                     # a group we don't map
    _decl("Unclassified", "unk"),                                # declared, but as no category
    _decl("Performance Cookies", "both"), _decl("Targeting Cookies", "both"),  # conflicting
]


def _cookie(name, domain="shop.com"):
    return {"name": name, "domain": domain}


def test_declared_category_uses_the_app_names():
    assert declaration_for(DECLARATIONS, _cookie("sid")) == {
        "category": "Strictly Necessary", "group": "Strictly Necessary Cookies", "cmp": "OneTrust",
        "provider": "shop.com", "declaredDuration": "365 days"}
    assert declaration_for(DECLARATIONS, _cookie("_ga_ABC123"))["category"] == "Analytics"


def test_host_match_wins_over_a_same_name_declaration():
    assert declaration_for(DECLARATIONS, _cookie("IDE", ".doubleclick.net"))["category"] == "Marketing"


def test_undeclared_and_conflicting_cookies_get_nothing():
    assert declaration_for(DECLARATIONS, _cookie("nope")) is None
    assert declaration_for(DECLARATIONS, _cookie("both")) is None


def test_unmapped_group_is_kept_as_evidence_without_a_category():
    found = declaration_for(DECLARATIONS, _cookie("share"))
    assert found["category"] is None and found["group"] == "Other"
    assert declaration_for(DECLARATIONS, _cookie("unk"))["category"] is None


def test_cookiebot_groups_map_to_app_categories():
    tables = {key: [[f"c_{key}", "shop.com", "purpose", "1 year", "HTTP Cookie"]]
              for key in ("Necessary", "Preference", "Statistics", "Advertising")}
    declared = cmp.parse_cookiebot_tables(tables)
    got = {d["name"]: declaration_for(declared, _cookie(d["name"]))["category"] for d in declared}
    assert got == {"c_Necessary": "Strictly Necessary", "c_Preference": "Functional",
                   "c_Statistics": "Analytics", "c_Advertising": "Marketing"}


def test_annotate_counts_matches_and_never_overwrites():
    cookies = [_cookie("sid"), _cookie("nope"), {**_cookie("_ga_X"), "websiteDeclaration": {"category": "kept"}}]
    assert annotate_cookies(cookies, DECLARATIONS) == 1
    assert cookies[0]["websiteDeclaration"]["category"] == "Strictly Necessary"
    assert "websiteDeclaration" not in cookies[1]
    assert cookies[2]["websiteDeclaration"] == {"category": "kept"}
    assert annotate_cookies([_cookie("sid")], []) == 0


class FakePage:
    """Answers the readers' page.evaluate calls; OneTrust data appears after `ready_after` polls."""

    def __init__(self, detected=True, onetrust=None, cookiebot=None, ready_after=0, error=None):
        self.detected, self.onetrust, self.cookiebot = detected, onetrust, cookiebot
        self.ready_after, self.error, self.polls, self.waits = ready_after, error, 0, 0
        self.url = "https://shop.com/"

    async def evaluate(self, script):
        if self.error:
            raise self.error
        if script == cmp.DETECT_JS:
            return self.detected
        if script == cmp.ONETRUST_JS:
            self.polls += 1
            return self.onetrust if self.polls > self.ready_after else None
        if script == cmp.COOKIEBOT_JS:
            return self.cookiebot
        raise AssertionError("unexpected script")

    async def wait_for_timeout(self, ms):
        self.waits += 1


@pytest.mark.anyio
async def test_no_cmp_on_the_page_costs_one_check_and_no_waiting():
    page = FakePage(detected=False)
    assert await read_site_declarations(page) == ("", [])
    assert page.polls == 0 and page.waits == 0


@pytest.mark.anyio
async def test_waits_for_onetrust_to_load_its_data():
    page = FakePage(onetrust=[_decl("Targeting Cookies", "IDE")], ready_after=3)
    vendor, declared = await read_site_declarations(page, wait_ms=4000, poll_ms=250)
    assert vendor == "OneTrust" and declared[0]["name"] == "IDE" and page.waits == 3


@pytest.mark.anyio
async def test_reads_cookiebot_tables():
    page = FakePage(cookiebot={"Statistics": [["_ga", "shop.com", "p", "2 years", "HTTP Cookie"]]})
    vendor, declared = await read_site_declarations(page)
    assert vendor == "Cookiebot" and declared[0]["group"] == "Statistics"


@pytest.mark.anyio
async def test_gives_up_after_the_wait_and_on_page_errors():
    page = FakePage(onetrust=None)
    assert await read_site_declarations(page, wait_ms=1000, poll_ms=250) == ("", [])
    assert page.waits == 4
    assert await read_site_declarations(FakePage(error=RuntimeError("navigated"))) == ("", [])


class FakeContext:
    def __init__(self, page, cookies):
        self.page, self._cookies = page, cookies

    async def new_page(self):
        return self.page

    async def cookies(self):
        return self._cookies


class ScannerPage(FakePage):
    async def goto(self, url, **kwargs):
        self.url = url

    async def close(self):
        pass


@pytest.mark.anyio
@pytest.mark.parametrize("read_cmp", [True, False])
async def test_scan_page_labels_declared_cookies_only_when_asked(monkeypatch, read_cmp):
    from backend.scanner import cookie_scanner
    async def public(url):
        return None
    monkeypatch.setattr(cookie_scanner, "check_url", public)  # no DNS in tests
    monkeypatch.setattr(cookie_scanner.settings, "COOKIE_WAIT_TIME", 0)
    page = ScannerPage(onetrust=[_decl("Targeting Cookies", "IDE", host="doubleclick.net")])
    context = FakeContext(page, [{"name": "IDE", "domain": ".doubleclick.net", "value": "x", "expires": -1},
                                 {"name": "other", "domain": "shop.com", "value": "y", "expires": -1}])
    result = await cookie_scanner.CookieScanner(context).scan_page("https://shop.com/", read_cmp=read_cmp)
    by_name = {c["name"]: c for c in result["cookies"]}
    if read_cmp:
        assert by_name["IDE"]["websiteDeclaration"]["category"] == "Marketing"
        assert "websiteDeclaration" not in by_name["other"]
        assert result["cmp"] == {"vendor": "OneTrust", "declared": 1, "matched": 1, "url": "https://shop.com/"}
        assert len(result["_declarations"]) == 1
    else:
        assert page.polls == 0 and "cmp" not in result and "_declarations" not in result
        assert all("websiteDeclaration" not in c for c in result["cookies"])


def test_quick_scan_result_exposes_the_summary_but_not_the_declaration_list():
    from backend.api.routes import _quick_scan_result
    from backend.models import ScanRequest
    page_result = {"cookies": [], "cookieCount": 0, "cmp": {"vendor": "OneTrust", "declared": 3, "matched": 0,
                                                            "url": "https://shop.com/"},
                   "_declarations": [_decl("Targeting Cookies", "IDE")]}
    result = _quick_scan_result(ScanRequest(url="https://shop.com", scanType="quick"), page_result)
    assert result["cmp"]["vendor"] == "OneTrust"
    assert "_declarations" not in result["pageResults"][0]
