/* Fence Tool - Complete Implementation */
(function(){
    const DrawDebug = window.DrawDebug || function(tag, msg, data) {
        if (window.DEBUG_DRAW) {
            try { console.log(`[DRAW][${tag}] ${msg}`, data || ''); } catch(_) {}
        }
    };

    // ===== DRAWING =====
    function startFenceDrawing() {
        // Prevent drawing if a shape already exists
        if (window.currentShape) {
            console.log('Fence drawing prevented - shape already exists');
            if (window.updateDrawingStatus) {
                window.updateDrawingStatus('Remove existing shape before drawing a new one');
            }
            return;
        }
        
        DrawDebug('FENCE', 'startFenceDrawing called');
        
        try {
            // Use FenceDrawSession class for clean state management
            if (window.currentFenceSession) {
                console.warn('Fence session already active, disposing old one');
                window.currentFenceSession.dispose();
            }
            
            // Create new session with callbacks
            window.currentFenceSession = new window.FenceDrawSession(window.map, {
                color: '#ffd700',
                weight: 3,
                opacity: 0.8,
                snapTolerance: 8,
                
                onComplete: function(result) {
                    // Add to map
                    if (window.drawnItems) {
                        window.drawnItems.addLayer(result.layer);
                    }
                    
                    // Set as current shape
                    window.currentShape = result.layer;
                    
                    // Add click handler for selecting
                    result.layer.on('click', function() {
                        window.currentShape = result.layer;
                        if (typeof window.updateSubmitButton === 'function') {
                            window.updateSubmitButton();
                        }
                    });
                    
                    // Add to undo stack
                    if (typeof window.undoStack !== 'undefined') {
                        window.undoStack.push({ action: 'draw', shape: result.layer });
                        if (typeof window.updateUndoButton === 'function') {
                            window.updateUndoButton();
                        }
                    }
                    
                    // Update status
                    if (window.updateDrawingStatus) {
                        window.updateDrawingStatus('Ready');
                    }
                    if (typeof window.updateSubmitButton === 'function') {
                        window.updateSubmitButton();
                    }
                    
                    // Clear session reference
                    window.currentFenceSession = null;
                    window.isFenceModeActive = false;
                    window.isDrawing = false;
                },
                
                onCancel: function() {
                    // Update status
                    if (window.updateDrawingStatus) {
                        window.updateDrawingStatus('Ready');
                    }
                    
                    // Clear session reference
                    window.currentFenceSession = null;
                    window.isFenceModeActive = false;
                    window.isDrawing = false;
                }
            });
            
            // Start the session
            window.currentFenceSession.start();
            
            // Set legacy flags for compatibility
            window.isFenceModeActive = true;
            window.isDrawing = true;
            if (window.setDrawingModeActive) window.setDrawingModeActive(true);
            if (window.updateDrawingStatus) {
                window.updateDrawingStatus('Drawing Fence', 'drawing');
            }
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in startFenceDrawing', error);
        }
    }

    function stopFenceDrawing() {
        DrawDebug('FENCE', 'stopFenceDrawing called');
        
        try {
            // Dispose session cleanly
            if (window.currentFenceSession) {
                window.currentFenceSession.dispose();
                window.currentFenceSession = null;
            }
            
            // Set legacy flags
            window.isDrawing = false;
            window.isFenceModeActive = false;
            
            // Clean up any legacy markers/layers
            if (window.cleanupDrawingState) {
                window.cleanupDrawingState();
            }

            // Update status
            if (window.setDrawingModeActive) window.setDrawingModeActive(false);
            if (window.updateDrawingStatus) {
                window.updateDrawingStatus('Ready');
            }
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in stopFenceDrawing', error);
        }
    }

    // ===== LABELS =====
    function addFenceDistanceLabels(layer) {
        DrawDebug('FENCE', 'addFenceDistanceLabels called', layer);
        
        try {
            const latLngs = layer.getLatLngs(); // For polylines, getLatLngs() returns the array directly
            
            // If a FenceDrawSession already set labels, skip legacy rendering
            if (layer._fenceSessionLabels && layer._fenceSessionLabels.length > 0) {
                console.log('ℹ️ Fence labels managed by session - skipping legacy labels');
                return;
            }
            
            // Clear any existing labels
            if (layer.distanceLabels) {
                layer.distanceLabels.forEach(m => { 
                    try { window.map.removeLayer(m); } catch(_){} 
                });
            }
            layer.distanceLabels = [];
            
            // Add segment labels
            for (let i = 0; i < latLngs.length - 1; i++) {
                const a = latLngs[i];
                const b = latLngs[i + 1];
                const dist = window.calculateDistanceInFeet(a, b);
                const mid = window.calculateMidpoint(a, b);
                
                const marker = L.marker(mid, {
                    icon: L.divIcon({
                        className: 'fence-measurement-label',
                        html: `<div style="background: rgba(255,255,255,0.95); border: 2px solid #ffd700; border-radius: 6px; padding: 4px 8px; font-size: 11px; font-weight: 600; color: #1f2937; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2); pointer-events: none;">${Math.round(dist)} ft</div>`,
                        iconSize: [0,0], 
                        iconAnchor: [0,0]
                    })
                }).addTo(window.map);
                
                layer.distanceLabels.push(marker);
            }
            
            // Add total length label
            let totalLength = 0;
            for (let i = 0; i < latLngs.length - 1; i++) {
                totalLength += window.calculateDistanceInFeet(latLngs[i], latLngs[i + 1]);
            }
            
            const center = layer.getBounds().getCenter();
            const totalMarker = L.marker(center, {
                icon: L.divIcon({
                    className: 'fence-total-label',
                    html: `<div style="background: rgba(255,215,0,0.95); border: 2px solid #b8860b; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 700; color: #1f2937; white-space: nowrap; box-shadow: 0 3px 6px rgba(0,0,0,0.3); pointer-events: none;">Total: ${Math.round(totalLength)} ft</div>`,
                    iconSize: [0,0], 
                    iconAnchor: [0,0]
                })
            }).addTo(window.map);
            
            layer.distanceLabels.push(totalMarker);
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in addFenceDistanceLabels', error);
        }
    }

    function clearFenceLabels(layer) {
        try {
            if (layer.distanceLabels) {
                layer.distanceLabels.forEach(m => { 
                    try { window.map.removeLayer(m); } catch(_){} 
                });
                layer.distanceLabels = [];
            }
        } catch(_) {}
    }

    function updateFenceLabels(layer) {
        // Clear and re-add labels when fence is edited
        clearFenceLabels(layer);
        addFenceDistanceLabels(layer);
    }

    // ===== EDITING =====
    function enableFenceEditing(fence) {
        DrawDebug('FENCE', 'enableFenceEditing called', fence);
        
        try {
            // Fence editing involves:
            // - Moving vertices
            // - Adding/removing vertices
            // - Adjusting segment lengths
            // - Adding gates or breaks
            
            // For now, we'll use the standard Leaflet edit mode
            // This can be enhanced with custom editing tools
            
            if (window.showEditPanel) {
                window.showEditPanel('fence', {
                    canResize: true,
                    canRotate: false,
                    canMove: true,
                    canDelete: true,
                    canAddVertices: true,
                    canRemoveVertices: true
                });
            }
            
            // Attach label update listener
            fence.on('edit', function() {
                updateFenceLabels(fence);
            });
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in enableFenceEditing', error);
        }
    }

    function disableFenceEditing(fence) {
        DrawDebug('FENCE', 'disableFenceEditing called', fence);
        
        try {
            // Clean up any editing handles or UI
            // Remove event listeners if needed
            
        } catch (error) {
            DrawDebug('ERROR', 'Error in disableFenceEditing', error);
        }
    }

    // ===== LEGACY SUPPORT =====
    // These functions are kept for backward compatibility with the old fence system
    function onFenceMapClick(e) {
        if (!window.isFenceModeActive) return;
        
        const clicked = e.latlng;
        
        // If user clicks the first vertex, close and finish
        if (window.drawingVertices && window.drawingVertices.length >= 3) {
            const first = window.drawingVertices[0];
            const dist = window.calculateDistanceInFeet(clicked, first);
            if (dist < 20) { // 20 feet tolerance
                window.closingFenceToStart = true;
                if (window.finalizeFence) {
                    window.finalizeFence();
                }
                return;
            }
        }
        
        // Add vertex
        if (!window.drawingVertices) window.drawingVertices = [];
        window.drawingVertices.push(clicked);
        
        // Update preview
        if (window.drawingVertices.length >= 2) {
            const coords = [...window.drawingVertices];
            if (window.closingFenceToStart && window.drawingVertices.length >= 3) {
                coords.push(window.drawingVertices[0]);
            }
            
            if (!window.fencePreviewLine) {
                window.fencePreviewLine = L.polyline(coords, {
                    color: '#ffd700',
                    weight: 3,
                    opacity: 0.8,
                    interactive: false
                }).addTo(window.map);
            } else {
                window.fencePreviewLine.setLatLngs(coords);
            }
        }
    }

    function onFenceMouseMove(e) {
        if (!window.isFenceModeActive || !window.drawingVertices || window.drawingVertices.length === 0) return;
        
        const last = window.drawingVertices[window.drawingVertices.length - 1];
        // Snap preview when Shift is held
        const snappedLatLng = window.maybeSnapLatLngFrom ? 
            window.maybeSnapLatLngFrom(last, e.latlng, e.originalEvent) : e.latlng;
        
        if (!window.mouseMarker) {
            window.mouseMarker = L.circleMarker(snappedLatLng, {
                radius: 4,
                color: '#ffd700',
                fillColor: '#ffd700',
                fillOpacity: 0.8,
                weight: 2,
                interactive: false
            }).addTo(window.map);
        } else {
            window.mouseMarker.setLatLng(snappedLatLng);
        }
        
        // Update preview line
        if (window.fencePreviewLine) {
            const coords = [...window.drawingVertices, snappedLatLng];
            if (window.closingFenceToStart && window.drawingVertices.length >= 2) {
                coords.push(window.drawingVertices[0]);
            }
            window.fencePreviewLine.setLatLngs(coords);
        }
        
        // Show distance to first vertex if we have enough points
        if (window.drawingVertices.length >= 2) {
            const first = window.drawingVertices[0];
            const dist = window.calculateDistanceInFeet(snappedLatLng, first);
            if (dist < 20) { // Show snap indicator
                if (!window.fenceSnapIndicator) {
                    window.fenceSnapIndicator = L.circleMarker(first, {
                        radius: 8,
                        color: '#00ff00',
                        fillColor: '#00ff00',
                        fillOpacity: 0.3,
                        weight: 2,
                        interactive: false
                    }).addTo(window.map);
                }
            } else {
                if (window.fenceSnapIndicator) {
                    window.map.removeLayer(window.fenceSnapIndicator);
                    window.fenceSnapIndicator = null;
                }
            }
        }
    }

    function onFenceKeyDown(e) {
        if (!window.isFenceModeActive) return;
        
        if (e.key === 'Enter' && window.drawingVertices && window.drawingVertices.length >= 2) {
            // Finish open polyline
            e.preventDefault();
            window.finishingOpenFence = true;   // open polyline
            if (window.finalizeFence) {
                window.finalizeFence();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            stopFenceDrawing();
        }
    }

    function finalizeFence() {
        // Build coords for final fence
        let coords = window.drawingVertices.slice();
        if (window.closingFenceToStart) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (!window.isSamePoint(first, last)) coords.push(first);
        }

        // Create the final fence layer
        const fence = L.polyline(coords, { color: '#ffd700', weight: 3, opacity: 0.8 });
        if (window.drawnItems) {
            window.drawnItems.addLayer(fence);
        }
        window.currentShape = fence;

        // Clear realtime markers
        try {
            if (window.fenceRealtimeMarkers) {
                window.fenceRealtimeMarkers.forEach(m => { 
                    try { window.map.removeLayer(m); } catch(_){} 
                });
            }
        } catch(_) {}
        window.fenceRealtimeMarkers = [];
        if (window.fenceMouseDistanceMarker) { 
            try { window.map.removeLayer(window.fenceMouseDistanceMarker); } catch(_) {} 
            window.fenceMouseDistanceMarker = null; 
        }

        // Distance labels (final)
        addFenceDistanceLabels(fence);

        // Popup
        let totalLength = 0;
        for (let i = 0; i < coords.length - 1; i++) {
            totalLength += window.calculateDistanceInFeet(coords[i], coords[i+1]);
        }
        fence.bindPopup(`
            <strong>Fence</strong><br>
            Total Length: ${totalLength.toFixed(1)} ft<br>
            Segments: ${coords.length - 1}<br>
            ${window.closingFenceToStart ? '(Closed)' : '(Open-ended)'}<br>
            Double-click to edit | Use Undo to remove
        `);

        // Click handlers
        fence.on('click', function(){ 
            window.currentShape = fence; 
            if (window.updateSubmitButton) window.updateSubmitButton(); 
        });

        // Push to undo stack
        if (window.undoStack) {
            window.undoStack.push({ action: 'draw', shape: fence });
            if (window.updateUndoButton) window.updateUndoButton();
        }

        // Stop drawing and cleanup guides/markers
        stopFenceDrawing();
    }

    // ===== PUBLIC API =====
    if (typeof window !== 'undefined') {
        window.FenceTool = {
            // Drawing
            startFenceDrawing,
            stopFenceDrawing,
            onFenceMapClick,
            onFenceMouseMove,
            onFenceKeyDown,
            finalizeFence,
            
            // Labels
            addFenceDistanceLabels,
            clearFenceLabels,
            updateFenceLabels,
            
            // Editing
            enableFenceEditing,
            disableFenceEditing,
            
            // Utility
            startDraw: function() {
                startFenceDrawing();
            }
        };
        
        // Also expose the functions globally for backward compatibility
        window.startFenceDrawing = startFenceDrawing;
        window.stopFenceDrawing = stopFenceDrawing;
        window.onFenceMapClick = onFenceMapClick;
        window.onFenceMouseMove = onFenceMouseMove;
        window.onFenceKeyDown = onFenceKeyDown;
        window.finalizeFence = finalizeFence;
        window.addFenceDistanceLabels = addFenceDistanceLabels;
    }
})();
