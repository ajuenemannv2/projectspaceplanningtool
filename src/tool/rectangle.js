/* Rectangle Tool - Complete Implementation */
(function(){
    const DrawDebug = window.DrawDebug || function(tag, msg, data) {
        if (window.DEBUG_DRAW) {
            try { console.log(`[DRAW][${tag}] ${msg}`, data || ''); } catch(_) {}
        }
    };

    // ===== LABELS =====
    function addFinalLabels(shape){
        if (!shape || !window.map) return;
        
        DrawDebug('RECT', 'addFinalLabels called', shape);
        
        try {
            // Clear existing labels
            clearLabels(shape);
            
            // Get bounds from shape
            const bounds = shape.getBounds();
            const dims = window.GeometryLib.calculateRectangleDimensions(bounds);
            
            // Store labels on shape for recomputation
            shape.distanceLabels = [];
            shape._areaLabel = null;
            
            // Top edge (width)
            const topCenter = L.latLng(bounds.getNorth(), (bounds.getWest() + bounds.getEast()) / 2);
            const widthMarkerTop = window.GeometryLib.createMeasurementMarker(
                topCenter,
                window.GeometryLib.formatMeasurement(dims.width),
                'measurement-label-final measurement-width'
            ).addTo(window.map);
            shape.distanceLabels.push(widthMarkerTop);
            
            // Right edge (height)
            const rightCenter = L.latLng((bounds.getSouth() + bounds.getNorth()) / 2, bounds.getEast());
            const heightMarkerRight = window.GeometryLib.createMeasurementMarker(
                rightCenter,
                window.GeometryLib.formatMeasurement(dims.height),
                'measurement-label-final measurement-height'
            ).addTo(window.map);
            shape.distanceLabels.push(heightMarkerRight);
            
            // Bottom edge (width)
            const bottomCenter = L.latLng(bounds.getSouth(), (bounds.getWest() + bounds.getEast()) / 2);
            const widthMarkerBottom = window.GeometryLib.createMeasurementMarker(
                bottomCenter,
                window.GeometryLib.formatMeasurement(dims.width),
                'measurement-label-final measurement-width'
            ).addTo(window.map);
            shape.distanceLabels.push(widthMarkerBottom);
            
            // Left edge (height)
            const leftCenter = L.latLng((bounds.getSouth() + bounds.getNorth()) / 2, bounds.getWest());
            const heightMarkerLeft = window.GeometryLib.createMeasurementMarker(
                leftCenter,
                window.GeometryLib.formatMeasurement(dims.height),
                'measurement-label-final measurement-height'
            ).addTo(window.map);
            shape.distanceLabels.push(heightMarkerLeft);
            
            // Area (center)
            const center = bounds.getCenter();
            const areaMarker = window.GeometryLib.createMeasurementMarker(
                center,
                window.GeometryLib.formatMeasurement(dims.area, 'ft²'),
                'measurement-label-final measurement-area'
            ).addTo(window.map);
            shape._areaLabel = areaMarker;
            
            // Store cached dimensions for rotation
            shape._cachedDimensions = dims;
            
            // Attach recompute function for edits/rotation
            shape._recomputeLabels = () => _recomputeRectangleLabels(shape);
            if (!shape._hasRecomputeListener) {
                shape.on('edit', shape._recomputeLabels);
                shape._hasRecomputeListener = true;
            }
            
            DrawDebug('RECT', 'Rectangle labels added successfully');
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in addFinalLabels', error);
        }
    }

    function _recomputeRectangleLabels(shape) {
        DrawDebug('RECT', '_recomputeRectangleLabels called', shape);
        
        try {
            if (!shape.distanceLabels || !shape._areaLabel) {
                addFinalLabels(shape); // Re-add if missing
                return;
            }

            const bounds = shape.getBounds();
            const dims = shape._cachedDimensions || window.GeometryLib.calculateRectangleDimensions(bounds);
            
            // Update position of all labels
            const topCenter = L.latLng(bounds.getNorth(), (bounds.getWest() + bounds.getEast()) / 2);
            const rightCenter = L.latLng((bounds.getSouth() + bounds.getNorth()) / 2, bounds.getEast());
            const bottomCenter = L.latLng(bounds.getSouth(), (bounds.getWest() + bounds.getEast()) / 2);
            const leftCenter = L.latLng((bounds.getSouth() + bounds.getNorth()) / 2, bounds.getWest());
            const center = bounds.getCenter();
            
            // Update label positions
            if (shape.distanceLabels[0]) shape.distanceLabels[0].setLatLng(topCenter);
            if (shape.distanceLabels[1]) shape.distanceLabels[1].setLatLng(rightCenter);
            if (shape.distanceLabels[2]) shape.distanceLabels[2].setLatLng(bottomCenter);
            if (shape.distanceLabels[3]) shape.distanceLabels[3].setLatLng(leftCenter);
            if (shape._areaLabel) shape._areaLabel.setLatLng(center);
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in _recomputeRectangleLabels', error);
        }
    }

    function clearLabels(shape){
        try {
            if (shape.distanceLabels) {
                shape.distanceLabels.forEach(m => { try { window.map.removeLayer(m); } catch(_){} });
                shape.distanceLabels = [];
            }
            if (shape._areaLabel) { try { window.map.removeLayer(shape._areaLabel); } catch(_){} shape._areaLabel = null; }
        } catch(_) {}
    }

    // ===== EDITING =====
    // Helper functions for rectangle model computation
    function _latLngsToPoints(latlngs) {
        return latlngs.map(ll => window.map.latLngToLayerPoint(ll));
    }

    function _pointsToLatLngs(points) {
        return points.map(pt => window.map.layerPointToLatLng(pt));
    }

    function _add(p1, p2) { return L.point(p1.x + p2.x, p1.y + p2.y); }
    function _mul(p, s) { return L.point(p.x * s, p.y * s); }
    function _dot(x1, y1, x2, y2) { return x1 * x2 + y1 * y2; }
    function _unit(x, y) { const len = Math.hypot(x, y); return len > 0 ? L.point(x/len, y/len) : L.point(0, 0); }

    function computeRectModelFromPolygon(polygon) {
        try {
            const ring = polygon.getLatLngs()[0];
            if (!ring || ring.length < 4) return null;
            const corners = [ring[0], ring[1], ring[2], ring[3]];
            const pts = _latLngsToPoints(corners);
            const center = L.point(
                (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4,
                (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4
            );
            const uVec = _unit(pts[1].x - pts[0].x, pts[1].y - pts[0].y); // width axis
            const vVec = _unit(-(uVec.y), uVec.x); // height axis (90 deg)
            const halfWidth = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / 2;
            const halfHeight = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y) / 2;
            const angle = Math.atan2(uVec.y, uVec.x);
            return { center, halfWidth, halfHeight, angle, uVec, vVec };
        } catch(_) { return null; }
    }

    function buildRectLatLngsFromModel(model) {
        const { center, halfWidth: hw, halfHeight: hh, uVec, vVec } = model;
        const p0 = _add(_add(center, _mul(L.point(uVec.x, uVec.y), -hw)), _mul(L.point(vVec.x, vVec.y), -hh));
        const p1 = _add(_add(center, _mul(L.point(uVec.x, uVec.y),  hw)), _mul(L.point(vVec.x, vVec.y), -hh));
        const p2 = _add(_add(center, _mul(L.point(uVec.x, uVec.y),  hw)), _mul(L.point(vVec.x, vVec.y),  hh));
        const p3 = _add(_add(center, _mul(L.point(uVec.x, uVec.y), -hw)), _mul(L.point(vVec.x, vVec.y),  hh));
        return _pointsToLatLngs([p0, p1, p2, p3]);
    }

    function updateRectScaleHandles(polygon) {
        try {
            const corners = polygon.getLatLngs()[0];
            if (!corners || corners.length < 4) return;
            const mids = [
                L.latLng((corners[0].lat + corners[1].lat) / 2, (corners[0].lng + corners[1].lng) / 2),
                L.latLng((corners[1].lat + corners[2].lat) / 2, (corners[1].lng + corners[2].lng) / 2),
                L.latLng((corners[2].lat + corners[3].lat) / 2, (corners[2].lng + corners[3].lng) / 2),
                L.latLng((corners[3].lat + corners[0].lat) / 2, (corners[3].lng + corners[0].lng) / 2)
            ];
            if (polygon._rectScaleHandlesMid) {
                polygon._rectScaleHandlesMid.forEach((h, i) => { try { h.setLatLng(mids[i]); } catch(_){} });
            }
            if (polygon._rectScaleHandlesCorner) {
                polygon._rectScaleHandlesCorner.forEach((h, i) => { try { h.setLatLng(corners[i]); } catch(_){} });
            }
        } catch(_) {}
    }

    function enableRectScaleMode(polygon) {
        DrawDebug('RECT', 'enableRectScaleMode called', polygon);
        
        try {
            if (polygon._rectScaleActive) return;
            polygon._rectScaleActive = true;

            // Turn off default edit while in scale mode (avoid vertex handles)
            try {
                const editHandler = window.map?._drawControl?._toolbars?.edit?._modes?.edit?.handler;
                if (editHandler && (editHandler._enabled || editHandler.enabled)) {
                    polygon._resumeEditAfterScale = true;
                    editHandler.disable();
                }
            } catch(_) {}

            // Clear old custom handles
            try {
                if (polygon._rectScaleHandlesMid) polygon._rectScaleHandlesMid.forEach(h => { try { window.map.removeLayer(h); } catch(_){} });
                if (polygon._rectScaleHandlesCorner) polygon._rectScaleHandlesCorner.forEach(h => { try { window.map.removeLayer(h); } catch(_){} });
            } catch(_){}
            polygon._rectScaleHandlesMid = [];
            polygon._rectScaleHandlesCorner = [];

            const model = computeRectModelFromPolygon(polygon);
            if (!model) return;
            polygon._rectModel = model;
            const corners = polygon.getLatLngs()[0];
            const mids = [
                L.latLng((corners[0].lat + corners[1].lat) / 2, (corners[0].lng + corners[1].lng) / 2),
                L.latLng((corners[1].lat + corners[2].lat) / 2, (corners[1].lng + corners[2].lng) / 2),
                L.latLng((corners[2].lat + corners[3].lat) / 2, (corners[2].lng + corners[3].lng) / 2),
                L.latLng((corners[3].lat + corners[0].lat) / 2, (corners[3].lng + corners[0].lng) / 2)
            ];

            const midIcon = L.divIcon({
                className: 'rect-scale-handle',
                html: '<div style="width:18px;height:18px;border-radius:4px;background:#ffffff;border:2px solid #10b981;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>',
                iconSize: [18, 18], iconAnchor: [9, 9]
            });
            const cornerIcon = L.divIcon({
                className: 'rect-corner-handle',
                html: '<div style="width:16px;height:16px;border-radius:50%;background:#ffffff;border:2px solid #0ea5e9;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>',
                iconSize: [16, 16], iconAnchor: [8, 8]
            });

            // Dim measurement labels to reveal handles while editing
            try {
                if (polygon.distanceLabels) {
                    polygon.distanceLabels.forEach(m => { const el = m.getElement && m.getElement(); if (el) el.firstChild?.classList?.add('measurement-editing'); });
                }
                if (polygon._areaLabel) {
                    const el = polygon._areaLabel.getElement && polygon._areaLabel.getElement();
                    if (el) el.firstChild?.classList?.add('measurement-editing');
                }
            } catch(_) {}

            // Mid-edge handles: scale one dimension
            mids.forEach((midLatLng, idx) => {
                const handle = L.marker(midLatLng, { draggable: true, icon: midIcon, title: 'Scale' }).addTo(window.map);
                polygon._rectScaleHandlesMid.push(handle);
                let startPt = null;
                let startModel = null;
                handle.on('dragstart', () => {
                    startPt = window.map.latLngToLayerPoint(handle.getLatLng());
                    startModel = computeRectModelFromPolygon(polygon);
                    polygon._rectModel = startModel;
                });
                handle.on('drag', () => {
                    if (!startPt || !startModel) return;
                    const curPt = window.map.latLngToLayerPoint(handle.getLatLng());
                    const delta = L.point(curPt.x - startPt.x, curPt.y - startPt.y);
                    const u = startModel.uVec; const v = startModel.vVec;
                    let model = { ...startModel };
                    if (idx === 0 || idx === 2) {
                        // width edge → adjust height along v
                        const signed = _dot(delta.x, delta.y, v.x, v.y);
                        model.halfHeight = Math.max(1, startModel.halfHeight + (idx === 0 ? -signed : signed));
                        const centerShift = (idx === 0 ? -signed : signed) / 2;
                        model.center = _add(startModel.center, _mul(L.point(v.x, v.y), centerShift));
                    } else {
                        // height edge → adjust width along u
                        const signed = _dot(delta.x, delta.y, u.x, u.y);
                        model.halfWidth = Math.max(1, startModel.halfWidth + (idx === 3 ? -signed : signed));
                        const centerShift = (idx === 3 ? -signed : signed) / 2;
                        model.center = _add(startModel.center, _mul(L.point(u.x, u.y), centerShift));
                    }
                    const newCorners = buildRectLatLngsFromModel(model);
                    polygon.setLatLngs([newCorners]);
                    // Update labels live
                    try { if (polygon._recomputeLabels) { polygon._recomputeLabels(); } } catch(_) {}
                    updateRectScaleHandles(polygon);
                    // Only update labels for legacy shapes
                    if (!polygon._hasMeasurements) {
                        try { if (window.addDistanceLabels) window.addDistanceLabels(polygon); } catch(_) {}
                    }
                    try { if (window.updatePolygonWatermark) window.updatePolygonWatermark(polygon); } catch(_) {}
                });
                handle.on('dragend', () => {
                    const mdl = computeRectModelFromPolygon(polygon);
                    if (mdl) polygon._rectModel = mdl;
                    try { if (polygon._recomputeLabels) { polygon._recomputeLabels(); } } catch(_) {}
                });
            });

            // Corner handles: scale both dimensions
            corners.forEach((cornerLL, idx) => {
                const handle = L.marker(cornerLL, { draggable: true, icon: cornerIcon, title: 'Resize' }).addTo(window.map);
                polygon._rectScaleHandlesCorner.push(handle);
                let startPt = null;
                let startModel = null;
                handle.on('dragstart', () => {
                    startPt = window.map.latLngToLayerPoint(handle.getLatLng());
                    startModel = computeRectModelFromPolygon(polygon);
                    polygon._rectModel = startModel;
                });
                handle.on('drag', () => {
                    if (!startPt || !startModel) return;
                    const curPt = window.map.latLngToLayerPoint(handle.getLatLng());
                    const delta = L.point(curPt.x - startPt.x, curPt.y - startPt.y);
                    const u = startModel.uVec; const v = startModel.vVec;
                    // Corner signs relative to u and v axes
                    const signU = (idx === 0 || idx === 3) ? -1 : 1; // left corners reduce u
                    const signV = (idx === 0 || idx === 1) ? -1 : 1; // top corners reduce v
                    const du = _dot(delta.x, delta.y, u.x, u.y) * signU;
                    const dv = _dot(delta.x, delta.y, v.x, v.y) * signV;
                    let model = { ...startModel };
                    model.halfWidth = Math.max(1, startModel.halfWidth + du);
                    model.halfHeight = Math.max(1, startModel.halfHeight + dv);
                    // Center shifts half of each
                    model.center = _add(
                        _add(startModel.center, _mul(L.point(u.x, u.y), du / 2 * signU)),
                        _mul(L.point(v.x, v.y), dv / 2 * signV)
                    );
                    const newCorners = buildRectLatLngsFromModel(model);
                    polygon.setLatLngs([newCorners]);
                    // Update labels live
                    try { if (polygon._recomputeLabels) { polygon._recomputeLabels(); } } catch(_) {}
                    updateRectScaleHandles(polygon);
                    // Only update labels for legacy shapes
                    if (!polygon._hasMeasurements) {
                        try { if (window.addDistanceLabels) window.addDistanceLabels(polygon); } catch(_) {}
                    }
                    try { if (window.updatePolygonWatermark) window.updatePolygonWatermark(polygon); } catch(_) {}
                });
                handle.on('dragend', () => {
                    const mdl = computeRectModelFromPolygon(polygon);
                    if (mdl) polygon._rectModel = mdl;
                    try { if (polygon._recomputeLabels) { polygon._recomputeLabels(); } } catch(_) {}
                });
            });

            updateRectScaleHandles(polygon);
            
            // Add Escape key handler
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    disableRectScaleMode(polygon);
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
        } catch(error) {
            DrawDebug('ERROR', 'Error in enableRectScaleMode', error);
        }
    }

    function disableRectScaleMode(polygon) {
        DrawDebug('RECT', 'disableRectScaleMode called', polygon);
        
        try {
            if (!polygon._rectScaleActive) return;
            polygon._rectScaleActive = false;
            if (polygon._rectScaleHandlesMid) polygon._rectScaleHandlesMid.forEach(h => { try { window.map.removeLayer(h); } catch(_){} });
            if (polygon._rectScaleHandlesCorner) polygon._rectScaleHandlesCorner.forEach(h => { try { window.map.removeLayer(h); } catch(_){} });
            polygon._rectScaleHandlesMid = [];
            polygon._rectScaleHandlesCorner = [];
            
            // Restore label visibility
            try {
                if (polygon.distanceLabels) {
                    polygon.distanceLabels.forEach(m => { const el = m.getElement && m.getElement(); if (el) el.firstChild?.classList?.remove('measurement-editing'); });
                }
                if (polygon._areaLabel) {
                    const el = polygon._areaLabel.getElement && polygon._areaLabel.getElement();
                    if (el) el.firstChild?.classList?.remove('measurement-editing');
                }
            } catch(_) {}
            
            // Optionally resume default edit mode and select this shape
            try {
                if (polygon._resumeEditAfterScale) {
                    const editHandler = window.map?._drawControl?._toolbars?.edit?._modes?.edit?.handler;
                    if (editHandler) {
                        editHandler.enable();
                        setTimeout(() => {
                            try {
                                const group = editHandler._markersGroup || editHandler._featureGroup || null;
                                if (group && typeof group.eachLayer === 'function') {
                                    group.eachLayer(function(marker){
                                        if (marker && marker._shape === polygon) { try { marker.fire('click'); } catch(_) {} }
                                    });
                                }
                            } catch(_) {}
                        }, 60);
                    }
                }
            } catch(_) {}
            polygon._resumeEditAfterScale = false;
        } catch(error) {
            DrawDebug('ERROR', 'Error in disableRectScaleMode', error);
        }
    }

    function enablePolygonRotation(polygon) {
        DrawDebug('RECT', 'enablePolygonRotation called', polygon);
        
        try {
            // Disable scale mode first
            disableRectScaleMode(polygon);
            
            // Call the existing rotation function
            if (window.enablePolygonRotation) {
                window.enablePolygonRotation(polygon);
            }
        } catch(error) {
            DrawDebug('ERROR', 'Error in enablePolygonRotation', error);
        }
    }

    // ===== PUBLIC API =====
    if (typeof window !== 'undefined') {
        window.RectangleTool = {
            // Labels
            addFinalLabels,
            clearLabels,
            _recomputeRectangleLabels,
            
            // Drawing
            setupCustomRectangleTracking: function() {
                console.log('🔧 Setting up custom rectangle tracking with layer monitoring');
                
                // Clear any existing real-time measurements
                if (window.realtimeRectangleMeasurements) {
                    window.realtimeRectangleMeasurements.forEach(marker => window.map.removeLayer(marker));
                }
                window.realtimeRectangleMeasurements = [];
                
                // Monitor the map for new rectangle layers
                const originalAddLayer = window.map.addLayer;
                window.map.addLayer = function(layer) {
                    const result = originalAddLayer.call(this, layer);
                    
                    // Check if this is a rectangle being added during drawing
                    if (layer instanceof L.Rectangle && window.isDrawing) {
                        console.log('🔍 Rectangle layer added during drawing:', layer);
                        
                        // Set up real-time measurements for this rectangle
                        // This would be handled by the v2 drawing system
                    }
                    
                    return result;
                };
                
                console.log('✅ Custom rectangle tracking set up with layer monitoring');
            },
            
            // Editing
            enableRectScaleMode,
            disableRectScaleMode,
            enablePolygonRotation,
            updateRectScaleHandles,
            
            // Drawing (delegates to existing system)
            startDraw: function() {
                if (window.CustomDrawing && typeof window.CustomDrawing.startRectangleDrawing === 'function') {
                    window.CustomDrawing.startRectangleDrawing();
                } else if (window.UnifiedDrawing && typeof window.UnifiedDrawing.startDrawing === 'function') {
                    window.UnifiedDrawing.startDrawing('rectangle');
                }
            }
        };
        
        // Also expose the functions globally for backward compatibility
        window.enableRectScaleMode = enableRectScaleMode;
        window.disableRectScaleMode = disableRectScaleMode;
        window.RectangleLabels = { addFinalLabels, clearLabels, _recomputeRectangleLabels };
    }
})();
