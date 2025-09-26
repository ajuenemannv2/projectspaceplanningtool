# Architecture

Pages
- index.html (Tool)
- logistics-map.html (Logistics)
- admin.html (Admin)

Core
- config/public-supabase-config.js provides public Supabase credentials at runtime.
- src/core/config.js merges non-secret runtime toggles into `window.ToolConfig`.
- src/core/supabase-client.js exposes `window.getSupabaseClient()` safely.
- src/core/types.js documents `Project`, `Phase`, `Space` shapes via JSDoc.

Data Flow (Tool)
1. DOMContentLoaded → initialize map → create layers.
2. Create Supabase client (if available) → load projects → populate UI.
3. Restore project/phase selection (localStorage/URL) → load and filter spaces.
4. Drawing tools update UI and saved spaces.

Data Flow (Logistics)
1. Initialize map → load projects.
2. Restore project/phases (localStorage/URL) → load spaces → filter/render.
3. Optional export (GeoJSON/HD image).

Notes
- No secrets are committed; public anon key is suitable for client-side usage.
- Map tiles are loaded via CDN; network policies may require self-hosting.
