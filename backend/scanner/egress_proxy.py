"""Egress proxy for scanning browsers: connect only to the address that was checked.

url_guard checks a host by resolving it, but the browser then resolves the name
again on its own. A scanned site that controls its DNS can answer the second
lookup with an internal address (DNS rebinding) and reach services such as
/api/store from inside the Docker network. This proxy closes that gap: it
resolves each host once, refuses the request if any address is not public, and
opens the connection to the checked address itself.

Handles HTTPS/WebSocket tunnels (CONNECT) and plain HTTP (absolute-form
requests). Plain HTTP connections carry exactly one request, so a browser
cannot reuse a checked connection for a different host.

Run: python -m backend.scanner.egress_proxy  (EGRESS_PROXY_HOST/PORT, default 0.0.0.0:3128)
"""
import asyncio
import ipaddress
import logging
import os
from typing import Awaitable, Callable, Iterable, Optional, Tuple
from urllib.parse import urlsplit

from backend.scanner.url_guard import _is_public, _resolve

logger = logging.getLogger(__name__)

Resolver = Callable[[str], Awaitable[Iterable[str]]]
AddressCheck = Callable[[ipaddress.IPv4Address | ipaddress.IPv6Address], bool]

MAX_HEAD_BYTES = 64 * 1024
CONNECT_TIMEOUT_S = 10
HOP_BY_HOP = {"proxy-connection", "proxy-authorization", "connection", "keep-alive"}


class Refused(Exception):
    """The request may not leave through the proxy."""

    def __init__(self, status: int, reason: str):
        super().__init__(reason)
        self.status = status
        self.reason = reason


class EgressProxy:
    def __init__(self, resolve: Resolver = _resolve, is_allowed: AddressCheck = _is_public):
        self._resolve = resolve
        self._is_allowed = is_allowed

    async def _checked_address(self, host: str) -> str:
        """Resolve once; return an address only if every answer is allowed."""
        try:
            ip = ipaddress.ip_address(host.strip("[]"))
            addresses = [str(ip)]
        except ValueError:
            try:
                addresses = list(await self._resolve(host))
            except OSError as exc:
                raise Refused(502, f"could not resolve {host}") from exc
        if not addresses:
            raise Refused(502, f"could not resolve {host}")
        for address in addresses:
            if not self._is_allowed(ipaddress.ip_address(address.split("%")[0])):
                raise Refused(403, f"{host} resolves to non-public address {address}")
        return addresses[0]

    async def _open(self, host: str, port: int) -> Tuple[asyncio.StreamReader, asyncio.StreamWriter]:
        address = await self._checked_address(host)
        try:
            return await asyncio.wait_for(asyncio.open_connection(address, port), CONNECT_TIMEOUT_S)
        except (OSError, asyncio.TimeoutError) as exc:
            raise Refused(502, f"could not connect to {host}:{port}") from exc

    async def handle(self, client_r: asyncio.StreamReader, client_w: asyncio.StreamWriter) -> None:
        upstream_w: Optional[asyncio.StreamWriter] = None
        try:
            head = await client_r.readuntil(b"\r\n\r\n")
            request_line, *header_lines = head.decode("latin-1").split("\r\n")[:-2]
            method, target, version = request_line.split(" ", 2)
            if method.upper() == "CONNECT":
                host, _, port = target.rpartition(":")
                upstream_r, upstream_w = await self._open(host, int(port))
                client_w.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                await client_w.drain()
                await asyncio.gather(_pipe(client_r, upstream_w), _pipe(upstream_r, client_w))
                return
            upstream_r, upstream_w = await self._forward_http(client_r, method, target, version, header_lines)
            await _pipe(upstream_r, client_w)
        except Refused as refused:
            logger.warning("Egress refused: %s", refused.reason)
            await _reply(client_w, refused.status, refused.reason)
        except (asyncio.IncompleteReadError, asyncio.LimitOverrunError, ValueError):
            await _reply(client_w, 400, "malformed proxy request")
        except (ConnectionError, asyncio.CancelledError):
            pass
        finally:
            for writer in (upstream_w, client_w):
                if writer is not None:
                    writer.close()

    async def _forward_http(self, client_r, method, target, version, header_lines):
        parts = urlsplit(target)
        if parts.scheme != "http" or not parts.hostname:
            raise Refused(400, "plain HTTP requests must use an absolute http:// URL")
        headers = []
        body_length = 0
        for line in header_lines:
            name, _, value = line.partition(":")
            lname = name.strip().lower()
            if lname == "transfer-encoding":
                raise Refused(501, "chunked request bodies are not supported")
            if lname == "content-length":
                body_length = int(value.strip())
            if lname in HOP_BY_HOP:
                continue
            headers.append(line)
        body = await client_r.readexactly(body_length) if body_length else b""
        upstream_r, upstream_w = await self._open(parts.hostname, parts.port or 80)
        path = parts.path or "/"
        if parts.query:
            path += "?" + parts.query
        head = "\r\n".join([f"{method} {path} {version}", *headers, "Connection: close", "", ""])
        upstream_w.write(head.encode("latin-1") + body)
        await upstream_w.drain()
        return upstream_r, upstream_w


async def _pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while chunk := await reader.read(65536):
            writer.write(chunk)
            await writer.drain()
    except (ConnectionError, asyncio.CancelledError):
        pass
    finally:
        if writer.can_write_eof():
            try:
                writer.write_eof()
            except OSError:
                pass


async def _reply(writer: asyncio.StreamWriter, status: int, reason: str) -> None:
    body = f"Blocked by scan egress proxy: {reason}\n".encode()
    phrase = {400: "Bad Request", 403: "Forbidden", 501: "Not Implemented"}.get(status, "Bad Gateway")
    try:
        writer.write(
            f"HTTP/1.1 {status} {phrase}\r\nContent-Type: text/plain\r\n"
            f"Content-Length: {len(body)}\r\nConnection: close\r\n\r\n".encode() + body
        )
        await writer.drain()
    except ConnectionError:
        pass


async def serve(host: str, port: int, proxy: Optional[EgressProxy] = None) -> asyncio.base_events.Server:
    proxy = proxy or EgressProxy()
    return await asyncio.start_server(proxy.handle, host, port, limit=MAX_HEAD_BYTES)


async def _main() -> None:
    host = os.getenv("EGRESS_PROXY_HOST", "0.0.0.0")
    port = int(os.getenv("EGRESS_PROXY_PORT", "3128"))
    server = await serve(host, port)
    logger.info("Scan egress proxy listening on %s:%s", host, port)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(_main())
