#!/usr/bin/env python3
"""Capture a site's declared cookies (from its consent banner) and the cookies it really sets.

Supported banner vendors (CMPs), detected automatically, each of which publishes
a category for every cookie name:

* OneTrust    ``window.OneTrust.GetDomainData()`` groups
* Cookiebot   ``window.CookieConsentDialog.cookieTable{Necessary,Preference,Statistics,Advertising}``
* Ketch       ``ketchcdn.com/.../config.json``: ``purposes[].cookies[]``
* Transcend   ``transcend-cdn.com/cm/<id>/airgap.js``: ``{"cookie": ..., "purposes": [...]}``
* Securiti    ``securiti.ai/consent/cookie_banner/.../<lang>.json``: ``categories[].cookies[]``

Writes one banner export per site, ``cookies_<site>_<YYYY-MM-DD>.csv``, in the
format ``build_production_dataset.py`` reads:

1. Load the site, then read the vendor's declaration (in-page for OneTrust and
   Cookiebot, from the vendor's config response for the others).
2. Accept all cookies (the vendor's own button or API, else a generic "Accept all"
   button), reload, then browse a few same-site pages so cookies that are only set
   after consent or on later pages appear.
3. Read every cookie the browser holds through CDP (unset SameSite stays "unspecified").
4. Match declarations to observed cookies by name (templated names such as
   ``_ga_xxxxxxxxxx`` or ``BIGipServer#`` match as prefixes), preferring a
   declaration whose host matches the cookie's domain.

Rows: "Declared & set" (declared under one category and observed: the only rows
that become training labels), "Declared, not set", "Not declared" and "Declared,
conflicting". Category names are kept as the site wrote them; the dataset builder
maps them (``LABEL_ALIASES``) and drops names it can't map. Cookie values are never
read or written.

    python -m backend.scripts.collect_banner_cookies --out-dir <dir> www.ikea.com/us/ www.okta.com
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import re
import time
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlsplit

COLUMNS = [
    "category", "categorySource", "cmp", "name", "domain", "path", "party", "expires",
    "declaredDuration", "httpOnly", "secure", "sameSite", "partitioned", "status",
    "provider", "description",
]
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_TEMPLATE = re.compile(r"(x{3,}|n{3,}|\[x\]|#+)$", re.IGNORECASE)

ONETRUST_JS = """() => {
  if (!window.OneTrust || !window.OneTrust.GetDomainData) return null;
  const out = [];
  for (const g of window.OneTrust.GetDomainData().Groups || []) {
    const add = (c, host) => out.push({
      group: g.GroupName || "", name: c.Name || "", host: host || c.Host || "",
      length: c.Length, session: !!c.IsSession, pattern: !!(c.patternKey || c.PatternKey),
      description: (c.description || "").slice(0, 600), cmp: "OneTrust"});
    for (const c of g.FirstPartyCookies || []) add(c, c.Host);
    for (const h of g.Hosts || []) for (const c of h.Cookies || []) add(c, h.HostName);
  }
  return out;
}"""
DECLARATION_JS = ONETRUST_JS  # kept for callers of the earlier OneTrust-only collector

COOKIEBOT_JS = """() => {
  const d = window.CookieConsentDialog;
  if (!d) return null;
  const tables = {};
  for (const key of ["Necessary", "Preference", "Statistics", "Advertising", "Unclassified"]) {
    tables[key] = d["cookieTable" + key] || [];
  }
  return tables;
}"""

# Cookiebot's table names -> the category name written to the export.
COOKIEBOT_GROUPS = {"Necessary": "Necessary", "Preference": "Preferences", "Statistics": "Statistics",
                    "Advertising": "Marketing", "Unclassified": "Unclassified"}

# Network responses that carry a vendor's declaration.
VENDOR_RESPONSES = {
    "Ketch": re.compile(r"ketchcdn\.com/.+/config\.json"),
    "Transcend": re.compile(r"transcend-cdn\.com/cm/[^/]+/airgap\.js"),
    "Securiti": re.compile(r"securiti\.ai/consent/cookie_banner/.+/[a-z]{2}(-[a-z]{2})?\.json", re.IGNORECASE),
}

# Vendor "accept all" controls, tried before the generic button search.
VENDOR_ACCEPT = {
    "OneTrust": ("#onetrust-accept-btn-handler",
                 "() => !!(window.OneTrust && window.OneTrust.AllowAll && (window.OneTrust.AllowAll(), true))"),
    "Cookiebot": ("#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
                  "() => !!(window.Cookiebot && window.Cookiebot.submitCustomConsent"
                  " && (window.Cookiebot.submitCustomConsent(true, true, true), true))"),
}
GENERIC_ACCEPT = re.compile(
    r"^\s*(accept( all)?( cookies)?|allow( all)?( cookies)?|i agree|agree( and continue)?|"
    r"i accept|accept & continue|got it|ok(ay)?)\s*$", re.IGNORECASE)

_REGEX_META = re.compile(r"[\\.^$*+?{}\[\]()|]")


def _declaration(cmp: str, group: str, name: str, *, host: str = "", length=None, session: bool = False,
                 pattern: bool = False, description: str = "") -> dict:
    return {"group": group, "name": name, "host": host, "length": length, "session": session,
            "pattern": pattern, "description": (description or "")[:600], "cmp": cmp}


def _regex_prefix(regex: str) -> str:
    """Literal prefix of a cookie-name regex (``^_gac_\\w+`` -> ``_gac_``)."""
    literal = regex.lstrip("^").replace("\\\\", "\\")
    cut = _REGEX_META.search(literal)
    return literal[:cut.start()] if cut else literal


def parse_cookiebot_tables(tables: dict) -> list[dict]:
    """Cookiebot rows: [name, provider domains, purpose, expiry, type, _, regex, ...]; HTTP cookies only."""
    declarations = []
    for key, rows in (tables or {}).items():
        group = COOKIEBOT_GROUPS.get(key, key)
        for row in rows or []:
            if len(row) < 5 or str(row[4]).strip().lower() != "http cookie":
                continue
            name, regex = str(row[0]).strip(), str(row[6]).strip() if len(row) > 6 else ""
            host = str(row[1]).split("<br/>")[0].strip()
            declarations.append(_declaration("Cookiebot", group, name, host=host,
                                             session=str(row[3]).strip().lower() == "session",
                                             pattern=bool(regex) or bool(_TEMPLATE.search(name)),
                                             description=str(row[2])))
    return declarations


def parse_ketch_config(config: dict) -> list[dict]:
    """Ketch ``config.json``: each purpose lists its cookies; the purpose name is the category."""
    declarations = []
    for purpose in (config or {}).get("purposes") or []:
        group = purpose.get("name") or purpose.get("canonicalPurposeCode") or ""
        for cookie in purpose.get("cookies") or []:
            name = (cookie.get("name") or cookie.get("code") or "").strip()
            if name:
                declarations.append(_declaration("Ketch", group, name, length=cookie.get("durationDays"),
                                                 pattern=bool(_TEMPLATE.search(name)),
                                                 description=cookie.get("serviceProvider") or ""))
    return declarations


_TRANSCEND_ENTRY = re.compile(r'\{"cookie":"((?:[^"\\]|\\.)*)","purposes":\[([^\]]*)\](,"regex":true)?')
_TRANSCEND_NOT_A_CATEGORY = {"SaleOfInfo"}


def parse_transcend_airgap(script: str) -> list[dict]:
    """Transcend ``airgap.js`` embeds ``{"cookie": name, "purposes": [...]}`` entries.

    ``SaleOfInfo`` is a US opt-out flag, not a category, so it is ignored when the
    cookie has another purpose. A cookie with two real purposes gets one declaration
    per purpose, which the row builder reports as "Declared, conflicting". URL
    entries are dropped; regex names become prefix patterns (or are dropped).
    """
    declarations = []
    for match in _TRANSCEND_ENTRY.finditer(script or ""):
        name = json.loads(f'"{match.group(1)}"')
        purposes = [p.strip().strip('"') for p in match.group(2).split(",") if p.strip()]
        if match.group(3):
            name = _regex_prefix(name)
            if len(name) < 3:
                continue
        if not name or "/" in name or ":" in name or " " in name:
            continue
        real = [p for p in purposes if p not in _TRANSCEND_NOT_A_CATEGORY] or purposes
        for purpose in real:
            declarations.append(_declaration("Transcend", purpose, name, pattern=bool(match.group(3))))
    return declarations


def parse_securiti_banner(banner: dict) -> list[dict]:
    """Securiti cookie-banner JSON: ``categories[].cookies[]``, HTTP cookies only."""
    declarations = []
    for category in (banner or {}).get("categories") or []:
        group = category.get("name") or category.get("base_category") or ""
        for cookie in category.get("cookies") or []:
            name = (cookie.get("name") or "").strip()
            if not name or (cookie.get("type") or "http_cookie") != "http_cookie":
                continue
            seconds = cookie.get("duration")
            declarations.append(_declaration(
                "Securiti", group, name, host=cookie.get("provider") or "",
                length=round(seconds / 86400, 2) if isinstance(seconds, (int, float)) and seconds > 0 else None,
                session=seconds == 0, pattern=bool(_TEMPLATE.search(name)),
                description=cookie.get("purpose") or ""))
    return declarations


def parse_vendor_response(vendor: str, body: str) -> list[dict]:
    """Declarations from one captured vendor response; [] when it isn't a declaration."""
    try:
        if vendor == "Transcend":
            return parse_transcend_airgap(body)
        data = json.loads(body)
    except (ValueError, TypeError):
        return []
    if vendor == "Ketch":
        return parse_ketch_config(data)
    if vendor == "Securiti":
        return parse_securiti_banner(data)
    return []


def _bare(host: str) -> str:
    return (host or "").lower().lstrip(".").removeprefix("www.")


def _name_matches(declared: dict, observed: str) -> bool:
    name = declared["name"]
    if name == observed:
        return True
    prefix = _TEMPLATE.sub("", name)
    templated = declared["pattern"] or prefix != name
    return templated and len(prefix) >= 2 and observed.startswith(prefix)


def _host_matches(declared_host: str, cookie_domain: str) -> bool:
    d, c = _bare(declared_host), _bare(cookie_domain)
    return bool(d) and (c == d or c.endswith("." + d) or d.endswith("." + c))


def _expires(cookie: dict, now: float) -> str:
    if cookie.get("session") or cookie.get("expires", -1) <= 0:
        return "Session"
    days = max((cookie["expires"] - now) / 86400, 0)
    return f"{days:.2f} days"


def _declared_duration(declared: dict) -> str:
    if declared["session"]:
        return "Session"
    return f"{declared['length']} days" if declared["length"] not in (None, "") else ""


def build_rows(declarations: list[dict], cookies: list[dict], site_host: str, now: float) -> list[dict]:
    """Join declarations with observed cookies into export rows."""
    rows, matched = [], set()
    for cookie in cookies:
        candidates = [d for d in declarations if _name_matches(d, cookie["name"])]
        by_host = [d for d in candidates if _host_matches(d["host"], cookie["domain"])]
        pick = by_host or candidates
        groups = {d["group"] for d in pick}
        party = "First party" if _host_matches(site_host, cookie["domain"]) else "Third party"
        observed = {
            "name": cookie["name"], "domain": cookie["domain"], "path": cookie.get("path", ""),
            "party": party, "expires": _expires(cookie, now),
            "httpOnly": str(bool(cookie.get("httpOnly"))).lower(),
            "secure": str(bool(cookie.get("secure"))).lower(),
            "sameSite": (cookie.get("sameSite") or "unspecified").lower(),
            "partitioned": str(bool(cookie.get("partitionKey"))).lower(),
        }
        if len(groups) == 1:
            declared = pick[0]
            matched.update(id(d) for d in pick)
            rows.append({**observed, "category": declared["group"], "categorySource": "banner",
                         "cmp": declared.get("cmp", "OneTrust"), "declaredDuration": _declared_duration(declared),
                         "status": "Declared & set", "provider": declared["host"],
                         "description": declared["description"]})
        else:
            # Undeclared, or declared under several categories: not a trustworthy label.
            matched.update(id(d) for d in pick)
            rows.append({**observed, "category": "Unclassified", "categorySource": "none", "cmp": "",
                         "declaredDuration": "", "status": "Not declared" if not groups else "Declared, conflicting",
                         "provider": "", "description": ""})
    for declared in declarations:
        if id(declared) in matched:
            continue
        rows.append({"category": declared["group"], "categorySource": "banner",
                     "cmp": declared.get("cmp", "OneTrust"),
                     "name": declared["name"], "domain": declared["host"], "path": "", "party": "",
                     "expires": "", "declaredDuration": _declared_duration(declared), "httpOnly": "",
                     "secure": "", "sameSite": "", "partitioned": "", "status": "Declared, not set",
                     "provider": declared["host"], "description": declared["description"]})
    return rows


async def read_declarations(page, responses: dict[str, list[str]], wait_ms: int = 10000) -> tuple[str, list[dict]]:
    """Poll until one supported vendor's declaration is available; returns (vendor, declarations)."""
    for _ in range(max(1, wait_ms // 500)):
        onetrust = await page.evaluate(ONETRUST_JS)
        if onetrust:
            return "OneTrust", onetrust
        cookiebot = parse_cookiebot_tables(await page.evaluate(COOKIEBOT_JS) or {})
        if cookiebot:
            return "Cookiebot", cookiebot
        for vendor, bodies in responses.items():
            for body in bodies:
                declarations = parse_vendor_response(vendor, body)
                if declarations:
                    return vendor, declarations
        await page.wait_for_timeout(500)
    return "", []


def watch_vendor_responses(page) -> dict[str, list[str]]:
    """Collect bodies of vendor declaration responses as the page loads them."""
    captured: dict[str, list[str]] = {vendor: [] for vendor in VENDOR_RESPONSES}

    async def on_response(response) -> None:
        for vendor, pattern in VENDOR_RESPONSES.items():
            if pattern.search(response.url):
                try:
                    captured[vendor].append((await response.body()).decode("utf-8", "replace"))
                except Exception:  # redirects and aborted responses have no body
                    pass

    page.on("response", lambda response: asyncio.ensure_future(on_response(response)))
    return captured


async def accept_all(page, vendor: str) -> bool:
    """Click the vendor's accept control or call its API; else click a generic "Accept all" button."""
    selector, api = VENDOR_ACCEPT.get(vendor, (None, None))
    if selector:
        try:
            await page.click(selector, timeout=5000)
            return True
        except Exception:
            pass
    if api and await page.evaluate(api):
        return True
    try:
        button = page.get_by_role("button", name=GENERIC_ACCEPT).first
        await button.click(timeout=5000)
        return True
    except Exception:
        return False


async def capture(browser, target: str, pages: int) -> tuple[str, list[dict], dict]:
    url = target if "://" in target else f"https://{target}"
    site_host = urlsplit(url).hostname
    context = await browser.new_context(user_agent=USER_AGENT, locale="en-US",
                                        viewport={"width": 1440, "height": 900})
    page = await context.new_page()
    responses = watch_vendor_responses(page)
    info = {"site": site_host, "cmp": "", "accepted": False, "pages": 0}
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        info["cmp"], declarations = await read_declarations(page, responses)
        info["accepted"] = await accept_all(page, info["cmp"])
        await page.wait_for_timeout(3000)
        await page.reload(wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(3000)
        links = await page.evaluate("""() => [...new Set([...document.querySelectorAll('a[href]')]
            .map(a => a.href).filter(h => h.startsWith(location.origin) && !/logout|signout|sign-out|login|cart|checkout/i.test(h)))]""")
        for link in links[1:1 + pages]:
            try:
                await page.goto(urljoin(url, link), wait_until="domcontentloaded", timeout=30000)
                await page.mouse.wheel(0, 4000)
                await page.wait_for_timeout(2500)
                info["pages"] += 1
            except Exception:
                continue
        cdp = await context.new_cdp_session(page)
        cookies = (await cdp.send("Network.getAllCookies"))["cookies"]
        info.update(declared=len(declarations), observed=len(cookies))
        return site_host, build_rows(declarations, cookies, site_host, time.time()), info
    finally:
        await context.close()


async def main_async(args: argparse.Namespace) -> None:
    from playwright.async_api import async_playwright

    args.out_dir.mkdir(parents=True, exist_ok=True)
    day = args.date or date.today().isoformat()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            for target in args.sites:
                try:
                    site, rows, info = await capture(browser, target, args.pages)
                except Exception as exc:  # one site failing must not stop the batch
                    print(f"FAILED {target}: {exc}")
                    continue
                path = args.out_dir / f"cookies_{site}_{day}.csv"
                with path.open("w", newline="", encoding="utf-8") as handle:
                    writer = csv.DictWriter(handle, fieldnames=COLUMNS)
                    writer.writeheader()
                    writer.writerows(rows)
                set_count = sum(r["status"] == "Declared & set" for r in rows)
                print(f"{site}: cmp={info['cmp'] or 'none'} declared={info['declared']} observed={info['observed']} "
                      f"declared&set={set_count} accepted={info['accepted']} pages={info['pages']} -> {path}")
        finally:
            await browser.close()


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("sites", nargs="+", help="Site host, optionally with a path (www.ikea.com/us/)")
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--pages", type=int, default=4, help="Same-site pages to visit after accepting")
    parser.add_argument("--date", help="Date for the file name (default: today)")
    return parser.parse_args(argv)


if __name__ == "__main__":
    asyncio.run(main_async(parse_args()))
