/* Custom Drawing System - Inspired by Leaflet.Draw patterns */
(function(){
    
    // ===== DRAWING STATE =====
    let currentHandler = null;
    
    // ===== BASE HANDLER CLASS (Like Leaflet.Draw's L.Draw.Feature) =====
    class DrawHandler {
        constructor(map) {
            this.map = map;
            this._enabled = false;
            this._mouseMarker = null;
        }
        
        enable() {
            if (this._enabled) return;
            this._enabled = true;
            this.addHooks();
        }
        
        disable() {
            if (!this._enabled) return;
            this._enabled = false;
            this.removeHooks();
        }
        
        enabled() {
            return this._enabled;
        }
        
        addHooks() {
            // Override in subclass
        }
        
        removeHooks() {
            // Override in subclass
        }
    }
    
    // ===== RECTANGLE HANDLER =====
    class RectangleHandler extends DrawHandler {
        constructor(map) {
            super(map);
            this._shape = null;
            this._startLatLng = null;
            this._measurementMarkers = [];
            this._finalizing = false; // Guard to prevent late mousemove from recreating preview labels
        }
        
        addHooks() {
            if (window.DrawDebug) window.DrawDebug('RECT','addHooks');
            
            const map = this.map;
            
            if (map) {
                // Disable map dragging during draw
                map.dragging.disable();
                
                // Add crosshair cursor class
                L.DomUtil.addClass(map._container, 'leaflet-crosshair');
                
                // Disable double-click zoom to prevent conflicts
                if (map.doubleClickZoom) {
                    map.doubleClickZoom.disable();
                }
                
                // Focus map container for reliable keyboard events
                const container = map.getContainer();
                container.setAttribute('tabindex', '0');
                container.focus({preventScroll: true});
                
                // Bind events
                map
                    .on('mousedown', this._onMouseDown, this)
                    .on('mousemove', this._onMouseMove, this)
                    .on('mouseup', this._onMouseUp, this);
                
                // Listen for escape
                L.DomEvent.on(document, 'keydown', this._onKeyDown, this);
                
                console.log('✅ Rectangle handler: hooks added, crosshair cursor set');
                showNotification('Rectangle Mode: Click and drag to draw', 'success');
            }
        }
        
        removeHooks() {
            console.log('🔧 Rectangle handler: removing hooks');
            
            const map = this.map;
            
            if (map) {
                // Re-enable map dragging
                map.dragging.enable();
                
                // Remove crosshair cursor class
                L.DomUtil.removeClass(map._container, 'leaflet-crosshair');
                
                // Re-enable double-click zoom
                if (map.doubleClickZoom) {
                    map.doubleClickZoom.enable();
                }
                
                // Unbind events
                map
                    .off('mousedown', this._onMouseDown, this)
                    .off('mousemove', this._onMouseMove, this)
                    .off('mouseup', this._onMouseUp, this);
                
                L.DomEvent.off(document, 'keydown', this._onKeyDown, this);
                
                // Clean up shape
                this._cleanupDrawing();
            }
        }
        
        _onMouseDown(e) {
            if (window.DrawDebug) window.DrawDebug('RECT','mousedown', e.latlng);
            
            this._finalizing = false;
            this._startLatLng = e.latlng;
            
            // Disable map dragging to prevent conflicts
            this.map.dragging.disable();
            
            // Create the rectangle shape
            this._shape = L.rectangle([e.latlng, e.latlng], {
                color: '#3388ff',
                weight: 3,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.1,
                dashArray: '10, 5',
                interactive: false
            }).addTo(this.map);
            
            // Prevent click from propagating
            L.DomEvent.stop(e);
        }
        
        _onMouseMove(e) {
            if (this._finalizing || !this._startLatLng) return; // Not drawing or already finalizing
            
            // Update rectangle bounds
            const bounds = L.latLngBounds(this._startLatLng, e.latlng);
            this._shape.setBounds(bounds);
            
            // Update measurements
            this._updateMeasurements(bounds);
        }
        
        _onMouseUp(e) {
            if (!this._startLatLng) return;
            
            if (window.DrawDebug) window.DrawDebug('RECT','mouseup', e.latlng);
            
            const bounds = L.latLngBounds(this._startLatLng, e.latlng);
            
            // Check if rectangle is too small (accidental click)
            const size = this.map.latLngToLayerPoint(bounds.getNorthEast())
                .distanceTo(this.map.latLngToLayerPoint(bounds.getSouthWest()));
            
            if (size < 10) {
                if (window.DrawDebug) window.DrawDebug('RECT','too-small-cancel');
                this._cleanupDrawing();
                this._startLatLng = null;
                this.map.dragging.enable();
                return;
            }
            
            // Finish the rectangle
            this._finishShape(bounds);
            
            // Re-enable map dragging
            this.map.dragging.enable();
        }
        
        _onKeyDown(e) {
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();  // ✅ Prevent default Escape behavior
                console.log('Escape pressed - canceling rectangle');
                this._cleanupDrawing();
                this._startLatLng = null;
                this.map.dragging.enable();
                this.disable();  // Fully disable handler
                showNotification('Drawing canceled', 'info');
            }
        }
        
        _updateMeasurements(bounds) {
            // Remove old measurements
            this._measurementMarkers.forEach(m => this.map.removeLayer(m));
            this._measurementMarkers = [];
            
            // Calculate dimensions
            const dims = window.GeometryLib.calculateRectangleDimensions(bounds);
            
            // Add width label (top edge)
            const topCenter = L.latLng(
                bounds.getNorth(),
                (bounds.getWest() + bounds.getEast()) / 2
            );
            const widthMarker = window.GeometryLib.createMeasurementMarker(
                topCenter,
                window.GeometryLib.formatMeasurement(dims.width),
                'measurement-label measurement-width'
            ).addTo(this.map);
            this._measurementMarkers.push(widthMarker);
            
            // Add height label (right edge)
            const rightCenter = L.latLng(
                (bounds.getSouth() + bounds.getNorth()) / 2,
                bounds.getEast()
            );
            const heightMarker = window.GeometryLib.createMeasurementMarker(
                rightCenter,
                window.GeometryLib.formatMeasurement(dims.height),
                'measurement-label measurement-height'
            ).addTo(this.map);
            this._measurementMarkers.push(heightMarker);
            
            // Add area label (center)
            const center = bounds.getCenter();
            const areaMarker = window.GeometryLib.createMeasurementMarker(
                center,
                window.GeometryLib.formatMeasurement(dims.area, 'ft²'),
                'measurement-label measurement-area'
            ).addTo(this.map);
            this._measurementMarkers.push(areaMarker);
        }
        
        _finishShape(bounds) {
            if (window.DrawDebug) window.DrawDebug('RECT','finish');
            
            // Prevent any further preview updates immediately
            this._finalizing = true;
            this._startLatLng = null;

            // Remove preview shape
            if (this._shape) {
                this.map.removeLayer(this._shape);
                this._shape = null;
            }
            
            // Create final blue rectangle
            const finalRect = L.rectangle(bounds, {
                color: '#3388ff',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.2
            }).addTo(this.map);
            
            // Add to drawn items
            if (window.drawnItems) {
                window.drawnItems.addLayer(finalRect);
            }
            
            // Convert to polygon for consistency with existing system
            const poly = L.polygon([
                bounds.getSouthWest(),
                bounds.getSouthEast(),
                bounds.getNorthEast(),
                bounds.getNorthWest()
            ], {
                color: '#3388ff',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.2
            });
            
            // Replace rectangle with polygon
            this.map.removeLayer(finalRect);
            poly.addTo(this.map);
            if (window.drawnItems) {
                window.drawnItems.removeLayer(finalRect);
                window.drawnItems.addLayer(poly);
            }
            
            // ✅ Clean up any preview (yellow) markers BEFORE adding final (blue) ones
            this._measurementMarkers.forEach(m => this.map.removeLayer(m));
            this._measurementMarkers = [];

            // Add final measurements via rectangle label module
            if (window.RectangleLabels && window.RectangleLabels.addFinalLabels) {
                window.RectangleLabels.addFinalLabels(poly);
            }

            // Mark that this shape already has measurements (prevent duplicates)
            poly._hasMeasurements = true;
            
            // Fire shape created event (like Leaflet.Draw does)
            this.map.fire('draw:created', {
                layer: poly,
                layerType: 'rectangle',
                _fromCustomDrawing: true  // Flag to prevent duplicate measurements
            });
            
            // Disable handler (already cleaned up preview markers above)
            this.disable();
            this._finalizing = false;
            
            showNotification('Rectangle created successfully', 'success');
        }
        
        
        _cleanupDrawing() {
            if (this._shape) {
                this.map.removeLayer(this._shape);
                this._shape = null;
            }
            
            this._measurementMarkers.forEach(m => this.map.removeLayer(m));
            this._measurementMarkers = [];
        }
    }
    
    // ===== POLYGON HANDLER =====
    class PolygonHandler extends DrawHandler {
        constructor(map) {
            super(map);
            this._poly = null;
            this._markers = [];
            this._measurementMarkers = [];
            this._latlngs = [];
            this._mouseMarker = null;
            this._tooltip = null;
        }
        
        addHooks() {
            if (window.DrawDebug) window.DrawDebug('POLY','addHooks');
            
            const map = this.map;
            
            if (map) {
                // Add crosshair cursor class
                L.DomUtil.addClass(map._container, 'leaflet-crosshair');
                
                // Disable double-click zoom to prevent conflicts
                if (map.doubleClickZoom) {
                    map.doubleClickZoom.disable();
                }
                
                // Focus map container for reliable keyboard events
                const container = map.getContainer();
                container.setAttribute('tabindex', '0');
                container.focus({preventScroll: true});
                
                // Bind events
                map
                    .on('click', this._onClick, this)
                    .on('mousemove', this._onMouseMove, this);
                
                // Listen for escape and enter
                L.DomEvent.on(document, 'keydown', this._onKeyDown, this);
                
                console.log('✅ Polygon handler: hooks added, crosshair cursor set');
                showNotification('Polygon Mode: Click to add points, snap to first or press Enter to finish', 'success');
            }
        }
        
        removeHooks() {
            console.log('🔧 Polygon handler: removing hooks');
            
            const map = this.map;
            
            if (map) {
                // Remove crosshair cursor class
                L.DomUtil.removeClass(map._container, 'leaflet-crosshair');
                
                // Re-enable double-click zoom
                if (map.doubleClickZoom) {
                    map.doubleClickZoom.enable();
                }
                
                // Unbind events
                map
                    .off('click', this._onClick, this)
                    .off('mousemove', this._onMouseMove, this);
                
                L.DomEvent.off(document, 'keydown', this._onKeyDown, this);
                
                // Clean up
                this._cleanupDrawing();
            }
        }
        
        _onClick(e) {
            const latlng = e.latlng;
            
            console.log('🔧 Polygon click:', latlng, 'Total points:', this._latlngs.length + 1);
            
            // Check if clicking near first point (snap to close)
            if (this._latlngs.length >= 3) {
                const firstPoint = this._latlngs[0];
                const distance = this.map.distance(latlng, firstPoint);
                const snapDistance = 20 * (40075017 / Math.pow(2, this.map.getZoom() + 8));
                
                if (distance < snapDistance) {
                    console.log('🔧 Snapping to first vertex - closing polygon');
                    this._finishShape();
                    return;
                }
            }
            
            // Add vertex
            this._latlngs.push(latlng);
            
            // Add vertex marker
            const marker = L.circleMarker(latlng, {
                radius: 5,
                color: '#ffd700',
                fillColor: '#ffd700',
                fillOpacity: 0.8
            }).addTo(this.map);
            this._markers.push(marker);
            
            // Add distance measurement from previous vertex
            if (this._latlngs.length > 1) {
                const prevPoint = this._latlngs[this._latlngs.length - 2];
                const distance = window.GeometryLib.calculateDistance(prevPoint, latlng);
                const midpoint = window.GeometryLib.calculateMidpoint(prevPoint, latlng);
                
                const distMarker = window.GeometryLib.createMeasurementMarker(
                    midpoint,
                    window.GeometryLib.formatMeasurement(distance),
                    'measurement-label measurement-segment'
                ).addTo(this.map);
                this._measurementMarkers.push(distMarker);
            }
            
            // Update polygon preview
            this._updatePoly();
            
            // Update notification
            if (this._latlngs.length >= 3) {
                showNotification(`${this._latlngs.length} points - snap to first or press Enter to finish`, 'info');
            } else {
                showNotification(`${this._latlngs.length} points - need at least 3 to finish`, 'info');
            }
            
            // Prevent click from propagating
            L.DomEvent.stop(e);
        }
        
        _onMouseMove(e) {
            const latlng = e.latlng;
            
            // Update polygon preview with mouse position
            this._updatePoly(latlng);
            
            // Show live measurement for current segment
            this._updateLiveSegmentMeasurement(latlng);
            
            // Check if near first vertex for snap indicator
            if (this._latlngs.length >= 3) {
                const firstPoint = this._latlngs[0];
                const distance = this.map.distance(latlng, firstPoint);
                const snapDistance = 20 * (40075017 / Math.pow(2, this.map.getZoom() + 8));
                
                if (distance < snapDistance) {
                    // Show snap indicator
                    if (!this._snapIndicator) {
                        this._snapIndicator = L.circleMarker(firstPoint, {
                            radius: 8,
                            color: '#00ff00',
                            fillColor: '#00ff00',
                            fillOpacity: 0.5,
                            weight: 3
                        }).addTo(this.map);
                    }
                } else {
                    // Remove snap indicator
                    if (this._snapIndicator) {
                        this.map.removeLayer(this._snapIndicator);
                        this._snapIndicator = null;
                    }
                }
            }
        }
        
        _updateLiveSegmentMeasurement(mousePos) {
            // Remove old live measurement
            if (this._liveSegmentMarker) {
                this.map.removeLayer(this._liveSegmentMarker);
                this._liveSegmentMarker = null;
            }
            
            // Show live measurement from last vertex to mouse
            if (this._latlngs.length > 0) {
                const lastPoint = this._latlngs[this._latlngs.length - 1];
                const distance = window.GeometryLib.calculateDistance(lastPoint, mousePos);
                const midpoint = window.GeometryLib.calculateMidpoint(lastPoint, mousePos);
                
                this._liveSegmentMarker = window.GeometryLib.createMeasurementMarker(
                    midpoint,
                    window.GeometryLib.formatMeasurement(distance),
                    'measurement-label measurement-segment'
                ).addTo(this.map);
            }
        }
        
        _onKeyDown(e) {
            if ((e.key === 'Enter' || e.keyCode === 13) && this._latlngs.length >= 3) {
                e.preventDefault();  // ✅ Prevent default Enter behavior
                console.log('Enter pressed - finishing polygon');
                this._finishShape();
            } else if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();  // ✅ Prevent default Escape behavior
                console.log('Escape pressed - canceling polygon');
                this._cleanupDrawing();
                this.disable();
                showNotification('Drawing canceled', 'info');
            }
        }
        
        _updatePoly(mousePos) {
            if (this._latlngs.length === 0) return;
            
            // Create latlngs array with mouse position
            let latlngs = [...this._latlngs];
            if (mousePos) {
                latlngs.push(mousePos);
            }
            
            // Update or create polygon preview
            if (!this._poly) {
                this._poly = L.polygon(latlngs, {
                    color: '#3388ff',
                    weight: 3,
                    opacity: 0.8,
                    fillColor: '#3388ff',
                    fillOpacity: 0.1,
                    dashArray: '10, 5',
                    interactive: false
                }).addTo(this.map);
            } else {
                this._poly.setLatLngs(latlngs);
            }
        }
        
        _finishShape() {
            if (this._latlngs.length < 3) {
                showNotification('Need at least 3 points to create a polygon', 'error');
                return;
            }
            
            if (window.DrawDebug) window.DrawDebug('POLY','finish', {points: this._latlngs.length});
            
            // Remove preview
            if (this._poly) {
                this.map.removeLayer(this._poly);
                this._poly = null;
            }
            
            // Create final blue polygon
            const finalPoly = L.polygon(this._latlngs, {
                color: '#3388ff',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.2
            }).addTo(this.map);
            
            // Add to drawn items
            if (window.drawnItems) {
                window.drawnItems.addLayer(finalPoly);
            }
            
            // Create final labels via polygon label module
            if (window.PolygonLabels && window.PolygonLabels.addFinalLabels) {
                window.PolygonLabels.addFinalLabels(finalPoly);
            }
            
            // Mark that this shape already has measurements (prevent duplicates)
            finalPoly._hasMeasurements = true;
            
            // Fire shape created event (like Leaflet.Draw does)
            this.map.fire('draw:created', {
                layer: finalPoly,
                layerType: 'polygon',
                _fromCustomDrawing: true  // Flag to prevent duplicate measurements
            });
            
            // Clean up and disable (will remove temporary preview/markers but keep final labels above)
            this._cleanupDrawing();
            this.disable();
            
            showNotification('Polygon created successfully', 'success');
        }
        
        _cleanupDrawing() {
            if (this._poly) {
                this.map.removeLayer(this._poly);
                this._poly = null;
            }
            
            if (this._snapIndicator) {
                this.map.removeLayer(this._snapIndicator);
                this._snapIndicator = null;
            }
            
            if (this._liveSegmentMarker) {
                this.map.removeLayer(this._liveSegmentMarker);
                this._liveSegmentMarker = null;
            }
            
            this._markers.forEach(m => this.map.removeLayer(m));
            this._markers = [];
            
            this._measurementMarkers.forEach(m => this.map.removeLayer(m));
            this._measurementMarkers = [];
            
            this._latlngs = [];
        }
    }

    // Labels helper moved to src/tool/polygon/labels.js
    
    // ===== PUBLIC API =====
    function startRectangleDrawing() {
        console.log('🔧 Starting rectangle drawing (Leaflet.Draw pattern)');
        
        if (!window.map) {
            console.error('Map not available');
            return;
        }
        
        // Stop any existing handler
        if (currentHandler) {
            currentHandler.disable();
        }
        
        // Create and enable rectangle handler
        currentHandler = new RectangleHandler(window.map);
        currentHandler.enable();
    }
    
    function startPolygonDrawing() {
        console.log('🔧 Starting polygon drawing (Leaflet.Draw pattern)');
        
        if (!window.map) {
            console.error('Map not available');
            return;
        }
        
        // Stop any existing handler
        if (currentHandler) {
            currentHandler.disable();
        }
        
        // Create and enable polygon handler
        currentHandler = new PolygonHandler(window.map);
        currentHandler.enable();
    }
    
    function stopDrawing() {
        console.log('🔧 Stopping drawing (Leaflet.Draw pattern)');
        
        if (currentHandler) {
            currentHandler.disable();
            currentHandler = null;
        }
        
        // Reset cursor
        if (window.map && window.map._container) {
            L.DomUtil.removeClass(window.map._container, 'leaflet-crosshair');
        }
    }
    
    function isDrawing() {
        return currentHandler && currentHandler.enabled();
    }
    
    function getCurrentMode() {
        if (!currentHandler) return null;
        if (currentHandler instanceof RectangleHandler) return 'rectangle';
        if (currentHandler instanceof PolygonHandler) return 'polygon';
        return null;
    }
    
    // Helper for notifications
    function showNotification(message, type = 'info') {
        if (window.showNotification && typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
    
    // ===== INITIALIZATION =====
    function initializeCustomDrawingV2() {
        console.log('🔧 Initializing custom drawing v2 (Leaflet.Draw patterns)...');
        
        window.CustomDrawing = {
            startRectangleDrawing,
            startPolygonDrawing,
            stopDrawing,
            isDrawing,
            getCurrentMode
        };
        
        console.log('✅ Custom drawing v2 initialized');
    }
    
    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCustomDrawingV2);
    } else {
        initializeCustomDrawingV2();
    }
    
})();

