# Configuration

Supabase (public)
- Edit `config/public-supabase-config.js` to set:
```
window.SUPABASE_CONFIG = {
  url: 'https://<project>.supabase.co',
  anonKey: '<public-anon-key>'
};
```

Runtime toggles
- `src/core/config.js` merges defaults into `window.ToolConfig`.
- Example override (in a page before tool scripts):
```
<script>
  window.ToolConfig = { streetSwitchZoom: 16 };
</script>
```
