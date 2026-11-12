"""Scan-target guard: keep the scanning browser off internal networks (SSRF).

Scan URLs come from users, and a scan then follows links, sitemaps and
subresources chosen by the scanned site. Every host the browser contacts must
resolve only to public addresses; loopback, private, link-local (cloud
metadata), CGNAT and reserved ranges are refused.
"""
import asyncio
import ipaddress
import logging
import socket
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

if TYPE_CHECKING:  # backend.models imports this module; keep Playwright out of that path
    from playwright.async_api import BrowserContext, Route

logger = logging.getLogger(__name__)

ALLOWED_SCHEMES = ("http", "https")


class BlockedTarget(ValueError):
    """The URL's scheme or destination may not be scanned."""


def _is_public(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip.version == 6 and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def check_url_syntax(url: str) -> str:
    """Return the URL's host, or raise BlockedTarget. Does no DNS lookup.

    Rejects non-http(s) schemes, a missing host and non-public IP literals.
    """
    parts = urlsplit(url)
    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise BlockedTarget(f"URL scheme must be http or https, got {parts.scheme or 'none'!r}")
    host = parts.hostname
    if not host:
        raise BlockedTarget("URL has no host")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return host
    if not _is_public(ip):
        raise BlockedTarget(f"{host} is not a public address")
    return host


async def _resolve(host: str) -> list[str]:
    infos = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
    return [info[4][0] for info in infos]


async def check_url(url: str) -> None:
    """Raise BlockedTarget unless every address the URL's host resolves to is public."""
    host = check_url_syntax(url)
    try:
        addresses = await _resolve(host)
    except OSError as exc:
        raise BlockedTarget(f"could not resolve {host}") from exc
    for address in addresses:
        if not _is_public(ipaddress.ip_address(address.split("%")[0])):
            raise BlockedTarget(f"{host} resolves to non-public address {address}")


def browser_launch_options(browser_name: str, egress_proxy: str | None) -> dict:
    """Playwright launch() options that send every browser connection through
    the egress proxy (backend/scanner/egress_proxy.py).

    The request guard below checks a host with its own DNS lookup; the browser
    then resolves the name again, so a rebinding DNS server can swap in an
    internal address. The proxy connects to the address it checked. Loopback
    must not bypass the proxy and WebRTC must not open direct UDP paths.
    Returns {} when no proxy is configured (local runs without Docker).
    """
    if not egress_proxy:
        return {}
    options: dict = {"proxy": {"server": egress_proxy}}
    if browser_name == "firefox":
        options["firefox_user_prefs"] = {
            "network.proxy.allow_hijacking_localhost": True,
            "network.proxy.no_proxies_on": "",
            "media.peerconnection.enabled": False,
        }
    elif browser_name == "chromium":
        options["args"] = [
            "--proxy-bypass-list=<-loopback>",
            "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        ]
    return options


async def install_request_guard(context: "BrowserContext") -> None:
    """Abort every request the context makes to a non-public destination.

    Covers navigations, crawled links and subresources. Playwright does not
    route redirect hops, so callers re-check the final page URL after goto.
    """
    verdicts: dict[str, bool] = {}

    async def guard(route: "Route") -> None:
        url = route.request.url
        parts = urlsplit(url)
        key = f"{parts.scheme}://{parts.hostname}"
        allowed = verdicts.get(key)
        if allowed is None:
            try:
                await check_url(url)
                allowed = True
            except BlockedTarget as exc:
                logger.warning("Blocked scan request to %s: %s", url, exc)
                allowed = False
            verdicts[key] = allowed
        if allowed:
            await route.continue_()
        else:
            await route.abort("blockedbyclient")

    await context.route("**/*", guard)
