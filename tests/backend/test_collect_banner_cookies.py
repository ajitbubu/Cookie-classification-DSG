"""Declaration-to-cookie matching in backend/scripts/collect_banner_cookies.py."""
from backend.scripts.build_production_dataset import normalize_banner_export_row
from backend.scripts.collect_banner_cookies import build_rows

NOW = 1_800_000_000.0


def _declared(name, group, host="example.com", pattern=False):
    return {"group": group, "name": name, "host": host, "length": 365, "session": False,
            "pattern": pattern, "description": ""}


def _cookie(name, domain=".example.com", **extra):
    return {"name": name, "domain": domain, "path": "/", "expires": NOW + 30 * 86400,
            "httpOnly": False, "secure": True, **extra}


def _by_name(rows):
    return {(row["name"], row["status"]): row for row in rows}


def test_declared_and_set_rows_carry_browser_attributes_and_banner_label():
    rows = _by_name(build_rows([_declared("_ga", "Performance Cookies")],
                               [_cookie("_ga", sameSite="Lax")], "www.example.com", NOW))
    row = rows[("_ga", "Declared & set")]
    assert row["categorySource"] == "banner" and row["category"] == "Performance Cookies"
    assert row["sameSite"] == "lax" and row["expires"] == "30.00 days" and row["party"] == "First party"
    normalized = normalize_banner_export_row(row, "www.example.com", "2026-11-10", "t")
    assert normalized["label_category"] == "Analytics_Performance" and normalized["expiry_days"]


def test_unset_samesite_stays_unspecified():
    rows = build_rows([_declared("lang", "Functional")], [_cookie("lang")], "example.com", NOW)
    assert rows[0]["sameSite"] == "unspecified"


def test_templated_declaration_matches_by_prefix_only_when_templated():
    declarations = [_declared("_ga_xxxxxxxxxx", "Analytics", pattern=True), _declared("ab", "Marketing")]
    rows = _by_name(build_rows(declarations, [_cookie("_ga_S4EX53B760"), _cookie("abc")], "example.com", NOW))
    assert rows[("_ga_S4EX53B760", "Declared & set")]["category"] == "Analytics"
    assert ("abc", "Not declared") in rows  # "ab" is not templated, so no prefix match


def test_host_specific_declaration_wins_and_conflicts_are_not_labels():
    declarations = [
        _declared("__cf_bm", "Strictly Necessary", host="example.com"),
        _declared("__cf_bm", "Marketing", host="vendor.net"),
        _declared("dual", "Functional"),
        _declared("dual", "Marketing"),
    ]
    rows = _by_name(build_rows(declarations, [_cookie("__cf_bm"), _cookie("dual")], "example.com", NOW))
    assert rows[("__cf_bm", "Declared & set")]["category"] == "Strictly Necessary"
    assert rows[("dual", "Declared, conflicting")]["categorySource"] == "none"


def test_unobserved_declarations_are_kept_without_attributes():
    rows = build_rows([_declared("never_set", "Marketing")], [], "example.com", NOW)
    assert rows == [{**rows[0], "status": "Declared, not set", "secure": "", "httpOnly": "", "expires": ""}]


def test_find_banner_sites_honours_robots_txt():
    from backend.scripts.find_banner_sites import robots_allows

    assert robots_allows("User-agent: *\nDisallow: /admin/\n", "example.com")
    assert not robots_allows("User-agent: *\nDisallow: /\n", "example.com")
    assert robots_allows("User-agent: Googlebot\nDisallow: /\n", "example.com")


# --- Vendor declaration parsers (shapes copied from live configs, 2026-11-11) ---

def test_cookiebot_tables_keep_http_cookies_and_mark_regex_names_as_patterns():
    from backend.scripts.collect_banner_cookies import parse_cookiebot_tables

    tables = {
        "Necessary": [["BIGipServer#", "go.example.com", "Load balancing.", "Session", "HTTP Cookie", "1",
                       "^BIGipServer.*", "go.example.com", "en", "1"]],
        "Statistics": [["_ga", "google.com<br/>example.com", "Analytics.", "400 days", "HTTP Cookie", "1", "", "", "en", "1"],
                       ["_ga_storage", "example.com", "Local storage.", "Persistent", "HTML Local Storage", "1", "", "", "en", "1"]],
        "Advertising": [["IDE", "doubleclick.net", "Ads.", "1 year", "HTTP Cookie", "1", "", "", "en", "1"]],
    }
    declarations = {d["name"]: d for d in parse_cookiebot_tables(tables)}

    assert set(declarations) == {"BIGipServer#", "_ga", "IDE"}  # local storage dropped
    assert declarations["BIGipServer#"]["pattern"] and declarations["BIGipServer#"]["session"]
    assert declarations["_ga"]["group"] == "Statistics" and declarations["_ga"]["host"] == "google.com"
    assert declarations["IDE"]["group"] == "Marketing" and declarations["IDE"]["cmp"] == "Cookiebot"
    rows = build_rows(list(declarations.values()), [_cookie("BIGipServer~pool_web")], "example.com", NOW)
    assert rows[0]["status"] == "Declared & set" and rows[0]["category"] == "Necessary"


def test_ketch_purposes_label_their_cookies_by_purpose_name():
    from backend.scripts.collect_banner_cookies import parse_ketch_config

    config = {"purposes": [
        {"code": "C0004", "name": "Advertising", "canonicalPurposeCode": "behavioral_advertising",
         "cookies": [{"ID": "_gcl_au", "name": "_gcl_au", "code": "_gcl_au", "serviceProvider": "Google Ads",
                      "durationDays": 89}]},
        {"name": "Strictly Necessary", "canonicalPurposeCode": "essential_services",
         "cookies": [{"code": "__cf_bm", "serviceProvider": "Cloudflare"}]},
        {"name": "Targeted Advertising", "canonicalPurposeCode": "personalization", "cookies": []},
    ]}
    declarations = {d["name"]: d for d in parse_ketch_config(config)}

    assert declarations["_gcl_au"]["group"] == "Advertising" and declarations["_gcl_au"]["length"] == 89
    assert declarations["__cf_bm"]["group"] == "Strictly Necessary"
    assert {d["cmp"] for d in declarations.values()} == {"Ketch"}


def test_transcend_airgap_entries_drop_urls_and_turn_conflicts_into_conflicts():
    from backend.scripts.collect_banner_cookies import parse_transcend_airgap

    script = ('x={"cookies":[{"cookie":"_fbp","purposes":["Advertising","SaleOfInfo"]},'
              '{"cookie":"_gac_\\\\w+","purposes":["Advertising","SaleOfInfo"],"regex":true},'
              '{"cookie":"JSESSIONID","purposes":["Essential"]},'
              '{"cookie":"https://www.example.com/account","purposes":["Essential"]},'
              '{"cookie":"opt_in_flag","purposes":["SaleOfInfo"]},'
              '{"cookie":"dual","purposes":["Analytics","Advertising"]}]}')
    declarations = parse_transcend_airgap(script)
    by_name = {}
    for d in declarations:
        by_name.setdefault(d["name"], []).append(d["group"])

    assert by_name["_fbp"] == ["Advertising"]           # SaleOfInfo ignored next to a real purpose
    assert by_name["_gac_"] == ["Advertising"]           # regex became a prefix pattern
    assert by_name["JSESSIONID"] == ["Essential"]
    assert by_name["opt_in_flag"] == ["SaleOfInfo"]      # kept; the builder can't map it, so it is dropped there
    assert not any("://" in name for name in by_name)
    rows = _by_name(build_rows(declarations, [_cookie("_gac_UA-1"), _cookie("dual")], "example.com", NOW))
    assert rows[("_gac_UA-1", "Declared & set")]["category"] == "Advertising"
    assert ("dual", "Declared, conflicting") in rows


def test_securiti_categories_keep_http_cookies_with_durations():
    from backend.scripts.collect_banner_cookies import parse_securiti_banner

    banner = {"categories": [
        {"name": "Advertising Cookies", "base_category": "Advertising", "cookies": [
            {"name": "IDE", "type": "http_cookie", "provider": "doubleclick.net", "duration": 34560006,
             "purpose": "Targeted ads."},
            {"name": "ad_pixel", "type": "pixel", "provider": "ads.example", "duration": 0}]},
        {"name": "Essential", "cookies": [{"name": "AKA_Lang", "type": "http_cookie", "provider": "www.hertz.com",
                                           "duration": 0}]},
    ]}
    declarations = {d["name"]: d for d in parse_securiti_banner(banner)}

    assert set(declarations) == {"IDE", "AKA_Lang"}
    assert declarations["IDE"]["group"] == "Advertising Cookies" and declarations["IDE"]["length"] == 400.0
    assert declarations["AKA_Lang"]["session"] and declarations["AKA_Lang"]["host"] == "www.hertz.com"


def test_vendor_category_names_map_and_ambiguous_ones_are_dropped():
    from backend.scripts.build_production_dataset import normalize_label

    expected = {
        "Statistics": "Analytics_Performance", "Preferences": "Functional", "Marketing": "Marketing_Advertising",
        "Essential Services": "Strictly_Necessary", "Performance & Analytics": "Analytics_Performance",
        "Targeted Advertising": "Marketing_Advertising", "Advertising Cookies": "Marketing_Advertising",
        "Functionality Cookies": "Functional", "Performance Cookies": "Analytics_Performance",
        # Mixes two of our classes, or isn't a category: never guessed.
        "Analytics & Customization": "", "Performance & Functionality": "", "SaleOfInfo": "", "DiRinProcess": "",
    }
    assert {name: normalize_label(name) for name in expected} == expected


def test_vendor_rows_carry_their_cmp_into_the_export():
    from backend.scripts.collect_banner_cookies import parse_ketch_config

    declarations = parse_ketch_config({"purposes": [{"name": "Analytics", "cookies": [{"name": "_ga"}]}]})
    row = build_rows(declarations, [_cookie("_ga")], "example.com", NOW)[0]
    assert row["cmp"] == "Ketch"
    normalized = normalize_banner_export_row(row, "example.com", "2026-11-11", "t")
    assert normalized["label_category"] == "Analytics_Performance" and normalized["_evidence"]["cmp"] == "ketch"
