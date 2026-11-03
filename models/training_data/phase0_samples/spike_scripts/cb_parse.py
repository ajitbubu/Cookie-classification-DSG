import re, html, json, sys
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.sections=[]; s.cur=None; s.mode=None; s.row=None; s.cell=None; s.headers=[]
    def handle_starttag(s,t,a):
        c=dict(a).get("class","")
        if t=="div" and "CookieDeclarationType" == c.strip(): s.cur={"header":"","rows":[]}; s.sections.append(s.cur); s.headers=[]
        elif "CookieDeclarationTypeHeader" in c: s.mode="header"
        elif t=="tr" and s.cur is not None: s.row=[]
        elif t in("td","th") and s.row is not None: s.cell=""
    def handle_endtag(s,t):
        if t in("td","th") and s.cell is not None: s.row.append(re.sub(r"\s+"," ",s.cell).strip()); s.cell=None
        elif t=="tr" and s.row is not None:
            if not s.headers: s.headers=s.row
            else: s.cur["rows"].append(dict(zip(s.headers,s.row)))
            s.row=None
        elif s.mode=="header" and t in("div","span","p"): s.mode=None
    def handle_data(s,d):
        if s.cell is not None: s.cell+=d
        elif s.mode=="header" and s.cur is not None: s.cur["header"]+=d
def parse(path):
    js=open(path,encoding="utf-8").read()
    m=re.search(r"InjectCookieDeclaration\('(.*)'\);",js,re.S)
    body=m.group(1).encode().decode("unicode_escape").encode("latin-1").decode("utf-8") if m else ""
    p=P(); p.feed(html.unescape(body.replace("\\'","'")))
    culture=re.search(r"CookieDeclaration\.culture = '(\w+)'",js)
    return {"culture":culture.group(1) if culture else None,"sections":[{"header":x["header"].strip(),"n":len(x["rows"]),"rows":x["rows"]} for x in p.sections]}
if __name__=="__main__":
    r=parse(sys.argv[1]); print("culture",r["culture"])
    for s in r["sections"]: print(repr(s["header"]), s["n"], s["rows"][:1])
