# Your first scan: from a website to a published cookie list

You'll scan a real website, see which cookies it sets and which categories its own
consent banner gives them, approve the categories in the Review Queue, and publish the
result as the site's cookie list. It takes about 10 minutes, and by the end you'll know
the whole path a cookie takes through the app.

## What you'll need

- Docker Desktop running and this repo checked out.
- A login for the app (nginx basic auth), or use the dev server on
  `http://localhost:5173`, which skips the login.

## Step 1: Start the stack

```bash
docker compose up -d
curl -s http://localhost:1001/api/health
```

You should see `"status":"healthy"` and `"egress_proxy":"ok"`. If you get a 503 or no
answer, see [How to diagnose failing scans](how-to/diagnose-failing-scans.md).

## Step 2: Scan a website

Open `http://localhost:5173`, go to **Scanning**, type `www.okta.com` in the URL box
and click **Start Scan**.

The app switches to **Active Scan** and shows a card with the scan's progress. A quick
scan of okta.com takes about 5 seconds. When it finishes, the results open.

> You can start another website while this one runs: go back to **Launch New Scan**
> and scan a different site. Each gets its own card. Starting the same site twice
> isn't allowed; its Start button reads "Scanning…" until it finishes.

## Step 3: See what the site itself declared

okta.com uses a OneTrust consent banner, so the scan read the category the site gives
each cookie. Open the **Cookies** tab of the results and click the history icon on any
row. The detail card opens with **Why <category>**, and its first line says where the
category came from, for example:

> Declared as Marketing ("Targeting Cookies") in the site's OneTrust banner.

Cookies the banner doesn't cover show the model's suggestion and confidence instead,
or a known-cookie match ("Listed in the Open Cookie Database (Cloudflare)").

## Step 4: Approve categories in the Review Queue

Go to **Cookie Classification → Review Queue**. Nothing publishes until a person
approves it, so every okta.com cookie is here.

- Rows marked **Site declared** carry the site's category, pre-selected in the
  **Category** column.
- A row marked **Site and model disagree** is in **High priority**: the site's banner
  says one thing and the model is confident it's another (for example "Necessary" vs
  "Marketing"). Check those first; they're the compliance findings.
- A cookie name set by several domains is one row listing all of them; one approval
  covers every domain.

Change a category with the **Category** dropdown if needed, then click **Approve** on
a row (or **Approve All**). Approved rows leave the queue.

## Step 5: Publish the cookie list

Open **Websites**, click **okta.com**, and on the **Overview** tab find **Version
History**. Open the latest version's **Action** menu and choose **Publish**. That
version is now okta.com's published cookie list.

## What you built

You scanned okta.com, saw categories from three sources (the site's own banner, known
cookie lists and the model), reviewed the suggestions, caught any place the site and
the model disagree, and published an approved cookie list.

Next:

- Scan it on a schedule: [How to run scheduled scans](how-to/run-scheduled-scans.md).
- Exactly how a category is chosen: [How a cookie gets its category](cookie-classification-flow.md).
- Why the site's declaration isn't trusted blindly: [Site declarations](explanation/site-declarations.md).
- API details: [Scan API](reference/scan-api.md), [Scan store API](reference/scan-store-api.md).
