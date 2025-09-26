# Project Space Planning Tool

A simple, field-friendly web app to plan and communicate construction site spaces. It helps General Contractors, Superintendents, and Trade Partners lay out trailers, staging, cranes, and fencing by project phase and share a clear picture with Logistics and Power BI reports.

## What you can plan
- Job Trailers and Offices (rotatable, scale-as-rectangle)
- Staging / Laydown Areas (materials, steel, concrete)
- Cranes (pad, radius, swing/sweep)
- Fencing / Barricades (temporary or permanent)
- Utility/Work Zones and other site areas

## Who uses this
- GC/Project Teams: plan and approve site use by phase
- Trades/Subcontractors: request space and coordinate needs
- Logistics/Safety: visualize the live site plan (Logistics Map) and export HD images for meetings, signage, and plans

## How it’s used (day-to-day)
1) Pick the Project and Phase
- Choose the active project and one or more phases (e.g., Precon, Excavation, Structure). Saved shapes for the selected phases appear.

2) Draw the Space
- Select a category (Job Trailer, Staging Area, Crane, Fence, etc.) and draw on the map:
  - Rectangle for trailers/offices (rotate to match site roads; scale by width/height handles while staying rectangular)
  - Polygon for irregular staging areas
  - Fence (yellow line) to outline perimeters or barricades
  - Crane pad and swing/radius to communicate no‑fly and reach zones
- Segment lengths and area display while you adjust.

3) Tag it
- Set the company/trade so a watermark appears on the shape. Optionally add a description (duration, access, constraints).

4) Save
- Space persists to the project. Optionally serialize and append to a project JSON to feed a Power BI Shape Map (see below).

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
- On save, the app can serialize shapes (GeoJSON/TopoJSON) and append them to a per‑project JSON file (SharePoint/Blob/etc.).
- Power BI Shape Map reads that JSON. With scheduled/on‑demand refresh, new site shapes flow into reports without manual redraws.
- If you want this enabled, we’ll point the app to a write location (e.g., via Power Automate or a small API) and switch it on.

## Typical workflows
- Job Trailer: rotate the rectangle to align with roads, scale footprint, tag the company, save, share via Logistics Map.
- Crane: place pad, set radius/swing to show reach/no‑fly, tag the operator, export HD image for lift plan packet.
- Staging/Laydown: draw polygons, tag the trade (steel, concrete), phase‑filter for “next week,” export visuals for the weekly coordination meeting.
- Perimeter/Fence: trace fence lines (yellow), communicate access restrictions and reroutes alongside trailers and staging.

## Admin (lightweight)
- Projects
  - Create/edit projects with name, status, and map‑based location.
  - Pick the site location on the embedded map; center/zoom are saved and used as the default view in the Tool and Logistics Map.
  - Typical: stand up a new job, point the map to the site, set zoom, mark active.
- Phases
  - Define phases in project order (e.g., Precon → Excavation → Structure → Interiors).
  - Edit names and re‑order easily.
  - Dates (planned/in‑progress): captured per phase (UI scaffolded; final wiring to be completed).
  - Typical: set/update the phase list so field teams can filter “now/next” and Logistics can export phase‑specific views.
- Categories & Companies
  - Categories: add/rename (Job Trailer, Staging Area, Crane, Fence), set category colors so shapes are consistently color‑coded.
  - Companies: add trades and set the short display label (watermark) printed on shapes and exports.
  - Typical: onboard trades, tweak colors for clarity, ensure clean labels for signage and reports.
- Practical outcomes
  - Tool menus reflect Admin categories/companies.
  - Shape colors follow category color settings.
  - Company labels watermark saved shapes.
  - Phase order/dates (when finalized) support “what’s active now vs. next” filtering and reporting.

## File Structure (high‑level)
- index.html
  - Main Tool page contractors use to draw, tag (company/trade), and save site spaces.
- logistics-map.html
  - Read‑only site plan for Logistics/Safety; includes HD image export for meetings and signage.
- admin.html
  - Admin console to manage projects (center/zoom), phases, categories, and companies.
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

## Handoff to IT (short)
- Provide a ZIP of the static files and point to `docs/IT_SETUP.md` for local dev server and packaging steps.
- Include your Supabase URL + anon key in `config/public-supabase-config.js` or ship placeholders for their own database.
- Add their dev/host origins to Supabase Allowed Origins so the browser can call the database.

## ⚙️ Configuration

### Map Configuration

The application is pre-configured for the Intel Ronler Acres Campus in Hillsboro, Oregon, starting at Gordon Moore Park. To customize for your site, update the map settings in `script.js`:

```javascript
const CONFIG = {
    defaultCenter: [45.5285, -122.9350], // Intel Gordon Moore Park coordinates
    defaultZoom: 20,
    powerAutomateEndpoint: 'YOUR_POWER_AUTOMATE_WEBHOOK_URL',
    siteLayoutGeoJSON: {
        // Your site layout GeoJSON data
    }
};
```

### Site Layout Setup

1. **Create** a GeoJSON file with your site layout
2. **Include** buildings, parking areas, and other relevant features
3. **Update** the `siteLayoutGeoJSON` in the configuration

Example site layout:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Main Building",
        "type": "building"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [longitude1, latitude1],
          [longitude2, latitude2],
          [longitude3, latitude3],
          [longitude1, latitude1]
        ]]
      }
    }
  ]
}
```

---
Built for construction teams to quickly visualize, coordinate, and communicate site space by phase—without heavy CAD work or slow redraw cycles.

## 📊 Power BI Integration

### TopoJSON Export Functionality

The application exports staging requests in **TopoJSON format** that maintains compatibility with your existing Power BI setup:

- **Preserves Original Structure**: Loads and merges with the original `construction-campus .json` file
- **Maintains Building Data**: Keeps all existing building geometries and properties intact
- **Adds Staging Requests**: Appends new staging requests as a separate "Staging Requests" object collection
- **Power BI Compatible**: Uses the same coordinate system and transform as the original file

#### Export Process

1. **Load Original**: Reads the `construction-campus .json` file
2. **Merge Data**: Adds new staging requests while preserving existing structure
3. **Download File**: Automatically downloads the merged TopoJSON file
4. **Power BI Ready**: File can be directly imported into Power BI for visualization

#### File Structure

```json
{
  "type": "Topology",
  "arcs": [...],
  "transform": {...},
  "objects": {
    "Test Split V2": {
      "type": "GeometryCollection",
      "geometries": [...]
    },
    "Staging Requests": {
      "type": "GeometryCollection", 
      "geometries": [
        {
          "type": "Polygon",
          "properties": {
            "Building ID": "REQ-1234567890-abc123",
            "Company Name": "ABC Construction",
            "Contact Name": "John Doe",
            "Project Phase": "Foundation",
            "SQ_FT": 5000,
            "Status": "Pending",
            "Request Type": "Staging Area"
          },
          "arcs": [[0]]
        }
      ]
    }
  }
}
```

### Shape Map Setup

1. **Import** the TopoJSON data source (maintains original construction campus structure)
2. **Add** a Shape Map visual
3. **Configure** the location field using TopoJSON coordinates
4. **Set up** color coding based on request status
5. **Use** the "Staging Requests" object collection for new requests

### Sample Power BI Query

```m
let
    Source = Json.Document(Web.Contents("YOUR_SHAREPOINT_TOPOJSON_URL")),
    stagingRequests = Source[objects][Staging Requests][geometries],
    #"Converted to Table" = Table.FromList(stagingRequests, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    #"Expanded Column1" = Table.ExpandRecordColumn(#"Converted to Table", "Column1", {"properties", "type", "arcs"}),
    #"Expanded properties" = Table.ExpandRecordColumn(#"Expanded Column1", "properties", {"Company Name", "Contact Name", "Project Phase", "SQ_FT", "Start Date", "End Date", "Status", "Request Type"})
in
    #"Expanded properties"
```

## 🔐 Security Considerations

### Authentication

- **Use** Microsoft Entra ID (Azure AD) authentication
- **Restrict** access to authorized users only
- **Implement** role-based permissions

### Data Protection

- **Encrypt** sensitive data in transit and at rest
- **Validate** all input data
- **Implement** rate limiting
- **Log** all access and changes

### Network Security

- **Use** HTTPS for all communications
- **Configure** CORS policies appropriately
- **Implement** API key authentication for Power Automate

## 🐛 Troubleshooting

### Common Issues

1. **Map not loading**
   - Check internet connection
   - Verify Leaflet.js CDN links
   - Check browser console for errors

2. **Drawing not working**
   - Ensure Leaflet.draw plugin is loaded
   - Check for JavaScript errors
   - Verify map initialization

3. **Power Automate errors**
   - Check webhook URL configuration
   - Verify SharePoint permissions
   - Review flow run history

4. **Power BI not updating**
   - Check data source refresh settings
   - Verify JSON file permissions
   - Test data source connection

### Debug Mode

Enable debug logging by adding this to `script.js`:

```javascript
const DEBUG = true;

function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[DEBUG] ${message}`, data);
    }
}
```

## 📞 Support

For technical support or questions:

1. **Check** the troubleshooting section above
2. **Review** browser console for error messages
3. **Test** individual components separately
4. **Verify** Power Platform permissions and connections

## 🔄 Version History

- **v1.0.0** - Initial release with basic drawing and form functionality
- **v1.1.0** - Added Power Automate integration
- **v1.2.0** - Enhanced UI and responsive design
- **v1.3.0** - Added Power BI integration support

## 📄 License

This project is provided as-is for educational and commercial use. Please ensure compliance with Microsoft Power Platform terms of service.

## 🤝 Contributing

To contribute to this project:

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

---

**Built with ❤️ for the construction industry**
