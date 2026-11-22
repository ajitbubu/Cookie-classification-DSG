"""A site's own cookie declaration, read from its consent banner (OneTrust, Cookiebot).

Sites using these consent platforms publish a category for each cookie name in
the banner itself. Shared by the training collector
(``backend/scripts/collect_banner_cookies.py``) and the production scanner, so a
cookie is matched to a declaration the same way in both.

Matching (``declaration_for``): exact name, or a templated name ("_ga_xxxxxxxxxx",
"BIGipServer#") as a prefix; a declaration whose host matches the cookie's
domain wins over others. A cookie declared under more than one category gets no
declaration: that isn't a trustworthy label.
"""

import re
from typing import Any, Dict, List, Optional, Tuple

from backend.scripts.build_production_dataset import normalize_label

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

COOKIEBOT_JS = """() => {
  const d = window.CookieConsentDialog;
  if (!d) return null;
  const tables = {};
  for (const key of ["Necessary", "Preference", "Statistics", "Advertising", "Unclassified"]) {
    tables[key] = d["cookieTable" + key] || [];
  }
  return tables;
}"""

# Cheap check before waiting for a declaration: is OneTrust or Cookiebot on the page?
DETECT_JS = r"""() => {
  if (window.OneTrust || window.Optanon || window.OneTrustStub || window.CookieConsentDialog || window.Cookiebot) return true;
  return [...document.scripts].some((s) => /cookielaw\.org|onetrust|otSDKStub|optanon|cookiebot\.com/i.test(s.src || ""));
}"""

# Cookiebot's table names -> the category name written to the export.
COOKIEBOT_GROUPS = {"Necessary": "Necessary", "Preference": "Preferences", "Statistics": "Statistics",
                    "Advertising": "Marketing", "Unclassified": "Unclassified"}

# Training taxonomy (normalize_label) -> the category names the app shows.
APP_CATEGORY = {"Strictly_Necessary": "Strictly Necessary", "Functional": "Functional",
                "Analytics_Performance": "Analytics", "Marketing_Advertising": "Marketing"}


def _declaration(cmp: str, group: str, name: str, *, host: str = "", length=None, session: bool = False,
                 pattern: bool = False, description: str = "") -> dict:
    return {"group": group, "name": name, "host": host, "length": length, "session": session,
            "pattern": pattern, "description": (description or "")[:600], "cmp": cmp}


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


def matching_declarations(declarations: List[dict], name: str, domain: str) -> List[dict]:
    """The declarations that apply to an observed cookie (host-matched ones first, if any)."""
    candidates = [d for d in declarations if _name_matches(d, name)]
    by_host = [d for d in candidates if _host_matches(d["host"], domain)]
    return by_host or candidates


def _declared_duration(declared: dict) -> str:
    if declared["session"]:
        return "Session"
    return f"{declared['length']} days" if declared["length"] not in (None, "") else ""


def declaration_for(declarations: List[dict], cookie: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The site's declared category for one observed cookie, or None (undeclared or conflicting).

    ``category`` is the app's name for it, or None when the site's group maps to no
    category we use (the raw ``group`` is still kept as evidence).
    """
    pick = matching_declarations(declarations, cookie.get("name", ""), cookie.get("domain", ""))
    if len({d["group"] for d in pick}) != 1:
        return None
    declared = pick[0]
    return {
        "category": APP_CATEGORY.get(normalize_label(declared["group"])),
        "group": declared["group"],
        "cmp": declared.get("cmp", ""),
        "provider": declared["host"],
        "declaredDuration": _declared_duration(declared),
    }


def annotate_cookies(cookies: List[Dict[str, Any]], declarations: List[dict]) -> int:
    """Set ``websiteDeclaration`` on each cookie the site declares; returns how many matched."""
    matched = 0
    for cookie in cookies:
        if "websiteDeclaration" in cookie:
            continue
        found = declaration_for(declarations, cookie) if declarations else None
        if found:
            cookie["websiteDeclaration"] = found
            matched += 1
    return matched


async def read_site_declarations(page, wait_ms: int = 4000, poll_ms: int = 250) -> Tuple[str, List[dict]]:
    """(cmp, declarations) from a loaded page; ("", []) at once when no supported CMP is on it.

    OneTrust/Cookiebot load their data a second or two after the page (0.6-1.9 s on
    bankofamerica.com, ikea.com and okta.com, 2026-11-21), hence the bounded poll.
    """
    try:
        if not await page.evaluate(DETECT_JS):
            return "", []
        for _ in range(max(1, wait_ms // poll_ms)):
            onetrust = await page.evaluate(ONETRUST_JS)
            if onetrust:
                return "OneTrust", onetrust
            cookiebot = parse_cookiebot_tables(await page.evaluate(COOKIEBOT_JS) or {})
            if cookiebot:
                return "Cookiebot", cookiebot
            await page.wait_for_timeout(poll_ms)
    except Exception:  # navigation or a closed page: scan without the declaration
        return "", []
    return "", []
