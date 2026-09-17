# Deployment Guide — Historic Property Research, City of Elgin

Static bundle (HTML/CSS/JS + GeoJSON). No server, no build step.

**Target URL: `https://studiogwa.github.io/elgin/`** — which means the repo has to be named exactly `elgin` in the `studiogwa` organization. GitHub Pages builds the URL from the org name and the repo name, nothing else.

Sections 1–3 get it live. Sections 4–6 are the "eventually" items.

---

## 1. Mapbox token

The basemap comes from Mapbox, which needs a public access token. `config.js` already has one — the same token as the Rockford survey map, on your `michael-smith` Mapbox account. **It works as-is, so you can skip this section today** and come back to it.

Two reasons you'd want a separate token for this site:

- Usage is metered per token, so a separate one tells you how much traffic this map is getting versus Rockford's.
- A token restricted to specific URLs can't be lifted and used on someone else's site.

### Making one

1. Go to **[account.mapbox.com](https://account.mapbox.com)** and sign in. (If Studio GWA should own this rather than your personal account, create the account under a firm email first — worth deciding before the client-facing URL goes out.)
2. Left sidebar → **Tokens** → **Create a token**.
3. Name it something like `elgin-rerz-map`.
4. **Scopes:** leave the defaults. A new token starts with the public scopes (`styles:read`, `fonts:read`, `datasets:read`, `tilesets:read`), which is exactly what this site needs. Do not tick any of the secret scopes (anything marked `:write`).
5. **URL restrictions** — this is the part worth doing. Add:
   ```
   https://studiogwa.github.io/elgin/*
   ```
   Plus `http://localhost:8000/*` if you want to keep testing locally, and any custom domain later (section 5). A token with URL restrictions only works when the request comes from one of those pages.
6. Click **Create token**, copy it (starts with `pk.`).
7. In `config.js`, replace the value of `MAPBOX_TOKEN` with your new one. Keep the quotes.

**On the free tier:** 50,000 map loads per month, no credit card. One person clicking around this map is a handful of loads. You will not approach the limit, and Mapbox does not bill without a card on file — it stops serving tiles instead.

**Public tokens are meant to be public.** A `pk.` token sits in the source of every Mapbox site on the internet; that's how the service works. The URL restriction is the actual protection.

---

## 2. Push to the Studio GWA GitHub org

Pick one route. Option A is faster if you've used git in Terminal before; Option B never leaves the browser.

### Create the repo (both routes)

1. Sign in to GitHub as a member of the `studiogwa` organization.
2. Top right **+** → **New repository**.
3. **Owner:** `studiogwa` (not your personal account — this dropdown is the step people miss).
4. **Repository name:** `elgin` — exactly that, lowercase. This is what makes the URL `studiogwa.github.io/elgin/`.
5. **Public.** GitHub Pages on a free org plan only publishes public repos. (If the org has Team or Enterprise, private works too.)
6. Leave "Add a README," ".gitignore," and "license" all **unchecked** — this folder already has files, and an initialized repo makes the first push conflict.
7. **Create repository.** You'll land on a page of setup instructions — leave that tab open.

### Option A — Terminal

This folder is already a git repository with a commit on `main`. You're just adding the remote and pushing.

1. Open Terminal.
2. Paste this, all four lines (the quotes matter, the folder name has spaces):

   ```bash
   cd ~/Library/CloudStorage/OneDrive-StudioGWA/Documents/Claude/Projects/"Elgin Historic Website"/elgin
   git remote add origin https://github.com/studiogwa/elgin.git
   git branch -M main
   git push -u origin main
   ```

3. **When it asks for credentials:** username is your GitHub username; for the password, GitHub will not accept your account password. You need a personal access token:
   - GitHub → click your avatar → **Settings** → scroll to **Developer settings** (very bottom of the left sidebar) → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
   - Note: `studio gwa repos`. Expiration: 90 days is fine. Scope: tick **`repo`** (the top-level checkbox).
   - Generate, copy it immediately — GitHub shows it once.
   - Paste it as the password. Terminal shows nothing while you paste; that's normal, just press Return.
   - macOS Keychain remembers it, so you only do this once.
4. You should see `Writing objects… done.` and a branch summary. Refresh the GitHub page — files are there.

### Option B — Browser upload, no Terminal

1. On the empty repo page, click **"uploading an existing file."**
2. Open the `elgin` folder in Finder. Select these and drag them into the browser drop area **all at once**:
   `index.html`, `style.css`, `config.js`, `app.js`, `DEPLOYMENT.md`, `README.md`, `build_data.py`, and the `data` and `assets` folders.
   - Do **not** include `_source` (the raw GeoPackages — reference only, and large).
   - Drag-and-drop preserves folder structure, so `data/` and `assets/` land as real subfolders.
3. Wait for all files to finish uploading — the GeoJSON files are a few MB and take a moment.
4. Commit message: `Initial site`. Click **Commit changes**.

---

## 3. Turn on GitHub Pages

1. In the repo: **Settings** (top tab) → **Pages** (left sidebar).
2. Under "Build and deployment," **Source: Deploy from a branch**.
3. Branch: **`main`**, folder: **`/ (root)`**. Click **Save**.
4. Wait one to two minutes. Refresh the Pages settings screen — a green banner appears with the live URL.
5. Open **`https://studiogwa.github.io/elgin/`**.

**The trailing slash matters.** `studiogwa.github.io/elgin` without it usually redirects fine, but if you get a 404, try it with the slash before assuming something broke.

### If it 404s after a few minutes

- Check the **Actions** tab for a failed "pages build and deployment" run.
- Confirm `index.html` is at the repo root, not nested inside a folder (a common browser-upload slip).
- Confirm the repo is Public.

### Before sending the link to a client

- [ ] The map draws and the splash screen clears.
- [ ] A search — try `national watch` — returns results and opens a property panel.
- [ ] Open it on your phone. The layout turns into a draggable bottom sheet under 860px.
- [ ] Click a property, hit **Copy link**, paste it in a new tab. It should open on that same property.

### Every time you update the site: bump the build string

`config.js` starts with `const BUILD = "2026-09-17c";` and `index.html` carries the same string three times as `?v=2026-09-17c`. Those query strings are what force browsers to fetch new files instead of reusing what they already have.

**When you change anything in `data/`, `app.js`, or `style.css`, change that string in all four places** (any new value works — `2026-09-18a`, `2026-09-18b`, and so on). Without it, a browser that has been to the site before can keep serving its cached copy for hours, which shows up as the map looking right but quietly displaying old parcels — old data mixed with new code, which is worse than an obvious failure because nothing looks broken.

The legend shows "Data build …" so you can confirm at a glance which version any browser is actually running. If a client says something looks wrong, ask what that line says.

**Updating later (Terminal route):** edit files in this folder, then

```bash
git add -A
git commit -m "what changed"
git push
```

Pages redeploys in about a minute. Browser route: click into a file on GitHub, pencil icon, edit, commit.

---

## 3b. Street View panel — getting the Google key

The property panel has a Street View section. **It already works with no key**: it shows an "Open in Google Maps ↗" link that opens the full pano, with Google's historical imagery slider. Adding a key upgrades that to an interactive panel embedded in the sidebar.

**This costs nothing.** It uses exactly two services, both free:

| Service | What it does here | Cost |
|---|---|---|
| Maps Embed API | renders the interactive panel | No charge, no rate limit — Google's words: "Maps Embed usage is available at no charge" |
| Street View metadata | asks whether imagery exists near the parcel, and where the camera stands | Unlimited, no charge |

The site deliberately does **not** use the Street View **Static** API, which bills $7.00 per 1,000 images past a 10,000/month free allowance. If you ever see Street View charges on a Google invoice, something has been changed to call that API — the code as written cannot.

### Steps

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in. If Studio GWA should own this rather than your personal account, sign in with the firm account first.
2. Create a project — top bar project dropdown → **New Project** → name it something like `studiogwa-maps`.
3. **APIs & Services → Library**, and enable these two:
   - **Maps Embed API**
   - **Street View Static API** (the free metadata endpoint lives under this one; enabling it does not by itself cost anything)
4. **APIs & Services → Credentials → Create credentials → API key.** Copy the key.
5. **Restrict the key immediately** — click it, then:
   - **Application restrictions → Websites**, and add:
     ```
     https://studiogwa.github.io/*
     ```
     plus any custom domain later. This is what stops someone lifting the key off your page and using it elsewhere.
   - **API restrictions → Restrict key**, and tick only Maps Embed API and Street View Static API.
6. In `config.js`, paste it into `GOOGLE_MAPS_KEY: ""`.
7. Bump the build string (below) and upload.

Google may ask you to attach a billing account to the project even though these two services are free. That is Google's standard requirement for any API key, not a sign that you're being charged. If that makes you uneasy, leave the key blank — the link-out version needs no key, no project, and no billing, and still gets your client to the same imagery in one click.

### When there's no imagery

Some parcels — rear lots, private drives, alleys — have no Street View coverage within reach. The panel says so plainly rather than showing a grey box, and the link out stays available. The lookup asks for outdoor imagery within 80 m of the parcel.

### Aiming the camera

Street View's default view faces whichever way the camera car was pointing, which on a residential street usually means you're looking down the street rather than at the building. The site fixes this: it asks the free metadata endpoint where the camera actually stands, then computes the compass bearing from that camera to the parcel and passes it as the heading. You should be looking at the building, not past it.

---

## 4. Later: Google Analytics (GA4)

The snippet is already in `index.html` with a placeholder, so this is a find-and-replace.

1. Google Analytics → **Admin** → **Create property** — or reuse the studiogwa.com property and add a new **data stream**, which keeps this project's traffic separate while rolling up to the same account.
2. Copy the Measurement ID, format `G-XXXXXXXXXX`.
3. In `index.html`, replace **both** instances of `G-XXXXXXXXXX` — they're near the top, in the `<head>`.
4. Commit and push. Check GA → Reports → Realtime while you click around the live site.

If you want to know *which properties* clients look at, one line inside `selectProperty()` in `app.js` would log it:

```js
if (window.gtag) gtag('event', 'property_view', { address: p.address, pin: p.pin });
```

Say the word and I'll wire it up.

---

## 5. Later: a studiogwa.com URL

GitHub Pages attaches a custom domain at the **root of a repo**, so `elgin.studiogwa.com` works and `studiogwa.com/elgin` does not — unless studiogwa.com itself is served from GitHub Pages.

### Subdomain (works today)

1. Repo **Settings → Pages → Custom domain**: enter `elgin.studiogwa.com`, Save. This writes a `CNAME` file into the repo.
2. In the DNS provider for studiogwa.com, add a CNAME record: `elgin` → `studiogwa.github.io`
3. Back in Settings → Pages, tick **Enforce HTTPS** once the certificate is issued — usually minutes, occasionally up to 24 hours.
4. Nothing to change in the code: `config.js` derives share links from `window.location`, so copied property links follow the new domain automatically.

### True path URL (studiogwa.com/elgin)

Needs the main site to proxy or redirect `/elgin` to the Pages URL:

| Platform | `/elgin` path | Notes |
|---|---|---|
| Squarespace / Wix | No | Use the subdomain, or a menu item that links out |
| WordPress (self-hosted) | Yes | nginx/Apache reverse proxy, or a redirect plugin |
| Netlify / Vercel / Cloudflare | Yes | Rewrite rule in `_redirects` / `vercel.json` / a Worker |

Tell me what runs studiogwa.com and I'll write the exact rule.

---

## 6. Fonts

The site loads **Poppins** (for Gilroy) and **Lora** (for Surveyor Text) from Google Fonts — the same substitutes as the Rockford survey map, and nothing to configure.

The real Gilroy and Surveyor Text files are in the brand assets folder, but they're commercially licensed for desktop use; publishing them in a public repo would need a separate webfont license. If Studio GWA buys one, the swap is a `@font-face` block at the top of `style.css` and a `/fonts` folder — ask and I'll do it.

---

## Repo contents

```
index.html          page shell, splash screen, sidebar, GA snippet
style.css           Studio GWA brand styling (palette from brand manual v1.0)
config.js           Mapbox token, initial view, data paths
app.js              map, search, property snapshot, layer toggles, deep links
data/*.geojson      see README.md for sources and field definitions
assets/             logos + ellipsis graphic
build_data.py       rebuilds data/ from the source GeoPackages
_source/            original GeoPackages, reference only — excluded from git
```
