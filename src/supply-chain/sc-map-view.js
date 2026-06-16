(function(){
    var map = null;
    var markersLayer = null;
    var heatLayer = null;
    var markerMap = {};
    var _scores = {};

    function init(container) {
        var cfg = window.SCConfig.map;
        map = L.map(container, { zoomControl: true }).setView(cfg.defaultCenter, cfg.defaultZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);

        markersLayer = L.layerGroup().addTo(map);
    }

    function load(entities, scores) {
        if (!map) return;
        _scores = scores || {};
        markersLayer.clearLayers();
        markerMap = {};

        var heatPoints = [];

        entities.forEach(function(entity) {
            if (!entity.lat || !entity.lng) return;

            var sc       = scores[entity.id] || { structural: 30, trajectory: 0 };
            var color    = window.SCScoring.getQuadrantColor(sc.structural, sc.trajectory);
            var radius   = 8 + (sc.structural / 100) * 12;
            var quadrant = window.SCScoring.getQuadrantLabel(sc.structural, sc.trajectory);

            var marker = L.circleMarker([entity.lat, entity.lng], {
                radius: radius,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85
            });

            marker.bindTooltip(
                '<strong>' + escapeHtml(entity.name) + '</strong><br>'
                + escapeHtml(entity.city || '') + ', ' + escapeHtml(entity.country_code || '') + '<br>'
                + '<span style="color:' + color + '">' + escapeHtml(quadrant) + '</span>',
                { sticky: true, className: 'sc-map-tooltip' }
            );

            marker.on('click', function() {
                window.dispatchEvent(new CustomEvent('sc:node-selected', { detail: { entityId: entity.id } }));
            });

            marker.entityId = entity.id;
            markersLayer.addLayer(marker);
            markerMap[entity.id] = marker;

            var intensity = (sc.structural + Math.max(0, sc.trajectory)) / 200;
            heatPoints.push([entity.lat, entity.lng, intensity]);
        });

        if (typeof L.heatLayer === 'function' && heatPoints.length) {
            if (heatLayer) { try { map.removeLayer(heatLayer); } catch(e){} }
            heatLayer = L.heatLayer(heatPoints, { radius: 40, blur: 25, maxZoom: 6, max: 1.0 });
        }
    }

    function applyFilters(filterState, scores) {
        if (!map) return;
        _scores = scores || _scores;

        Object.keys(markerMap).forEach(function(entityId) {
            var marker = markerMap[entityId];
            var ent    = marker._entityData;
            if (!ent) return;

            var sc      = _scores[entityId] || { structural: 30, trajectory: 0 };
            var visible = true;

            if (filterState.sectors.length && !filterState.sectors.includes(ent.industry_sector)) visible = false;
            if (filterState.entityTypes.length && !filterState.entityTypes.includes(ent.entity_type)) visible = false;
            if (filterState.countries.length && !filterState.countries.includes(ent.country_code)) visible = false;
            if (sc.structural < filterState.structuralMin || sc.structural > filterState.structuralMax) visible = false;
            if (sc.trajectory < filterState.trajectoryMin || sc.trajectory > filterState.trajectoryMax) visible = false;
            if (filterState.policyDirections && filterState.policyDirections.length) {
                var mdir = sc.trajectory >= 10 ? 'tailwind' : sc.trajectory <= -10 ? 'headwind' : 'neutral';
                if (!filterState.policyDirections.includes(mdir)) visible = false;
            }
            if (filterState.search) {
                if (!(ent.name || '').toLowerCase().includes(filterState.search)) visible = false;
            }

            if (visible) {
                if (!markersLayer.hasLayer(marker)) markersLayer.addLayer(marker);
            } else {
                if (markersLayer.hasLayer(marker)) markersLayer.removeLayer(marker);
            }
        });
    }

    function load2(entities, scores) {
        // Store entity data on markers after load
        if (!map) return;
        _scores = scores || {};
        markersLayer.clearLayers();
        markerMap = {};

        var heatPoints = [];
        var entityById = {};
        entities.forEach(function(e){ entityById[e.id] = e; });

        entities.forEach(function(entity) {
            if (!entity.lat || !entity.lng) return;

            var sc       = scores[entity.id] || { structural: 30, trajectory: 0 };
            var color    = window.SCScoring.getQuadrantColor(sc.structural, sc.trajectory);
            var radius   = 8 + (sc.structural / 100) * 12;
            var quadrant = window.SCScoring.getQuadrantLabel(sc.structural, sc.trajectory);
            var trajColor = window.SCScoring.getTrajectoryColor(sc.trajectory);

            var marker = L.circleMarker([entity.lat, entity.lng], {
                radius: radius,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.85
            });

            marker.bindTooltip(
                '<strong>' + escapeHtml(entity.name) + '</strong><br>'
                + escapeHtml((entity.city || '') + (entity.country_code ? ', ' + entity.country_code : '')) + '<br>'
                + '<span style="font-size:11px;color:' + color + '">● ' + escapeHtml(quadrant) + '</span>',
                { sticky: true, className: 'sc-map-tooltip' }
            );

            marker.on('click', function() {
                window.dispatchEvent(new CustomEvent('sc:node-selected', { detail: { entityId: entity.id } }));
            });

            marker.entityId  = entity.id;
            marker._entityData = entity;
            markersLayer.addLayer(marker);
            markerMap[entity.id] = marker;

            var intensity = Math.max(0.1, (sc.structural + Math.max(0, sc.trajectory)) / 200);
            heatPoints.push([entity.lat, entity.lng, intensity]);
        });

        if (typeof L.heatLayer === 'function' && heatPoints.length) {
            if (heatLayer) { try { map.removeLayer(heatLayer); } catch(e){} }
            heatLayer = L.heatLayer(heatPoints, { radius: 40, blur: 25, maxZoom: 6, max: 1.0 });
        }
    }

    function focusEntity(entityId) {
        if (!map) return;
        var marker = markerMap[entityId];
        if (marker) {
            map.flyTo(marker.getLatLng(), 6, { duration: 0.8 });
            marker.openTooltip();
        }
    }

    function toggleHeatmap(on) {
        if (!map || !heatLayer) return;
        if (on) { if (!map.hasLayer(heatLayer)) map.addLayer(heatLayer); }
        else    { if (map.hasLayer(heatLayer))  map.removeLayer(heatLayer); }
    }

    function invalidateSize() { if (map) setTimeout(function(){ map.invalidateSize(); }, 100); }

    window.SCMapView = {
        init: init,
        load: load2,
        applyFilters: applyFilters,
        focusEntity: focusEntity,
        toggleHeatmap: toggleHeatmap,
        invalidateSize: invalidateSize
    };
})();
