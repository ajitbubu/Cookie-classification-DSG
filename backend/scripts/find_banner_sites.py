#!/usr/bin/env python3
"""Check candidate sites before banner collection. Collects no cookies.

For each host in a candidate list (one per line, ``#`` comments allowed):

1. Read ``https://<host>/robots.txt``. A site is usable only if robots.txt
   explicitly allows ``/`` for any user agent (a missing robots.txt, HTTP 404/410,
   counts as allowed; any other failure is "unknown" and is not usable).
2. Load the homepage once in headless Chromium and wait up to 8 s for a supported
   banner vendor (OneTrust, Cookiebot, Ketch, Transcend, Securiti) to publish a
   non-empty per-cookie declaration. Detection is the collector's own
   (``collect_banner_cookies.read_declarations``), so both always agree.

Writes one CSV row per host (site, robots, final_host, cmp, declared, error,
usable) and prints a summary per vendor.

    python -m backend.scripts.find_banner_sites candidates.txt --out verified.csv
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import urllib.request
import urllib.robotparser
from pathlib import Path
from urllib.parse import urlsplit

from collections import Counter

from backend.scripts.collect_banner_cookies import USER_AGENT, read_declarations, watch_vendor_responses

COLUMNS = ["site", "robots", "final_host", "cmp", "declared", "error", "usable"]


def robots_allows(robots_txt: str, host: str) -> bool:
    """True when robots.txt lets any user agent fetch the homepage."""
    parser = urllib.robotparser.RobotFileParser()
    parser.parse(robots_txt.splitlines())
    return parser.can_fetch("*", f"https://{host}/")


def robots_status(host: str) -> str:
    """'allowed', 'disallowed', or 'unknown(<reason>)'. Only 'allowed' is usable."""
    request = urllib.request.Request(f"https://{host}/robots.txt", headers={"User-Agent": USER_AGENT})
    try:
        body = urllib.request.urlopen(request, timeout=15).read().decode("utf-8", "replace")
    except Exception as exc:  # network errors, HTTP errors, timeouts
        code = getattr(exc, "code", None)
        return "allowed" if code in (404, 410) else f"unknown({code or type(exc).__name__})"
    return "allowed" if robots_allows(body, host) else "disallowed"


async def check(browser, host: str, limit: asyncio.Semaphore) -> dict:
    async with limit:
        row = {"site": host, "robots": await asyncio.to_thread(robots_status, host), "final_host": "",
               "cmp": "", "declared": 0, "error": ""}
        if row["robots"] == "allowed":
            context = await browser.new_context(user_agent=USER_AGENT, locale="en-US",
                                                viewport={"width": 1440, "height": 900})
            try:
                page = await context.new_page()
                responses = watch_vendor_responses(page)
                await page.goto(f"https://{host}/", wait_until="domcontentloaded", timeout=30000)
                cmp, declarations = await read_declarations(page, responses, wait_ms=8000)
                row.update(final_host=urlsplit(page.url).hostname, cmp=cmp, declared=len(declarations))
            except Exception as exc:  # one site failing must not stop the batch
                row["error"] = str(exc).splitlines()[0][:120]
            finally:
                await context.close()
        row["usable"] = row["robots"] == "allowed" and bool(row["cmp"]) and row["declared"] > 0
        print(f"{host:34} robots={row['robots']:14} cmp={row['cmp'] or '-':10} "
              f"declared={row['declared']:5} {row['error']}", flush=True)
        return row


async def main_async(args: argparse.Namespace) -> None:
    from playwright.async_api import async_playwright

    hosts = [line.strip() for line in args.candidates.read_text().splitlines()
             if line.strip() and not line.startswith("#")]
    limit = asyncio.Semaphore(args.concurrency)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            rows = await asyncio.gather(*(check(browser, host, limit) for host in hosts))
        finally:
            await browser.close()
    with args.out.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    usable = Counter(r["cmp"] for r in rows if r["usable"])
    print(f"{len(rows)} checked, {sum(usable.values())} usable {dict(usable)} -> {args.out}")


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("candidates", type=Path, help="Text file, one host per line")
    parser.add_argument("--out", type=Path, required=True, help="Verification CSV to write")
    parser.add_argument("--concurrency", type=int, default=6)
    return parser.parse_args(argv)


if __name__ == "__main__":
    asyncio.run(main_async(parse_args()))
