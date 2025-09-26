# Troubleshooting

- Supabase not initialized
  - Check network; confirm `window.SUPABASE_CONFIG` exists.
  - Open console: `typeof supabase`, `window.getSupabaseClient && window.getSupabaseClient()`.

- Map tiles not visible
  - Verify Leaflet CSS loaded; check tile server URLs.

- Phases selected but shapes unfiltered
  - Ensure localStorage not blocked; selection persists between pages.
  - Reload page; check console logs around `loadProjectSpaces`.
