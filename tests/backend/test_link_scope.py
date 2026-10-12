"""Which links a deep scan may follow (Deep Scan "Crawl Mode", Figma 12.08.02).

"Follow internal links only" keeps the crawl on the start host; "Follow
internal + subdomain links" also allows other hosts under the same site.
"""
from hypothesis import given, strategies as st

from backend.models import ScanRequest
from backend.scanner.cookie_scanner import is_link_in_scope, site_root


def test_site_root_drops_www():
    assert site_root("https://www.example.com/a") == "example.com"
    assert site_root("https://shop.example.com") == "shop.example.com"


def test_internal_only_keeps_the_exact_host():
    root = site_root("https://www.example.com")
    assert is_link_in_scope("www.example.com", "www.example.com", root, include_subdomains=False)
    assert is_link_in_scope("", "www.example.com", root, include_subdomains=False)  # relative link
    assert not is_link_in_scope("blog.example.com", "www.example.com", root, include_subdomains=False)


def test_subdomain_mode_follows_hosts_under_the_site():
    root = site_root("https://www.example.com")
    assert is_link_in_scope("blog.example.com", "www.example.com", root, include_subdomains=True)
    assert is_link_in_scope("example.com", "blog.example.com", root, include_subdomains=True)
    assert not is_link_in_scope("example.com.evil.net", "www.example.com", root, include_subdomains=True)
    assert not is_link_in_scope("notexample.com", "www.example.com", root, include_subdomains=True)


@given(st.from_regex(r"[a-z]{1,10}\.[a-z]{2,5}", fullmatch=True))
def test_other_sites_are_never_in_scope(other):
    root = site_root("https://www.example.com")
    if other != "example.com" and not other.endswith(".example.com"):
        assert not is_link_in_scope(other, "www.example.com", root, include_subdomains=True)


def test_scan_request_accepts_include_subdomains_and_defaults_off():
    assert ScanRequest(url="https://a.com").includeSubdomains is False
    assert ScanRequest(url="https://a.com", scanType="deep", includeSubdomains=True).includeSubdomains is True
