/* Crane Tool - Complete Implementation */
(function(){
    const DrawDebug = window.DrawDebug || function(tag, msg, data) {
        if (window.DEBUG_DRAW) {
            try { console.log(`[DRAW][${tag}] ${msg}`, data || ''); } catch(_) {}
        }
    };

    // ===== DRAWING =====
    function startCraneDrawing() {
        if (window.currentShape) {
            if (window.updateDrawingStatus) {
                window.updateDrawingStatus('Remove existing shape before starting a crane');
            }
            return;
        }
        
        console.log('🔧 CRANE: startCraneDrawing called');
        DrawDebug('CRANE', 'startCraneDrawing called');
        
        try {
            // Set global state
            window.isCraneModeActive = true;
            if (window.setDrawingModeActive) window.setDrawingModeActive(true);
            
            // Initialize crane state
            window.craneStage = 'pad';
            window.cranePadFirstCorner = null;
            window.cranePadRect = null;
            window.cranePadCenter = null;
            window.craneRadiusLine = null;
            window.craneRadiusMeters = 0;
            window.craneRadiusFeet = 0;
            window.craneStartAzimuthRad = 0;
            window.craneSweepSector = null;
            window.craneRealtimeLabels = [];
            window.currentCraneGroup = new L.FeatureGroup();
            window.cranesLayer.addLayer(window.currentCraneGroup);
            
            if (window.updateDrawingStatus) {
                window.updateDrawingStatus('Draw Crane Pad/Footprint', 'drawing');
            }
            
            // Improve UX for keyboard and zoom
            const c = window.map.getContainer();
            c.setAttribute('tabindex', '0');
            c.focus({preventScroll: true});
            if (window.map.doubleClickZoom) {
                window.map.doubleClickZoom.disable();
            }
            
            // Set up event listeners
            window.map.on('click', onCraneClick);
            window.map.on('mousemove', onCraneMouseMove);
            document.addEventListener('keydown', onCraneKeyDown);
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in startCraneDrawing', error);
        }
    }

    function stopCraneDrawing() {
        DrawDebug('CRANE', 'stopCraneDrawing called');
        
        try {
            window.isCraneModeActive = false;
            window.craneStage = 'idle';
            window.map.off('click', onCraneClick);
            window.map.off('mousemove', onCraneMouseMove);
            document.removeEventListener('keydown', onCraneKeyDown);
            clearCraneRealtimeLabels();
            if (window.setDrawingModeActive) window.setDrawingModeActive(false);
            
            // Re-enable double-click zoom
            if (window.map.doubleClickZoom) {
                window.map.doubleClickZoom.enable();
            }
            
            if (window.updateDrawingStatus) {
                window.updateDrawingStatus('Ready');
            }
        } catch (error) {
            DrawDebug('ERROR', 'Error in stopCraneDrawing', error);
        }
    }

    function onCraneKeyDown(e) {
        if (!window.isCraneModeActive) return;
        
        if (e.key === 'Escape') {
            e.preventDefault();
            // Cancel and cleanup
            try { 
                if (window.currentCraneGroup) { 
                    window.cranesLayer.removeLayer(window.currentCraneGroup); 
                } 
            } catch(_) {}
            window.currentCraneGroup = null;
            stopCraneDrawing();
        } else if ((e.key === 'Enter' || e.key === ' ') && window.craneStage === 'sweep' && window.craneSweepSector) {
            e.preventDefault();
            finalizeCrane();
        }
    }

    function onCraneClick(e) {
        if (!window.isCraneModeActive) return;
        
        console.log('🔧 CRANE: Click event. Stage:', window.craneStage, 'LatLng:', e.latlng);
        
        if (window.craneStage === 'pad') {
            if (!window.cranePadFirstCorner) {
                window.cranePadFirstCorner = e.latlng;
            } else {
                // Finalize rect
                const second = e.latlng;
                const bounds = L.latLngBounds(window.cranePadFirstCorner, second);
                if (window.cranePadRect) { 
                    try { window.currentCraneGroup.removeLayer(window.cranePadRect); } catch(_){} 
                }
                window.cranePadRect = L.rectangle(bounds, { 
                    color: '#1f2937',
                    weight: 2,
                    fillColor: '#1f2937',
                    fillOpacity: 0.6
                });
                window.currentCraneGroup.addLayer(window.cranePadRect);
                window.cranePadCenter = bounds.getCenter();
                
                // Advance to radius stage
                window.craneStage = 'radius';
                if (window.updateDrawingStatus) {
                    window.updateDrawingStatus('Draw Crane Swing Radius', 'drawing');
                }
                if (window.updateToolState) {
                    window.updateToolState('crane', 'radius', null, true);
                }
            }
        } else if (window.craneStage === 'radius') {
            // Fix radius
            let finalTarget = e.latlng;
            if (window.craneRadiusLockPx !== null) {
                const centerPt = window.map.latLngToContainerPoint(window.cranePadCenter);
                const mousePt = window.map.latLngToContainerPoint(e.latlng);
                const ang = Math.atan2(mousePt.y - centerPt.y, mousePt.x - centerPt.x);
                const inc = Math.PI / 36; // 5° increments
                const snapped = Math.round(ang / inc) * inc;
                const snapPt = L.point(
                    centerPt.x + window.craneRadiusLockPx * Math.cos(snapped),
                    centerPt.y + window.craneRadiusLockPx * Math.sin(snapped)
                );
                finalTarget = window.map.containerPointToLatLng(snapPt);
            }
            setCraneRadius(finalTarget);
            window.craneStartDeg = Math.round(radToDeg(window.craneStartAzimuthRad));
            window.craneLastAngleDeg = window.craneStartDeg;
            window.craneSweepAccumDeg = 0;
            window.craneStage = 'sweep';
            if (window.updateDrawingStatus) {
                window.updateDrawingStatus('Draw Crane Swing Sweep', 'drawing');
            }
            if (window.updateToolState) {
                window.updateToolState('crane', 'sweep', null, true);
            }
        } else if (window.craneStage === 'sweep') {
            finalizeCrane();
        }
    }

    function onCraneMouseMove(e) {
        if (!window.isCraneModeActive) return;
        
        console.log('🔧 CRANE: Mouse move. Stage:', window.craneStage, 'LatLng:', e.latlng);
        
        if (window.craneStage === 'pad') {
            if (!window.cranePadFirstCorner) return;
            const bounds = L.latLngBounds(window.cranePadFirstCorner, e.latlng);
            if (!window.cranePadRect) {
                window.cranePadRect = L.rectangle(bounds, { 
                    color: '#1f2937',
                    weight: 2,
                    fillColor: '#1f2937',
                    fillOpacity: 0.6
                });
                window.currentCraneGroup.addLayer(window.cranePadRect);
            } else {
                window.cranePadRect.setBounds(bounds);
            }
            
            // Measure and show labels
            clearCraneRealtimeLabels();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const widthFeet = window.calculateDistanceInFeet({lat: ne.lat, lng: sw.lng}, {lat: ne.lat, lng: ne.lng});
            const heightFeet = window.calculateDistanceInFeet({lat: sw.lat, lng: ne.lng}, {lat: ne.lat, lng: ne.lng});
            const areaFeet = Math.round(widthFeet * heightFeet);
            const center = bounds.getCenter();
            window.craneRealtimeLabels.push(addCraneLabel(center.lat, center.lng, `${Math.round(widthFeet)} ft × ${Math.round(heightFeet)} ft\n${areaFeet} sq ft`));
            
        } else if (window.craneStage === 'radius' && window.cranePadCenter) {
            // Handle radius drawing with optional shift lock
            let target = e.latlng;
            const shiftActive = (e.originalEvent && e.originalEvent.shiftKey) || window.isShiftDown;
            const centerPt = window.map.latLngToContainerPoint(window.cranePadCenter);
            const mousePt = window.map.latLngToContainerPoint(e.latlng);
            
            if (shiftActive) {
                // Initialize lock length once
                if (window.craneRadiusLockPx === null) {
                    window.craneRadiusLockPx = Math.hypot(mousePt.x - centerPt.x, mousePt.y - centerPt.y);
                }
                // Snap angle to 5° increments but keep length locked
                const ang = Math.atan2(mousePt.y - centerPt.y, mousePt.x - centerPt.x);
                const inc = Math.PI / 36; // 5 degrees
                const snapped = Math.round(ang / inc) * inc;
                const snapPt = L.point(
                    centerPt.x + window.craneRadiusLockPx * Math.cos(snapped),
                    centerPt.y + window.craneRadiusLockPx * Math.sin(snapped)
                );
                target = window.map.containerPointToLatLng(snapPt);
            } else {
                window.craneRadiusLockPx = null;
            }
            setCraneRadius(target, true);
            
        } else if (window.craneStage === 'sweep' && window.cranePadCenter && window.craneRadiusMeters > 0) {
            console.log('🔧 CRANE: Calling drawCraneSector from mouse move');
            drawCraneSector(e.latlng, true);
        }
    }

    function setCraneRadius(targetLatLng, previewOnly = false) {
        console.log('🔧 CRANE: setCraneRadius called. Target:', targetLatLng, 'PreviewOnly:', previewOnly);
        clearCraneRealtimeLabels();
        if (!window.cranePadCenter) return;
        
        // Create/update radius line
        if (!window.craneRadiusLine) {
            window.craneRadiusLine = L.polyline([window.cranePadCenter, targetLatLng], { 
                color: '#1f2937',
                weight: 3,
                dashArray: '5, 5'
            });
            window.currentCraneGroup.addLayer(window.craneRadiusLine);
        } else {
            window.craneRadiusLine.setLatLngs([window.cranePadCenter, targetLatLng]);
        }
        
        // Calculate distance and azimuth
        window.craneRadiusFeet = window.calculateDistanceInFeet(window.cranePadCenter, targetLatLng);
        window.craneRadiusMeters = window.craneRadiusFeet / 3.28084;
        
        // Use GeometryLib directly instead of global functions
        if (!window.GeometryLib || typeof window.GeometryLib.bearingRad !== 'function') {
            console.error('❌ GeometryLib.bearingRad is not available! Available:', {
                GeometryLib: typeof window.GeometryLib,
                bearingRad: window.GeometryLib ? typeof window.GeometryLib.bearingRad : 'undefined'
            });
            return;
        }
        
        window.craneStartAzimuthRad = window.GeometryLib.bearingRad(window.cranePadCenter, targetLatLng);
        
        // Screen-space radius in pixels for exact visual match
        try {
            const c = window.map.latLngToContainerPoint(window.cranePadCenter);
            const t = window.map.latLngToContainerPoint(targetLatLng);
            window.craneRadiusPx = Math.hypot(t.x - c.x, t.y - c.y);
            console.log('🔧 CRANE: Radius set. Meters:', window.craneRadiusMeters, 'Feet:', window.craneRadiusFeet, 'Pixels:', window.craneRadiusPx);
        } catch(_) { 
            window.craneRadiusPx = 0; 
        }
        
        const mid = L.latLng((window.cranePadCenter.lat + targetLatLng.lat)/2, (window.cranePadCenter.lng + targetLatLng.lng)/2);
        window.craneRealtimeLabels.push(addCraneLabel(mid.lat, mid.lng, `${Math.round(window.craneRadiusFeet)} ft`));
    }

    function drawCraneSector(currentLatLng, previewOnly = false) {
        console.log('🔧 CRANE: drawCraneSector called. CurrentLatLng:', currentLatLng, 'PreviewOnly:', previewOnly);
        console.log('🔧 CRANE: State check - cranePadCenter:', window.cranePadCenter, 'craneRadiusPx:', window.craneRadiusPx, 'craneStartDeg:', window.craneStartDeg);
        
        clearCraneRealtimeLabels();
        
        // Current angle in whole degrees
        const currentDeg = window.GeometryLib.wholeDegreeBearing(window.cranePadCenter, currentLatLng);
        console.log('🔧 CRANE: Current angle:', currentDeg);
        if (window.craneLastAngleDeg === null) {
            window.craneLastAngleDeg = currentDeg;
        }
        
        // Incremental change limited to shortest path per frame
        const delta = normalizeAngle(currentDeg - window.craneLastAngleDeg);
        window.craneSweepAccumDeg += delta;
        
        // Clamp total sweep to [-360, 360]
        if (window.craneSweepAccumDeg > 360) window.craneSweepAccumDeg = 360;
        if (window.craneSweepAccumDeg < -360) window.craneSweepAccumDeg = -360;
        window.craneLastAngleDeg = currentDeg;
        
        // Build sector polygon in screen space for perfect radius match
        console.log('🔧 CRANE: Building sector. StartDeg:', window.craneStartDeg, 'SweepAccumDeg:', window.craneSweepAccumDeg);
        
        // Use more segments for a smooth circular arc (not a triangle)
        const sweepAngle = Math.abs(window.craneSweepAccumDeg);
        const numSegments = Math.max(8, Math.floor(sweepAngle / 2)); // More segments for smoother arc
        
        const sectorLatLngs = buildSectorLatLngsFromPixels(
            window.cranePadCenter,
            window.craneRadiusMeters, // Use the actual radius in meters, not pixels
            window.craneStartDeg,
            window.craneStartDeg + window.craneSweepAccumDeg,
            numSegments
        );
        console.log('🔧 CRANE: Sector points generated:', sectorLatLngs.length, 'points');
        
        if (!window.craneSweepSector) {
            console.log('🔧 CRANE: Creating new sector polygon');
            window.craneSweepSector = L.polygon(sectorLatLngs, {
                color: '#dc2626',      // red dashed outline
                weight: 3,
                fillColor: '#f59e0b',  // orange fill
                fillOpacity: 0.25,
                dashArray: '10, 5'
            });
            window.currentCraneGroup.addLayer(window.craneSweepSector);
            console.log('🔧 CRANE: Sector added to group');
            try { window.craneSweepSector._path.style.fill = 'url(#craneCautionPattern)'; } catch(_) {}
        } else {
            console.log('🔧 CRANE: Updating existing sector');
            window.craneSweepSector.setLatLngs([sectorLatLngs]);
            try { window.craneSweepSector._path.style.fill = 'url(#craneCautionPattern)'; } catch(_) {}
        }
        
        // Center label for live sweep degrees
        window.craneRealtimeLabels.push(
            addCraneLabel(window.cranePadCenter.lat, window.cranePadCenter.lng, `${Math.round(Math.abs(window.craneSweepAccumDeg))}° sweep`)
        );
    }

    function finalizeCrane() {
        clearCraneRealtimeLabels();
        
        // Push to undo as a single action
        if (window.undoStack) {
            window.undoStack.push({ action: 'draw', shape: window.currentCraneGroup });
            if (window.updateUndoButton) window.updateUndoButton();
        }
        
        // Create popup summary
        const padBounds = window.cranePadRect.getBounds();
        const padWidth = window.calculateDistanceInFeet(
            {lat: padBounds.getNorth(), lng: padBounds.getWest()},
            {lat: padBounds.getNorth(), lng: padBounds.getEast()}
        );
        const padHeight = window.calculateDistanceInFeet(
            {lat: padBounds.getNorth(), lng: padBounds.getWest()},
            {lat: padBounds.getSouth(), lng: padBounds.getWest()}
        );
        
        const popupContent = `
            <strong>Crane</strong><br>
            Pad: ${Math.round(padWidth)} ft × ${Math.round(padHeight)} ft<br>
            Radius: ${Math.round(window.craneRadiusFeet)} ft<br>
            Sweep: ${Math.round(window.craneSweepAccumDeg || 0)}°<br>
            Double-click to edit | Use Undo to remove
        `;
        
        window.currentCraneGroup.bindPopup(popupContent);
        window.currentCraneGroup.on('click', function() {
            window.currentShape = window.currentCraneGroup;
            if (window.updateSubmitButton) window.updateSubmitButton();
        });
        
        // Add rotate handle for pad footprint (convert rect -> polygon for rotation)
        // Convert pad to rotatable polygon and show rotate handle for pre-save adjustment
        try {
            setupCranePadRotation();
        } catch (e) {
            DrawDebug('ERROR', 'setupCranePadRotation failed', e);
        }

        // Stop drawing mode listeners
        stopCraneDrawing();
    }

    function clearCraneRealtimeLabels() {
        try {
            if (window.craneRealtimeLabels) {
                window.craneRealtimeLabels.forEach(m => { 
                    try { window.map.removeLayer(m); } catch(_){} 
                });
            }
        } catch(_) {}
        window.craneRealtimeLabels = [];
    }

    function addCraneLabel(lat, lng, text) {
        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'crane-measurement-label',
                html: `<div style="background: rgba(255,255,255,0.98); border: 2px solid #111827; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #111827; white-space: pre; box-shadow: 0 3px 6px rgba(0,0,0,0.3); pointer-events: none;">${text}</div>`,
                iconSize: [0,0], 
                iconAnchor: [0,0]
            })
        }).addTo(window.map);
        return marker;
    }

    // Helper function to normalize angle differences
    function normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    // Helper function to build sector using proper distance calculations
    function buildSectorLatLngsFromPixels(center, radiusMeters, startDeg, endDeg, numSegments) {
        console.log('🔧 CRANE: buildSectorLatLngsFromPixels called with:', {center, radiusMeters, startDeg, endDeg, numSegments});
        
        const latLngs = [center];
        
        if (!radiusMeters || radiusMeters === 0) {
            console.warn('⚠️ CRANE: buildSectorLatLngsFromPixels called with zero or undefined radiusMeters.');
            return [center];
        }

        // Use Leaflet's distance calculation to create accurate points
        // Create a reference point at the correct distance in the start direction
        const startAngleRad = window.GeometryLib.degToRad(startDeg);
        
        // Calculate a reference point at the correct distance
        // Use a small offset to determine the scale factor
        const testOffset = 0.0001; // Small test offset in degrees
        const testPoint = L.latLng(center.lat + testOffset, center.lng);
        const testDistance = window.map.distance(center, testPoint);
        const scaleFactor = testDistance / (testOffset * 111000); // Adjust for actual distance calculation
        
        // Calculate the radius in degrees using the scale factor
        const radiusDeg = radiusMeters / (111000 * scaleFactor);
        
        console.log('🔧 CRANE: Using radiusDeg:', radiusDeg, 'scaleFactor:', scaleFactor);
        
        // Create arc points using the calculated radius
        for (let i = 0; i <= numSegments; i++) {
            const t = i / numSegments;
            const angleDeg = startDeg + t * (endDeg - startDeg);
            const angleRad = window.GeometryLib.degToRad(angleDeg);
            
            // Calculate lat/lng offset using the properly scaled radius
            const latOffset = radiusDeg * Math.cos(angleRad);
            const lngOffset = radiusDeg * Math.sin(angleRad) / Math.cos(window.GeometryLib.degToRad(center.lat));
            
            const lat = center.lat + latOffset;
            const lng = center.lng + lngOffset;
            latLngs.push(L.latLng(lat, lng));
        }
        
        console.log('🔧 CRANE: Generated', latLngs.length, 'points for sector using scaled calculation');
        return latLngs;
    }

    // ===== PAD ROTATION (rectangle footprint only) =====
    function setupCranePadRotation() {
        if (!window.currentCraneGroup || !window.cranePadRect) return;
        const bounds = window.cranePadRect.getBounds();
        const nw = L.latLng(bounds.getNorth(), bounds.getWest());
        const ne = L.latLng(bounds.getNorth(), bounds.getEast());
        const se = L.latLng(bounds.getSouth(), bounds.getEast());
        const sw = L.latLng(bounds.getSouth(), bounds.getWest());

        // Create polygon from rectangle for rotation rendering
        const padLatLngs = [nw, ne, se, sw];
        try { window.currentCraneGroup.removeLayer(window.cranePadRect); } catch(_){}
        window.cranePadRect = null;
        window.cranePadPoly = L.polygon(padLatLngs, {
            color: '#1f2937',
            weight: 2,
            fillColor: '#1f2937',
            fillOpacity: 0.6
        });
        window.currentCraneGroup.addLayer(window.cranePadPoly);

        // Base vectors in layer-point space relative to center
        const center = bounds.getCenter();
        window.cranePadCenter = center;
        const centerPt = window.map.latLngToLayerPoint(center);
        const cornerPts = padLatLngs.map(ll => window.map.latLngToLayerPoint(ll));
        window.cranePadBaseVectorsPx = cornerPts.map(pt => L.point(pt.x - centerPt.x, pt.y - centerPt.y));
        // Use NE corner (index 1) as the rotate handle reference
        window.cranePadHandleIndex = 1;

        createCraneRotateHandle();
    }

    function createCraneRotateHandle() {
        // Position at current NE corner
        const centerPt = window.map.latLngToLayerPoint(window.cranePadCenter);
        const base = window.cranePadBaseVectorsPx[window.cranePadHandleIndex];
        const handlePt = L.point(centerPt.x + base.x, centerPt.y + base.y);
        const handleLatLng = window.map.layerPointToLatLng(handlePt);

        if (window.craneRotateHandle) {
            try { window.currentCraneGroup.removeLayer(window.craneRotateHandle); } catch(_){}
        }

        window.craneRotateHandle = L.marker(handleLatLng, {
            draggable: true,
            icon: L.divIcon({
                className: 'crane-rotate-handle',
                html: '<div style="width:12px;height:12px;border-radius:50%;background:#f59e0b;border:2px solid #dc2626;box-shadow:0 0 0 2px rgba(0,0,0,0.15);"></div>',
                iconSize: [12,12],
                iconAnchor: [6,6]
            })
        });

        window.craneRotateHandle.on('drag', onCraneRotateHandleDrag);
        window.craneRotateHandle.on('dragstart', onCraneRotateHandleDragStart);
        window.craneRotateHandle.on('dragend', onCraneRotateHandleDragEnd);
        window.currentCraneGroup.addLayer(window.craneRotateHandle);
    }

    function onCraneRotateHandleDragStart(e) {
        const centerPt = window.map.latLngToLayerPoint(window.cranePadCenter);
        const base = window.cranePadBaseVectorsPx[window.cranePadHandleIndex];
        // Base angle of handle vector
        window.cranePadBaseAngle = Math.atan2(base.y, base.x);
    }

    function onCraneRotateHandleDrag(e) {
        if (!window.cranePadBaseVectorsPx || !window.cranePadPoly) return;
        const centerPt = window.map.latLngToLayerPoint(window.cranePadCenter);
        const mousePt = window.map.latLngToLayerPoint(e.target.getLatLng());
        const dx = mousePt.x - centerPt.x;
        const dy = mousePt.y - centerPt.y;
        const currentAngle = Math.atan2(dy, dx);
        const delta = currentAngle - (window.cranePadBaseAngle || 0);

        // Rotate all base vectors by delta
        const rotatedPts = window.cranePadBaseVectorsPx.map(v => rotatePoint(v, delta));
        const newLatLngs = rotatedPts.map(v => window.map.layerPointToLatLng(L.point(centerPt.x + v.x, centerPt.y + v.y)));
        window.cranePadPoly.setLatLngs([newLatLngs]);

        // Snap handle back to circle at same radius
        if (window.craneRotateHandle) {
            const hv = rotatePoint(window.cranePadBaseVectorsPx[window.cranePadHandleIndex], delta);
            const newHandle = window.map.layerPointToLatLng(L.point(centerPt.x + hv.x, centerPt.y + hv.y));
            window.craneRotateHandle.setLatLng(newHandle);
        }
    }

    function onCraneRotateHandleDragEnd(e) {
        // Nothing special for now; polygon already updated
    }

    function rotatePoint(pt, angleRad) {
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        return L.point(pt.x * cos - pt.y * sin, pt.x * sin + pt.y * cos);
    }

    // ===== EDITING =====
    function enableCraneEditing(craneGroup) {
        DrawDebug('CRANE', 'enableCraneEditing called', craneGroup);
        
        try {
            // Crane editing would involve:
            // - Resizing the pad
            // - Adjusting the radius
            // - Modifying the sweep angle
            // - Moving the entire crane
            
            // For now, we'll implement basic functionality
            // This can be expanded based on specific requirements
            
            if (window.showEditPanel) {
                window.showEditPanel('crane', {
                    canResize: true,
                    canRotate: false,
                    canMove: true,
                    canDelete: true
                });
            }
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in enableCraneEditing', error);
        }
    }

    function disableCraneEditing(craneGroup) {
        DrawDebug('CRANE', 'disableCraneEditing called', craneGroup);
        
        try {
            // Clean up any editing handles or UI
            // This would be implemented based on specific editing requirements
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in disableCraneEditing', error);
        }
    }

    // ===== PUBLIC API =====
    if (typeof window !== 'undefined') {
        window.CraneTool = {
            // Drawing
            startCraneDrawing,
            stopCraneDrawing,
            onCraneClick,
            onCraneMouseMove,
            onCraneKeyDown,
            setCraneRadius,
            drawCraneSector,
            finalizeCrane,
            clearCraneRealtimeLabels,
            addCraneLabel,
            
            // Editing
            enableCraneEditing,
            disableCraneEditing,
            
            // Utility
            startDraw: function() {
                startCraneDrawing();
            }
        };
        
        // Also expose the functions globally for backward compatibility
        window.startCraneDrawing = startCraneDrawing;
        window.stopCraneDrawing = stopCraneDrawing;
        window.onCraneClick = onCraneClick;
        window.onCraneMouseMove = onCraneMouseMove;
        window.onCraneKeyDown = onCraneKeyDown;
        
        // Test function for debugging
        window.testCraneTool = function() {
            console.log('🧪 Testing crane tool...');
            console.log('CraneTool available:', !!window.CraneTool);
            console.log('startCraneDrawing available:', !!window.CraneTool?.startCraneDrawing);
            console.log('cranesLayer available:', !!window.cranesLayer);
            console.log('map available:', !!window.map);
            console.log('updateDrawingStatus available:', !!window.updateDrawingStatus);
            console.log('setDrawingModeActive available:', !!window.setDrawingModeActive);
            
            if (window.CraneTool && window.CraneTool.startCraneDrawing) {
                console.log('✅ Crane tool is ready!');
                return true;
            } else {
                console.log('❌ Crane tool is not ready!');
                return false;
            }
        };
        window.setCraneRadius = setCraneRadius;
        window.drawCraneSector = drawCraneSector;
        window.finalizeCrane = finalizeCrane;
        window.clearCraneRealtimeLabels = clearCraneRealtimeLabels;
        window.addCraneLabel = addCraneLabel;
    }
})();
