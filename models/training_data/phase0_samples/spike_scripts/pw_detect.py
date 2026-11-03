import asyncio, json, re, sys
from playwright.async_api import async_playwright
async def probe(browser, site):
    ctx = await browser.new_context(locale="en-GB")
    page = await ctx.new_page()
    urls = []
    page.on("request", lambda r: urls.append(r.url) if re.search(r"cookiebot|cookielaw|onetrust|usercentrics", r.url) else None)
    res = {"site": site}
    try:
        await page.goto((f"https://{site}/" if site.count(".")>1 else f"https://www.{site}/"), wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(4000)
        res["globals"] = await page.evaluate("""() => ({
            onetrust: !!window.OneTrust, cookiebot: !!window.Cookiebot,
            cbid: window.Cookiebot && (window.Cookiebot.serial || window.Cookiebot.cbid) || null,
            ot_domain: (window.OneTrust && window.OneTrust.GetDomainData) ? (()=>{const d=window.OneTrust.GetDomainData(); return {groups:d.Groups.length, cookies:d.Groups.reduce((n,g)=>n+(g.FirstPartyCookies||[]).length+(g.Hosts||[]).reduce((m,h)=>m+h.Cookies.length,0),0)}})() : null,
            usercentrics: !!(window.UC_UI || window.__ucCmp)
        })""")
        ids = set()
        for u in urls:
            m = re.search(r"consent\.cookiebot\.(?:com|eu)/(?:uc\.js\?cbid=)?([0-9a-f-]{36})", u)
            if m: ids.add(("cookiebot", m.group(1)))
            m = re.search(r"cookielaw\.org/consent/([0-9a-f-]{36}(?:-test)?)", u)
            if m: ids.add(("onetrust", m.group(1)))
        res["ids"] = sorted(ids)
    except Exception as e:
        res["error"] = str(e)[:150]
    await ctx.close()
    return res
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for s in sys.argv[1:]:
            print(json.dumps(await probe(b, s)), flush=True)
        await b.close()
asyncio.run(main())
