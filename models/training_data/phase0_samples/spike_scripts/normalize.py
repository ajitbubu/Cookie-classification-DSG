import json,glob,sys,os,re,collections,csv
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from cb_parse import parse
OT_MAP=[(r"strictly|necessary|required|essential",'Strictly_Necessary'),(r"performance|analytic|statistic",'Analytics_Performance'),(r"functional|preference",'Functional'),(r"targeting|marketing|advertis|social",'Marketing_Advertising'),(r"other|unclassified",'Unclassified')]
def ot_label(group):
    g=group.lower()
    if "functional (necessary)" in g: return "Strictly_Necessary"
    for pat,lab in OT_MAP:
        if re.search(pat,g): return lab
    return None
CB_ORDER={"necessary":"Strictly_Necessary","nødvendig":"Strictly_Necessary","preferences":"Functional","præferencer":"Functional","statistics":"Analytics_Performance","statistik":"Analytics_Performance","marketing":"Marketing_Advertising","markedsføring":"Marketing_Advertising","unclassified":"Unclassified","uklassificeret":"Unclassified"}
rows=[]
for s in ["zoom.us","novonordisk.com","ikea.com","salesforce.com","okta.com"]:
    f=sorted(glob.glob(f"onetrust/{s}.*.en.json"))[0]
    for g in json.load(open(f))["DomainData"]["Groups"]:
        lab=ot_label(g["GroupName"])
        items=[(c,None) for c in g.get("FirstPartyCookies",[])]+[(c,h["HostName"]) for h in g.get("Hosts",[]) for c in h["Cookies"]]
        for c,host in items:
            rows.append(dict(cmp="onetrust",site_domain=s,cookie_name=c["Name"],declared_host=c.get("Host") or host,
              expiry_days=0 if c["IsSession"] else c.get("Length"),is_session=c["IsSession"],pattern=bool(c.get("patternKey")),
              native_category=g["GroupName"],label_category=lab,purpose=(c.get("description") or "")[:200]))
for s in ["dr.dk","politi.dk","cbs.dk","illum.dk","normalstores.com","berlingske.dk"]:
    r=parse(f"cookiebot/{s}.cdreport.js")
    for sec in r["sections"]:
        key=re.sub(r"\s*\(\d+\)\s*$","",sec["header"]).strip().lower()
        for row in sec["rows"]:
            v=list(row.values())  # Name, Provider, Purpose, Max storage, Type (positional; headers are localised)
            rows.append(dict(cmp="cookiebot",site_domain=s,cookie_name=v[0],declared_host=v[1],expiry_days=v[3],is_session=v[3].lower()=="session",
              pattern="[x]" in v[0] or "#" in v[0],native_category=sec["header"],label_category=CB_ORDER.get(key),purpose=v[2][:200],storage_type=v[4]))
json.dump(rows,open("normalized_rows.json","w"),indent=1,ensure_ascii=False)
print("rows",len(rows), collections.Counter((r["cmp"],r["label_category"]) for r in rows))
print("unmapped native categories:",{r["native_category"] for r in rows if r["label_category"] is None})
cb=[r for r in rows if r["cmp"]=="cookiebot"]
print("cookiebot storage types:",collections.Counter(r["storage_type"] for r in cb))
print("cookiebot expiry samples:",sorted({r["expiry_days"] for r in cb})[:40])
