/* Polygon Tool - Complete Implementation */
(function(){
    const DrawDebug = window.DrawDebug || function(tag, msg, data) {
        if (window.DEBUG_DRAW) {
            try { console.log(`[DRAW][${tag}] ${msg}`, data || ''); } catch(_) {}
        }
    };

    // ===== LABELS =====
    function addFinalLabels(shape){
        if (!shape || !window.map) return;
        
        DrawDebug('POLY', 'addFinalLabels called', shape);
        
        try {
            // Clear existing labels
            clearLabels(shape);
            
            const latlngs = Array.isArray(shape.getLatLngs()[0]) ? shape.getLatLngs()[0] : shape.getLatLngs();
            if (!latlngs || latlngs.length < 3) return;

            // Store labels on shape
            shape.distanceLabels = [];
            shape._areaLabel = null;

            // Add segment labels
            for (let i = 0; i < latlngs.length; i++) {
                const a = latlngs[i];
                const b = latlngs[(i + 1) % latlngs.length];
                const dist = window.GeometryLib.calculateDistance(a, b);
                const mid = window.GeometryLib.calculateMidpoint(a, b);
                const marker = window.GeometryLib.createMeasurementMarker(
                    mid, 
                    window.GeometryLib.formatMeasurement(dist), 
                    'measurement-label-final measurement-segment'
                ).addTo(window.map);
                shape.distanceLabels.push(marker);
            }
            
            // Add area label
            const area = window.GeometryLib.calculatePolygonArea(latlngs);
            const center = shape.getBounds().getCenter();
            shape._areaLabel = window.GeometryLib.createMeasurementMarker(
                center, 
                window.GeometryLib.formatMeasurement(area, 'ft²'), 
                'measurement-label-final measurement-area'
            ).addTo(window.map);

            // Attach recompute function for edits/rotation
            shape._recomputeLabels = () => _recomputePolygonLabels(shape);
            if (!shape._hasRecomputeListener) { 
                shape.on('edit', shape._recomputeLabels); 
                shape._hasRecomputeListener = true; 
            }
            
            DrawDebug('POLY', 'Polygon labels added successfully');
            
        } catch(err) { 
            DrawDebug('ERROR', 'Error in addFinalLabels', err); 
        }
    }

    function _recomputePolygonLabels(shape) {
        DrawDebug('POLY', '_recomputePolygonLabels called', shape);
        
        try {
            if (!shape.distanceLabels || !shape._areaLabel) {
                addFinalLabels(shape); // Re-add if missing
                return;
            }

            const latlngs = Array.isArray(shape.getLatLngs()[0]) ? shape.getLatLngs()[0] : shape.getLatLngs();
            if (!latlngs || latlngs.length < 3) return;

            // Update segment labels
            shape.distanceLabels.forEach((marker, i) => {
                const a = latlngs[i];
                const b = latlngs[(i + 1) % latlngs.length];
                const dist = window.GeometryLib.calculateDistance(a, b);
                const mid = window.GeometryLib.calculateMidpoint(a, b);
                marker.setLatLng(mid);
                marker.setIcon(window.GeometryLib.createMeasurementMarker(
                    mid, 
                    window.GeometryLib.formatMeasurement(dist), 
                    'measurement-label-final measurement-segment'
                ).getIcon());
            });

            // Update area label
            const area = window.GeometryLib.calculatePolygonArea(latlngs);
            const center = shape.getBounds().getCenter();
            shape._areaLabel.setLatLng(center);
            shape._areaLabel.setIcon(window.GeometryLib.createMeasurementMarker(
                center, 
                window.GeometryLib.formatMeasurement(area, 'ft²'), 
                'measurement-label-final measurement-area'
            ).getIcon());
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in _recomputePolygonLabels', error);
        }
    }

    function clearLabels(shape){
        try {
            if (shape.distanceLabels) { 
                shape.distanceLabels.forEach(m => { try { window.map.removeLayer(m); } catch(_){} }); 
                shape.distanceLabels = []; 
            }
            if (shape._areaLabel) { 
                try { window.map.removeLayer(shape._areaLabel); } catch(_){} 
                shape._areaLabel = null; 
            }
        } catch(_) {}
    }

    // ===== EDITING =====
    function enablePolygonRotation(polygon) {
        DrawDebug('POLY', 'enablePolygonRotation called', polygon);
        
        try {
            const center = polygon.getBounds().getCenter();
            const centerPt = window.map.latLngToLayerPoint(center);
            const ring = polygon.getLatLngs()[0];
            if (!ring || ring.length === 0) return;

            // Place handle offset from the first vertex outward
            const first = ring[0];
            const firstPt = window.map.latLngToLayerPoint(first);
            const vec = L.point(firstPt.x - centerPt.x, firstPt.y - centerPt.y);
            const mag = Math.max(40, Math.hypot(vec.x, vec.y));
            const handlePt = L.point(centerPt.x + (vec.x / (mag || 1)) * (mag + 30), centerPt.y + (vec.y / (mag || 1)) * (mag + 30));
            const handleLatLng = window.map.layerPointToLatLng(handlePt);

            const handleIcon = L.divIcon({
                className: 'rotate-handle',
                html: `<div style="
                    width: 28px; height: 28px; border-radius: 50%;
                    background: #ffffff; border: 2px solid #3b82f6;
                    display: flex; align-items: center; justify-content: center;
                    color: #1f2937; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
                "><i class="fas fa-rotate-right"></i></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const handle = L.marker(handleLatLng, { draggable: true, opacity: 0.95, title: 'Rotate', icon: handleIcon }).addTo(window.map);
            polygon._rotateHandle = handle;
            polygon._rotationCenter = center;
            polygon._originalRing = ring.map(ll => ({ lat: ll.lat, lng: ll.lng }));

            let startAngle = null;
            handle.on('dragstart', () => {
                DrawDebug && DrawDebug('ROTATE','dragstart');
                const c = window.map.latLngToLayerPoint(polygon._rotationCenter);
                const h = window.map.latLngToLayerPoint(handle.getLatLng());
                startAngle = Math.atan2(h.y - c.y, h.x - c.x);
                polygon._originalRing = polygon.getLatLngs()[0].map(ll => ({ lat: ll.lat, lng: ll.lng }));
                // If edit mode is active, temporarily disable to avoid stale handles
                try {
                    const editHandler = window.map?._drawControl?._toolbars?.edit?._modes?.edit?.handler;
                    if (editHandler && (editHandler._enabled || editHandler.enabled)) {
                        polygon._resumeEditAfterRotate = true;
                        editHandler.disable();
                    }
                } catch(_) {}
            });
            
            handle.on('drag', () => {
                DrawDebug && DrawDebug('ROTATE','drag');
                if (startAngle === null) return;
                const c = window.map.latLngToLayerPoint(polygon._rotationCenter);
                const h = window.map.latLngToLayerPoint(handle.getLatLng());
                const curAngle = Math.atan2(h.y - c.y, h.x - c.x);
                const delta = curAngle - startAngle;
                // Rotate original ring by delta
                const rotated = polygon._originalRing.map(ll => rotatePointAround(ll, polygon._rotationCenter, delta));
                polygon.setLatLngs([rotated]);
                // Update labels for both systems in real-time
                try {
                    if (polygon._recomputeLabels) { polygon._recomputeLabels(); }
                    else if (!polygon._hasMeasurements) { 
                        if (window.addDistanceLabels) window.addDistanceLabels(polygon); 
                    }
                } catch(_) {}
                try { if (window.updatePolygonWatermark) window.updatePolygonWatermark(polygon); } catch(_) {}
                try {
                    const a = L.GeometryUtil.geodesicArea(rotated);
                    const aFt = Math.round(a * 10.764);
                    if (polygon.getPopup && polygon.getPopup()) {
                        polygon.getPopup().setContent(`
                            <strong>Drawn Area</strong><br>
                            Area: ${aFt} sq ft<br>
                            Double-click to edit | Use Undo to remove
                        `);
                    }
                } catch(_) {}
            });
            
            handle.on('dragend', () => {
                DrawDebug && DrawDebug('ROTATE','dragend');
                // Recompute center and reposition handle a bit away
                try {
                    polygon._rotationCenter = polygon.getBounds().getCenter();
                    repositionPolygonRotateHandle(polygon);
                } catch(_) {}
                // Final recompute of labels after rotation ends
                try { if (polygon._recomputeLabels) { polygon._recomputeLabels(); } } catch(_) {}
                // Reset baseline ring to current geometry
                try {
                    polygon._originalRing = (polygon.getLatLngs()[0] || []).map(ll => ({ lat: ll.lat, lng: ll.lng }));
                } catch(_) {}
                // For v2 shapes, DO NOT replace the polygon instance; labels stick to same layer
                // Keep legacy replacement only if no recompute function exists
                if (!polygon._recomputeLabels) {
                    try {
                        const latlngsNow = (polygon.getLatLngs()[0] || []).map(ll => L.latLng(ll.lat, ll.lng));
                        const popupContent = (polygon.getPopup && polygon.getPopup()) ? polygon.getPopup().getContent() : null;
                        const existingWatermark = polygon._watermarkMarker || null;

                        // Remove old labels and handle
                        try { if (window.clearDistanceLabels) window.clearDistanceLabels(polygon); } catch(_) {}
                        try { if (polygon._rotateHandle) window.map.removeLayer(polygon._rotateHandle); } catch(_) {}

                        // Remove old polygon from groups
                        try { window.drawnItems.removeLayer(polygon); } catch(_) { try { window.map.removeLayer(polygon); } catch(_) {} }

                        // Create new polygon and add to drawnItems
                        const newPoly = L.polygon(latlngsNow, { color: '#0078d4', weight: 3, fill: true, fillOpacity: 0.15 });
                        window.drawnItems.addLayer(newPoly);
                        window.currentShape = newPoly;

                        // Mark as rectangle-locked
                        try { newPoly._rectLocked = true; } catch(_) {}

                        // Restore popup
                        if (popupContent) { try { newPoly.bindPopup(popupContent); } catch(_) {} }

                        // Restore watermark
                        if (existingWatermark) {
                            try {
                                const center = newPoly.getBounds().getCenter();
                                existingWatermark.setLatLng(center);
                                newPoly._watermarkMarker = existingWatermark;
                            } catch(_) {}
                        } else {
                                try { if (window.updateCurrentShapeWatermark) window.updateCurrentShapeWatermark(); } catch(_) {}
                        }

                        // Add labels and rotation to new polygon
                        if (!newPoly._hasMeasurements) {
                            try { if (window.addDistanceLabels) window.addDistanceLabels(newPoly); } catch(_) {}
                        }
                        try { enablePolygonRotation(newPoly); } catch(_) {}

                        // Wire basic click/dblclick
                        newPoly.on('click', function(){ window.currentShape = newPoly; if (window.updateSubmitButton) window.updateSubmitButton(); });
                        newPoly.on('dblclick', function(){
                            // Use custom rectangle scale mode
                            try { if (window.disableRectScaleMode) window.disableRectScaleMode(newPoly); } catch(_) {}
                            try { if (window.enableRectScaleMode) window.enableRectScaleMode(newPoly); } catch(_) {}
                        });

                        // Refresh edit mode handles and select this polygon
                        try {
                            const editToolbar = window.map?._drawControl?._toolbars?.edit;
                            const editHandler = editToolbar?._modes?.edit?.handler;
                            if (editHandler) {
                                try { editHandler.disable(); } catch(_) {}
                                try { editHandler.enable(); } catch(_) {}
                                setTimeout(() => {
                                    try {
                                        const group = editHandler._markersGroup || editHandler._featureGroup || null;
                                        if (group && typeof group.eachLayer === 'function') {
                                            group.eachLayer(function(marker){
                                                if (marker && marker._shape === newPoly) { try { marker.fire('click'); } catch(_) {} }
                                            });
                                        }
                                    } catch(_) {}
                                }, 80);
                            }
                        } catch(_) {}
                    } catch(_) {}
                }

                // Clear resume flag
                polygon._resumeEditAfterRotate = false;
            });

            // Clean up handle and labels if polygon removed
            polygon.on('remove', () => {
                try { if (polygon._rotateHandle) window.map.removeLayer(polygon._rotateHandle); } catch(_) {}
                try { if (window.clearDistanceLabels) window.clearDistanceLabels(polygon); } catch(_) {}
                try { if (polygon._watermarkMarker) window.map.removeLayer(polygon._watermarkMarker); } catch(_) {}
            });

            // Also reposition handle whenever polygon is edited (vertices moved)
            polygon.on('edit', () => {
                try {
                    polygon._rotationCenter = polygon.getBounds().getCenter();
                    repositionPolygonRotateHandle(polygon);
                    if (window.updatePolygonWatermark) window.updatePolygonWatermark(polygon);
                } catch(_) {}
            });
            
            // Add Escape key handler
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    disablePolygonRotation(polygon);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
        } catch (err) {
            DrawDebug('ERROR', 'Failed to enable rotation on polygon:', err);
        }
    }

    function disablePolygonRotation(polygon) {
        DrawDebug('POLY', 'disablePolygonRotation called', polygon);
        
        try {
            if (polygon && polygon._rotateHandle) {
                window.map.removeLayer(polygon._rotateHandle);
                polygon._rotateHandle = null;
            }
        } catch(error) {
            DrawDebug('ERROR', 'Error in disablePolygonRotation', error);
        }
    }

    function repositionPolygonRotateHandle(polygon) {
        DrawDebug('POLY', 'repositionPolygonRotateHandle called', polygon);
        
        try {
            if (!polygon._rotateHandle) return;
            const center = polygon._rotationCenter || polygon.getBounds().getCenter();
            const centerPt = window.map.latLngToLayerPoint(center);
            const ring = polygon.getLatLngs()[0];
            if (!ring || ring.length === 0) return;
            const firstPt = window.map.latLngToLayerPoint(ring[0]);
            const vec = L.point(firstPt.x - centerPt.x, firstPt.y - centerPt.y);
            const mag = Math.max(40, Math.hypot(vec.x, vec.y));
            const handlePt = L.point(centerPt.x + (vec.x / (mag || 1)) * (mag + 30), centerPt.y + (vec.y / (mag || 1)) * (mag + 30));
            const handleLatLng = window.map.layerPointToLatLng(handlePt);
            polygon._rotateHandle.setLatLng(handleLatLng);
        } catch(error) {
            DrawDebug('ERROR', 'Error in repositionPolygonRotateHandle', error);
        }
    }

    function rotatePointAround(latlng, centerLatLng, angleRad) {
        try {
            const p = window.map.latLngToLayerPoint(latlng);
            const c = window.map.latLngToLayerPoint(centerLatLng);
            const dx = p.x - c.x;
            const dy = p.y - c.y;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const rx = dx * cos - dy * sin;
            const ry = dx * sin + dy * cos;
            const rp = L.point(c.x + rx, c.y + ry);
            return window.map.layerPointToLatLng(rp);
        } catch(_) { return latlng; }
    }

    // ===== PUBLIC API =====
    if (typeof window !== 'undefined') {
        window.PolygonTool = {
            // Labels
            addFinalLabels,
            clearLabels,
            _recomputePolygonLabels,
            
            // Geometry
            calculatePolygonArea: function(coordinates) {
                // Convert coordinates to Leaflet LatLng objects
                const latLngs = coordinates.map(coord => L.latLng(coord[1], coord[0]));
                
                // Calculate area using Leaflet's geometry utility
                const area = L.GeometryUtil.geodesicArea(latLngs);
                
                // Convert from square meters to square feet
                return area * 10.764;
            },
            
            // Editing
            enablePolygonRotation,
            disablePolygonRotation,
            repositionPolygonRotateHandle,
            rotatePointAround,
            
            // Drawing (delegates to existing system)
            startDraw: function() {
                if (window.CustomDrawing && typeof window.CustomDrawing.startPolygonDrawing === 'function') {
                    window.CustomDrawing.startPolygonDrawing();
                } else if (window.UnifiedDrawing && typeof window.UnifiedDrawing.startDrawing === 'function') {
                    window.UnifiedDrawing.startDrawing('polygon');
                }
            }
        };
        
        // Also expose the functions globally for backward compatibility
        window.enablePolygonRotation = enablePolygonRotation;
        window.repositionPolygonRotateHandle = repositionPolygonRotateHandle;
        window.PolygonLabels = { addFinalLabels, clearLabels, _recomputePolygonLabels };
    }
})();
