# Operations

Local Run (no build step)
- Open `index.html`, `logistics-map.html`, or `admin.html` directly in a modern browser, or
- `node server.js` and visit http://localhost:3000/

Local Run (optional Vite, previously evaluated)
- `npm run dev` (requires vite dev dependency). Not required for production.

Deploy (Power Pages)
- Upload the HTML/CSS/JS files as Web Files.
- Ensure `config/public-supabase-config.js` is present and contains valid public keys.
- Verify Leaflet and other CDN links are allowed by CSP.

Troubleshooting
- Supabase connectivity: check `window.SUPABASE_CONFIG` and network.
- Map not loading: verify CDN links (Leaflet + tile servers).
- Phase filters: ensure localStorage is allowed and not blocked in the browser.
