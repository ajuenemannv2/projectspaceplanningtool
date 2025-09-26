/* Tool map helpers (read-only layer switching logic) */
(function(){
    function getSwitchZoom(){
        const cfg = (typeof window !== 'undefined') ? (window.ToolConfig||{}) : {};
        const z = typeof cfg.streetSwitchZoom === 'number' ? cfg.streetSwitchZoom : 17;
        return z;
    }

    function currentBase(map, satelliteLayer, hybridLayer){
        if (!map) return 'unknown';
        if (hybridLayer && map.hasLayer(hybridLayer)) return 'hybrid';
        if (satelliteLayer && map.hasLayer(satelliteLayer)) return 'satellite';
        return 'street';
    }

    if (typeof window !== 'undefined'){
        window.ToolMap = { getSwitchZoom, currentBase };
    }
})();
