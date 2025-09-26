/* Supabase client boot helper (browser)
   - Reads window.SUPABASE_CONFIG provided by config/public-supabase-config.js
   - Exposes window.getSupabaseClient() for pages that want a guarded create
*/
(function(){
    function isConfigValid(cfg){
        return !!(cfg && cfg.url && cfg.anonKey);
    }

    function getSupabaseClient(){
        if (typeof supabase === 'undefined') {
            console.warn('Supabase library not loaded');
            return null;
        }
        const cfg = (typeof window !== 'undefined') ? window.SUPABASE_CONFIG : null;
        if (!isConfigValid(cfg)) {
            console.warn('Supabase config missing or invalid');
            return null;
        }
        try { return supabase.createClient(cfg.url, cfg.anonKey); }
        catch(e){ console.error('Failed to create Supabase client', e); return null; }
    }

    if (typeof window !== 'undefined') {
        window.getSupabaseClient = getSupabaseClient;
    }
})();
