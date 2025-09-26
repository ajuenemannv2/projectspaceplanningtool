# IT Setup Guide

This project is a static, multi-page web app (no build step required). You can run it locally with a simple HTTP server and package it as a ZIP for handoff.

## Prerequisites
- Internet access (for CDNs: Leaflet, Font Awesome)
- Supabase credentials configured in `config/public-supabase-config.js`
  - URL and anon key: from Supabase → Settings → API
  - Ensure Supabase CORS/Allowed Origins include your local dev URL (e.g., `http://localhost:3000`)
- Optional: Node.js (for an easy local server) or Python 3

## Entry Points
- Main Tool: `index.html`
- Logistics Map: `logistics-map.html`
- Admin Panel: `admin.html`

## Configure Supabase (required)
Edit `config/public-supabase-config.js`:

```javascript
window.SUPABASE_CONFIG = {
    url: 'https://YOUR-PROJECT.supabase.co',
    anonKey: 'YOUR_PUBLIC_ANON_KEY'
};
```

## Run Locally (Dev Server)
Pick one option:

1) Node (no install, temp server)
```powershell
# From the project root
npx http-server -p 3000 -c-1
# Then open: http://localhost:3000/index.html
```

2) Python 3
```powershell
# From the project root
python -m http.server 3000
# Then open: http://localhost:3000/index.html
```

Notes:
- Open `index.html`, `logistics-map.html`, or `admin.html` directly in the browser via the server URL.
- If data calls fail, verify `config/public-supabase-config.js` and Supabase CORS settings.

## Package as ZIP (Windows)
Preferred (requires Git):
```powershell
# From the project root; includes tracked files only
git archive --format=zip --output staging-space-tool.zip HEAD
```

Alternative (PowerShell tar, Windows 10+):
```powershell
# Create a ZIP excluding common folders
# (bsdtar supports --exclude patterns)
Tar -a -cf staging-space-tool.zip --exclude=.git --exclude=node_modules --exclude=dist .
```

Result: `staging-space-tool.zip` containing HTML/CSS/JS and `docs/`.

## Smoke Test (5 minutes)
1. Open `http://localhost:3000/index.html`.
2. Confirm the map loads; select a project; draw a shape.
3. Switch to Logistics Map; confirm spaces display and HD export works.
4. Open Admin; confirm Projects table loads.
5. If errors appear, check browser console and verify Supabase URL/key and CORS.

## Deployment Notes
- The site can be hosted on any static web host or uploaded as Web Files to Microsoft Power Pages.
- If hosting behind a different domain, update Supabase Allowed Origins accordingly.
- No server runtime is required; all logic runs in the browser.
