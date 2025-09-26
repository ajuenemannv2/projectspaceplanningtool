/*
   Core runtime configuration for the Project Space Planning Tool.
   - Non-secret toggles live here
   - Merges with any existing window.ToolConfig so pages may override per-site
*/
(function(){
    const defaults = {
        // Map behavior
        streetSwitchZoom: 17,
        // UI toggles (reserved for future use)
        ui: {
            enableStatusToasts: false
        }
    };

    // Merge precedence: existing window.ToolConfig overrides defaults
    const current = (typeof window !== 'undefined' && window.ToolConfig) ? window.ToolConfig : {};
    const merged = {
        ...defaults,
        ...(current || {}),
        ui: { ...(defaults.ui||{}), ...((current && current.ui) || {}) }
    };

    if (typeof window !== 'undefined') {
        window.ToolConfig = merged;
    }
})();
