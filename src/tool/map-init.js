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

    function makeBaseLayers(map){
        // Mirror the app's current base layer setup
        const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: '© Google Satellite',
            maxZoom: 22
        });
        const hybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '© Google Hybrid',
            maxZoom: 22
        });
        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });
        const baseMaps = { "Satellite": satelliteLayer, "Hybrid": hybridLayer, "Street": streetLayer };
        return { satelliteLayer, hybridLayer, streetLayer, baseMaps };
    }

    function attachAutoSwitch(map, satelliteLayer, streetLayer, hybridLayer){
        map.on('zoomend', function(){
            const currentZoom = map.getZoom();
            const switchZoom = getSwitchZoom();
            const base = currentBase(map, satelliteLayer, hybridLayer);
            if (base === 'street' && currentZoom > switchZoom) {
                map.removeLayer(streetLayer);
                satelliteLayer.addTo(map);
                if (window.updateDrawingStatus) window.updateDrawingStatus('Switched to satellite view for higher zoom');
            } else if ((base === 'satellite' || base === 'hybrid') && currentZoom <= switchZoom) {
                if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
                if (hybridLayer && map.hasLayer(hybridLayer)) map.removeLayer(hybridLayer);
                streetLayer.addTo(map);
                if (window.updateDrawingStatus) window.updateDrawingStatus('Switched to street view');
            }
        });
    }

    if (typeof window !== 'undefined'){
        window.ToolMap = { getSwitchZoom, currentBase, makeBaseLayers, attachAutoSwitch };
    }
})();
