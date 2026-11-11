"""SSRF guard for scan targets (backend/scanner/url_guard.py)."""
import ipaddress

import pytest
from hypothesis import given, strategies as st

from backend.scanner import url_guard
from backend.scanner.url_guard import BlockedTarget, check_url, check_url_syntax, install_request_guard


@pytest.mark.parametrize("url", [
    "file:///etc/passwd",
    "ftp://example.com/",
    "javascript:alert(1)",
    "example.com",                       # no scheme
    "http://",                           # no host
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",                # CGNAT
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",        # IPv4-mapped loopback
    "http://[fd00::1]/",
])
def test_syntax_rejects_disallowed_targets(url):
    with pytest.raises(BlockedTarget):
        check_url_syntax(url)


@pytest.mark.parametrize("url", ["https://example.com/", "http://93.184.215.14/path"])
def test_syntax_allows_public_targets(url):
    assert check_url_syntax(url)


@given(st.ip_addresses())
def test_ip_literals_pass_only_when_global(ip):
    host = f"[{ip}]" if ip.version == 6 else str(ip)
    mapped = ip.ipv4_mapped if ip.version == 6 and ip.ipv4_mapped else ip
    public = mapped.is_global and not mapped.is_multicast
    if public:
        check_url_syntax(f"http://{host}/")
    else:
        with pytest.raises(BlockedTarget):
            check_url_syntax(f"http://{host}/")


def _resolver(addresses):
    async def resolve(_host):
        if isinstance(addresses, Exception):
            raise addresses
        return addresses
    return resolve


@pytest.mark.anyio
async def test_hostname_resolving_to_internal_address_is_blocked(monkeypatch):
    monkeypatch.setattr(url_guard, "_resolve", _resolver(["93.184.215.14", "10.0.0.7"]))
    with pytest.raises(BlockedTarget, match="non-public"):
        await check_url("https://rebind.example/")


@pytest.mark.anyio
async def test_unresolvable_host_is_blocked(monkeypatch):
    monkeypatch.setattr(url_guard, "_resolve", _resolver(OSError("nxdomain")))
    with pytest.raises(BlockedTarget, match="could not resolve"):
        await check_url("https://nope.example/")


@pytest.mark.anyio
async def test_public_hostname_is_allowed(monkeypatch):
    monkeypatch.setattr(url_guard, "_resolve", _resolver(["93.184.215.14", "2606:2800:21f:cb07:6820:80da:af6b:8b2c"]))
    await check_url("https://example.com/")


class _FakeRoute:
    def __init__(self, url):
        self.request = type("Req", (), {"url": url})()
        self.outcome = None

    async def continue_(self):
        self.outcome = "continued"

    async def abort(self, error_code=None):
        self.outcome = f"aborted:{error_code}"


class _FakeContext:
    async def route(self, pattern, handler):
        self.pattern, self.handler = pattern, handler


@pytest.mark.anyio
async def test_request_guard_aborts_internal_and_continues_public(monkeypatch):
    resolved = {"internal.example": ["169.254.169.254"], "cdn.example": ["93.184.215.14"]}
    lookups = []

    async def resolve(host):
        lookups.append(host)
        return resolved[host]

    monkeypatch.setattr(url_guard, "_resolve", resolve)
    context = _FakeContext()
    await install_request_guard(context)
    assert context.pattern == "**/*"

    internal, public, public_again = (
        _FakeRoute("http://internal.example/latest/meta-data/"),
        _FakeRoute("https://cdn.example/a.js"),
        _FakeRoute("https://cdn.example/b.js"),
    )
    for route in (internal, public, public_again):
        await context.handler(route)

    assert internal.outcome == "aborted:blockedbyclient"
    assert public.outcome == public_again.outcome == "continued"
    assert lookups.count("cdn.example") == 1  # verdict cached per origin
