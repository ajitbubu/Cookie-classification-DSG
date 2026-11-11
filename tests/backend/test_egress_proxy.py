"""Egress proxy for scanning browsers (backend/scanner/egress_proxy.py).

Regression: CSO-1 — the request guard and the browser resolved DNS separately,
so a rebinding DNS server could point a checked hostname at an internal service
(e.g. /api/store on api-gateway). The proxy must resolve once and connect to
the checked address, and refuse any non-public answer.
"""
import asyncio
import ipaddress

import pytest

from backend.scanner.egress_proxy import EgressProxy, serve
from backend.scanner.url_guard import browser_launch_options

pytestmark = pytest.mark.anyio


class InternalService:
    """Stands in for an internal HTTP service such as /api/store."""

    def __init__(self):
        self.requests: list[bytes] = []
        self.connections = 0

    async def _handle(self, reader, writer):
        self.connections += 1
        data = await reader.read(65536)
        self.requests.append(data)
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Length: 8\r\nConnection: close\r\n\r\nINTERNAL")
        await writer.drain()
        writer.close()

    async def __aenter__(self):
        self.server = await asyncio.start_server(self._handle, "127.0.0.1", 0)
        self.port = self.server.sockets[0].getsockname()[1]
        return self

    async def __aexit__(self, *exc):
        self.server.close()
        await self.server.wait_closed()


async def _start_proxy(proxy: EgressProxy):
    server = await serve("127.0.0.1", 0, proxy)
    return server, server.sockets[0].getsockname()[1]


async def _send(proxy_port: int, raw: bytes, *, read_after_connect: bytes | None = None) -> bytes:
    reader, writer = await asyncio.open_connection("127.0.0.1", proxy_port)
    writer.write(raw)
    await writer.drain()
    if read_after_connect is not None:
        status = await reader.readuntil(b"\r\n\r\n")
        if b" 200 " not in status.split(b"\r\n")[0]:
            writer.close()
            return status
        writer.write(read_after_connect)
        await writer.drain()
    data = await asyncio.wait_for(reader.read(), timeout=5)
    writer.close()
    return data


def _resolver(answers: dict[str, list[list[str]]]):
    """Fake DNS: each lookup of a name returns its next answer (rebinding)."""
    calls: dict[str, int] = {}

    async def resolve(host):
        n = calls.get(host, 0)
        calls[host] = n + 1
        options = answers[host]
        return options[min(n, len(options) - 1)]

    resolve.calls = calls
    return resolve


async def test_connect_to_name_resolving_internal_is_refused():
    async with InternalService() as internal:
        server, port = await _start_proxy(EgressProxy(resolve=_resolver({"rebind.test": [["127.0.0.1"]]})))
        async with server:
            reply = await _send(port, f"CONNECT rebind.test:{internal.port} HTTP/1.1\r\n\r\n".encode())
        assert reply.startswith(b"HTTP/1.1 403")
        assert internal.connections == 0


async def test_plain_http_to_internal_store_is_refused():
    async with InternalService() as internal:
        server, port = await _start_proxy(EgressProxy(resolve=_resolver({"rebind.test": [["127.0.0.1"]]})))
        async with server:
            reply = await _send(port, (
                f"GET http://rebind.test:{internal.port}/api/store/approvals HTTP/1.1\r\n"
                f"Host: rebind.test:{internal.port}\r\n\r\n"
            ).encode())
        assert reply.startswith(b"HTTP/1.1 403")
        assert internal.connections == 0


@pytest.mark.parametrize("target", ["127.0.0.1", "[::1]", "169.254.169.254", "10.0.0.5", "172.18.0.4"])
async def test_internal_ip_literals_are_refused(target):
    server, port = await _start_proxy(EgressProxy(resolve=_resolver({})))
    async with server:
        reply = await _send(port, f"CONNECT {target}:443 HTTP/1.1\r\n\r\n".encode())
    assert reply.startswith(b"HTTP/1.1 403")


async def test_any_internal_answer_refuses_the_host():
    resolve = _resolver({"mixed.test": [["93.184.215.14", "127.0.0.1"]]})
    server, port = await _start_proxy(EgressProxy(resolve=resolve))
    async with server:
        reply = await _send(port, b"CONNECT mixed.test:443 HTTP/1.1\r\n\r\n")
    assert reply.startswith(b"HTTP/1.1 403")


async def test_rebinding_cannot_swap_the_address_after_the_check():
    """One lookup per request, and the connection goes to the checked address.

    The fake DNS answers the allowed address first and a forbidden one after;
    a second lookup would be the rebinding window the browser used to have.
    """
    async with InternalService() as internal:
        resolve = _resolver({"site.test": [["127.0.0.1"], ["10.9.9.9"]]})
        allowed = ipaddress.ip_address("127.0.0.1")  # stands in for a public address in this test
        server, port = await _start_proxy(EgressProxy(resolve=resolve, is_allowed=lambda ip: ip == allowed))
        async with server:
            reply = await _send(
                port, f"CONNECT site.test:{internal.port} HTTP/1.1\r\n\r\n".encode(),
                read_after_connect=b"GET / HTTP/1.1\r\nHost: site.test\r\n\r\n",
            )
        assert reply.endswith(b"INTERNAL")
        assert resolve.calls == {"site.test": 1}
        assert internal.connections == 1


async def test_plain_http_carries_one_request_per_connection():
    """A kept-alive proxy connection must not carry a second request to another host."""
    async with InternalService() as internal:
        resolve = _resolver({"site.test": [["127.0.0.1"]], "other.test": [["127.0.0.1"]]})
        server, port = await _start_proxy(EgressProxy(resolve=resolve, is_allowed=lambda ip: True))
        async with server:
            reply = await _send(port, (
                f"GET http://site.test:{internal.port}/a?x=1 HTTP/1.1\r\nHost: site.test\r\n"
                "Proxy-Connection: keep-alive\r\n\r\n"
                f"GET http://other.test:{internal.port}/b HTTP/1.1\r\nHost: other.test\r\n\r\n"
            ).encode())
        assert reply.endswith(b"INTERNAL")
        assert internal.connections == 1
        first = internal.requests[0]
        assert first.startswith(b"GET /a?x=1 HTTP/1.1\r\n")
        assert b"Proxy-Connection" not in first
        assert b"Connection: close" in first
        assert b"other.test" not in first
        assert "other.test" not in resolve.calls


def test_launch_options_empty_without_proxy():
    assert browser_launch_options("firefox", "") == {}
    assert browser_launch_options("chromium", None) == {}


def test_firefox_sends_loopback_through_the_proxy_and_disables_webrtc():
    options = browser_launch_options("firefox", "http://egress-proxy:3128")
    assert options["proxy"] == {"server": "http://egress-proxy:3128"}
    prefs = options["firefox_user_prefs"]
    assert prefs["network.proxy.allow_hijacking_localhost"] is True
    assert prefs["network.proxy.no_proxies_on"] == ""
    assert prefs["media.peerconnection.enabled"] is False


def test_chromium_sends_loopback_through_the_proxy():
    options = browser_launch_options("chromium", "http://egress-proxy:3128")
    assert options["proxy"] == {"server": "http://egress-proxy:3128"}
    assert "--proxy-bypass-list=<-loopback>" in options["args"]
    assert "--force-webrtc-ip-handling-policy=disable_non_proxied_udp" in options["args"]
