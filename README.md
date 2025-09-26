

I beleive to open this applicaiton you would need my datsbase URL


# Run Locally (Quick Start)

1) Configure Supabase
- Edit `config/public-supabase-config.js` and ensure your Supabase `url` and `anonKey` are set.
- In Supabase → Settings → API, add your dev origins to Allowed Origins (e.g., `http://localhost:3000`, `http://127.0.0.1:3000`).

2) Start a simple dev server (pick one)
- Node (no install):
  - `npx http-server -p 3000 -c-1`
- Python 3:
  - `python -m http.server 3000`

3) Open in browser
- Main Tool: `http://localhost:3000/index.html`
- Logistics Map: `http://localhost:3000/logistics-map.html`
- Admin Panel: `http://localhost:3000/admin.html`

Notes
- Do not open via `file://`; use a local HTTP server.
- If calls fail: verify Supabase URL/anon key, CORS Allowed Origins, and RLS permissions for the anon role.

# Project Space Planning Tool

A simple, field-friendly web app to plan and communicate construction site spaces. It can be used to organize, staging, cranes, and fencing by project phase and share a clear picture with all parties involved with a project and feed Power BI shape maps to easily connect and report with existing data(Power BI shape map capabilites not in this version but has been tested and can be implemented).


## What you can plan - all relative to existing conditions and time
- Job Trailers and Offices (rotatable, scale-as-rectangle)
- Staging / Laydown Areas (materials, steel, concrete)
- Cranes (pad, radius, swing/sweep)
- Fencing / Barricades (temporary or permanent)
- Utility/Work Zones and other site areas
- and much more

## Who uses this
- Anyone Involved with Constuction Logistics: Superintendents, PMs, PEs, Safety, etc, to visualize the live site plan (Logistics Map) and export HD images for meetings, signage, and plans

## How it’s used (day-to-day)
1) Pick the Project and Phase
- Choose the active project and one or more phases (e.g., Precon, Excavation, Structure). Saved shapes for the selected phases appear.

2) Draw the Space
- Select a category (Job Trailer, Staging Area, Crane, Fence, etc.) and draw on the map:
  - Rectangles for objects like trailers/offices (rotate to match site roads; double click to scale by width/height handles while staying rectangular)
  - Polygon for irregular staging areas
  - Fence (yellow line) to outline perimeters or barricades
  - Crane pad and swing/radius to communicate no‑fly and reach zones
- Segment lengths and area display while you adjust.

3) Tag it
- Set the company/trade so a the name in the form of a watermark appears on the shape. Optionally add a description (duration, access, constraints).

4) Save
- Space persists to the project. When set up with internal systems it should append to a project JSON to feed a Power BI Shape Map.

5) Share and Review
- Open the Logistics Map for a read‑only view with the same project/phase selection.
- Export HD images (logos/watermarks on top) for coordination meetings and signage.

6) Adjust as the site changes
- Move/rotate/resize rectangles without breaking right angles.
- Edit polygons and fences as space needs evolve.
- Phase filters keep the view clean through the project lifecycle.

## How it fits into planning
- Phase‑aware: filter by project phases to phase in/out space use
- Trade‑tagged: company watermark on shapes for clarity in the field
- Map continuity: project/zoom/phases carry across Tool ↔ Logistics Map
- Layer control: Street/Hybrid/Satellite to match the level of site detail

## Power BI shape map pipeline (optional)
- On save, the app can serialize shapes (GeoJSON/TopoJSON) and append them to a per‑project JSON file .
- Power BI Shape Map reads that JSON< I believe shape maps should update with just a refresh as long as the JSON is in a SharePoint.


## Typical workflows
- Polygons and Rectangles: rotate the rectangle to align with roads, scale footprint, tag the company, save, share via Logistics Map.
- Crane: place pad, set radius/swing to show reach/no‑fly, tag the operator, export HD image for lift plan packet.
- Perimeter/Fence: trace fence lines (yellow), communicate access restrictions and reroutes alongside trailers and staging.

## Admin Page
- Projects
  - Create/edit projects with name, status, and map‑based location.
  - Pick the site location on the embedded map; center/zoom are saved and used as the default view in the Tool and Logistics Map.
- Phases
  - Define phases in project order (e.g., Precon → Excavation → Structure → Interiors).
  - Edit names and re‑order easily.
  - Dates (planned/in‑progress): captured per phase (Dates need to be discussed with project teams 
- Categories & Companies
  - Categories: add/rename (Job Trailer, Staging Area, Crane, Fence), set category colors so shapes are consistently color‑coded.
  - Companies: add trades and set the short display label (watermark) printed on shapes and exports.


## File Structure (high‑level)
- index.html
  - Main Tool page contractors use to draw, tag (company/trade), and save site spaces.
- logistics-map.html
  - Read‑only site plan for Logistics/Safety; includes HD image export for meetings and signage.
- admin.html
  - Admin console to manage projects, phases, categories, and companies.
- styles.css, admin-styles.css, logistics-styles.css
  - Global and page‑specific styles; consistent buttons, banners, tables, and map headers.
- config/public-supabase-config.js
  - Public Supabase URL and anon key consumed by the browser (public‑safe; governed by RLS/CORS).
- src/core/
  - config.js: runtime toggles (e.g., map auto‑switch zoom, debug logging)
  - supabase-client.js: central, safe Supabase client getter with readiness checks
  - logger.js: toggleable, structured console logger
  - types.js: JSDoc typedefs for Projects, Phases, Spaces, Categories, Companies
- src/tool/ (Main Tool)
  - ui/: banners (global error), status indicator, undo state, modals (wrappers)
  - map/: base layer creation/auto‑switch, map reset helpers
  - data/: projects/phases/selection/spaces; restores project/zoom/phases across pages
  - drawing/: thin wrappers for drawing controls (primary logic in script.js)
  - export/: TopoJSON export (Power BI compatibility)
- src/logistics/
  - phases.js, spaces.js: load/filter for display only; ui.js for counts/loading; export.js for HD image export
- src/admin/
  - data.js: load/save projects, phases, categories, companies; ui.js: render tables/tabs
- script.js
  - Main Tool engine: map init, drawing, labels, rotated‑rectangle rotate/scale, save to DB, selection persistence
- logistics-script.js
  - Logistics engine: phase filter, space rendering, watermarks, HD export
- admin-script.js
  - Admin engine: tables, add/edit modals, Supabase CRUD, search/autocomplete for project placement
- docs/
  - IT_SETUP.md (dev server + ZIP), architecture.md, operations.md, config.md, troubleshooting.md, PR_SUMMARY.md


