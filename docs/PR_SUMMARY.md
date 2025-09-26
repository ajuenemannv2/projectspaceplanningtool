# PR Summary – Core Scaffold and Safe Refactors

## Scope
- Added core helpers and documentation to improve maintainability without behavior changes.
- Introduced small wrappers for Tool, Logistics, and Admin to provide clear entry points.
- Kept pages working as before; changes are additive with fallbacks.

## Key Changes
- Core
  - `src/core/config.js` (runtime toggles → window.ToolConfig)
  - `src/core/supabase-client.js` (safe client getter)
  - JSDoc typedefs in `src/core/types.js`
- Tool wrappers
  - UI: `src/tool/ui/banners.js`, `src/tool/ui/status.js`, `src/tool/ui/undo.js`
  - Map: `src/tool/map-init.js`, `src/tool/map/reset.js`
  - Data: `src/tool/data/selection.js`, `src/tool/data/projects.js`, `src/tool/data/phases.js`, `src/tool/data/spaces.js`
  - Export: `src/tool/export/topojson.js`
- Logistics wrappers
  - `src/logistics/phases.js`, `src/logistics/spaces.js`, `src/logistics/export.js`, `src/logistics/ui.js`
  - Export HD image now draws labels on top
- Admin wrappers
  - `src/admin/data.js`, `src/admin/ui.js`
- Docs
  - `docs/architecture.md`, `docs/operations.md`, `docs/config.md`, `docs/troubleshooting.md`

## Notable UI Tweaks
- Removed legacy buttons (Preview, Export, Clear, Reset) from the Tool page.
- Tool now renders fences as yellow lines (parity with Logistics).
- Canvas renderer used on Tool and Logistics to reduce edge clipping while dragging.

## How to Test
1. Tool page
   - Load, select a project, ensure phases load and restore; shapes filter accordingly.
   - Draw a polygon and a fence; fence displays yellow; status chip updates.
   - Save Space still validates and enables button correctly.
   - Pan/zoom near edges; shapes don’t visibly clip during drag.
2. Logistics page
   - Select a project; phases load and filter; space count updates.
   - Export HD Image: shapes render with labels on top; crane pads + sweep styled correctly.
3. Admin page
   - Open Admin; projects/spaces tables render; basic navigation works.

## Rollback Plan
- Revert the feature branch commit(s); main branch remains untouched until approved.

## Notes for Reviewers
- All wrappers delegate to existing functions; behavior should remain identical.
- Future PRs can swap internal calls to use wrappers directly (keeps diffs small).
