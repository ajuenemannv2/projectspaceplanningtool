/* Fence Drawing Session - Complete state management */
(function(){
    
    class FenceDrawSession {
        constructor(map, options = {}) {
            this.map = map;
            this.options = {
                color: '#ffd700',
                weight: 3,
                opacity: 0.8,
                snapTolerance: 8,  // pixels
                ...options
            };
            
            // State
            this.active = false;
            this.vertices = [];
            this.previewLine = null;
            this.mouseGuideLine = null;
            this.mouseMarker = null;
            this.measurementUI = null;
            this.snapIndicator = null;  // ✅ Green circle when hovering near first vertex
            
            // Callbacks
            this.onComplete = options.onComplete || null;
            this.onCancel = options.onCancel || null;
            
            // Bound methods for event cleanup
            this._boundHandlers = {
                click: this._onClick.bind(this),
                mousemove: this._onMouseMove.bind(this),
                keydown: this._onKeyDown.bind(this)
            };
        }
        
        /**
         * Start the drawing session
         */
        start() {
            if (this.active) {
                console.warn('Drawing session already active');
                return;
            }
            
            if (window.DrawDebug) window.DrawDebug('FENCE','start');
            
            this.active = true;
            this.vertices = [];
            
            // Create measurement manager
            this.measurementUI = new window.MeasurementUI(this.map);
            
            // Create preview line
            this.previewLine = L.polyline([], {
                color: this.options.color,
                weight: this.options.weight,
                opacity: this.options.opacity,
                interactive: false
            }).addTo(this.map);
            
            // Create mouse marker and guide line
            this.mouseMarker = L.circleMarker([0, 0], {
                radius: 4,
                color: this.options.color,
                fillColor: this.options.color,
                fillOpacity: 0.8,
                weight: 2,
                interactive: false
            }).addTo(this.map);
            
            this.mouseGuideLine = L.polyline([], {
                color: this.options.color,
                weight: 2,
                dashArray: '5,5',
                opacity: 0.8,
                interactive: false
            }).addTo(this.map);
            
            // Set up map interaction
            this._setupMapInteraction();
            
            // Attach event listeners
            this.map.on('click', this._boundHandlers.click);
            this.map.on('mousemove', this._boundHandlers.mousemove);
            document.addEventListener('keydown', this._boundHandlers.keydown);
            
            // Notify user
            if (window.showNotification) {
                window.showNotification('Fence Mode: Click to add points, snap to first or press Enter to finish', 'success');
            }
        }
        
        /**
         * Add a vertex to the fence
         * @param {L.LatLng} latlng - Vertex position
         */
        addVertex(latlng) {
            this.vertices.push(latlng);
            
            // Update preview line
            this.previewLine.setLatLngs(this.vertices);
            
            // Add vertex marker
            this.measurementUI.addVertexMarker(latlng);
            
            // Add distance label from previous vertex
            if (this.vertices.length >= 2) {
                const prevVertex = this.vertices[this.vertices.length - 2];
                const distance = this._calculateDistance(prevVertex, latlng);
                this.measurementUI.addFinalSegmentLabel(prevVertex, latlng, distance);
            }
            
            if (window.DrawDebug) window.DrawDebug('FENCE','vertex', {count: this.vertices.length});
        }
        
        /**
         * Finish the fence (closed or open)
         * @param {boolean} closed - Whether to close the fence back to start
         */
        finish(closed = false) {
            if (this.vertices.length < 2) {
                if (window.showNotification) {
                    window.showNotification('Need at least 2 points to create a fence', 'error');
                }
                return;
            }
            
            if (window.DrawDebug) window.DrawDebug('FENCE','finish', {count: this.vertices.length, closed});
            
            // Build final coordinates
            let coords = [...this.vertices];
            if (closed) {
                const first = coords[0];
                const last = coords[coords.length - 1];
                // Only add first point if it's not already the last point
                if (!this._isSamePoint(first, last)) {
                    coords.push(first);
                    
                    // ✅ FIX: Add final closing segment label
                    const closingDistance = this._calculateDistance(last, first);
                    this.measurementUI.addFinalSegmentLabel(last, first, closingDistance);
                }
            }
            
            // Create final fence layer and ADD TO MAP IMMEDIATELY
            const fence = L.polyline(coords, {
                color: this.options.color,
                weight: this.options.weight,
                opacity: this.options.opacity
            }).addTo(this.map);  // ✅ ADD TO MAP NOW - don't wait for callback!
            
            // Calculate total length
            let totalLength = 0;
            for (let i = 0; i < coords.length - 1; i++) {
                totalLength += this._calculateDistance(coords[i], coords[i + 1]);
            }
            
            // Add popup with stats
            fence.bindPopup(`
                <strong>Fence</strong><br>
                Total Length: ${totalLength.toFixed(1)} ft<br>
                Segments: ${coords.length - 1}<br>
                ${closed ? '(Closed)' : '(Open-ended)'}<br>
                <small>Double-click to edit | Use Undo to remove</small>
            `);
            
            // ✅ KEEP the final segment labels - transfer them to result
            const finalLabels = this.measurementUI ? [...this.measurementUI.finalLabels] : [];
            
            // ✅ CRITICAL: Dispose session BEFORE callback
            // This removes temporary stuff (preview, markers) but leaves fence & labels
            this.dispose();
            
            // Fire completion callback AFTER disposing (fence already on map)
            if (this.onComplete) {
                this.onComplete({
                    layer: fence,
                    vertices: coords,
                    closed: closed,
                    totalLength: totalLength,
                    measurementLabels: finalLabels  // ✅ Pass labels to parent
                });
            }
            
            if (window.showNotification) {
                window.showNotification(`Fence created: ${totalLength.toFixed(1)} ft total`, 'success');
            }
        }
        
        /**
         * Cancel the drawing session
         */
        cancel() {
            if (window.DrawDebug) window.DrawDebug('FENCE','cancel');
            
            if (this.onCancel) {
                this.onCancel();
            }
            
            this.dispose();
            
            if (window.showNotification) {
                window.showNotification('Fence drawing canceled', 'info');
            }
        }
        
        /**
         * Dispose and clean up all resources (ONLY temporary drawing elements)
         */
        dispose() {
            if (!this.active) return;
            
            if (window.DrawDebug) window.DrawDebug('FENCE','dispose');
            
            this.active = false;
            
            // Remove event listeners
            this.map.off('click', this._boundHandlers.click);
            this.map.off('mousemove', this._boundHandlers.mousemove);
            document.removeEventListener('keydown', this._boundHandlers.keydown);
            
            // Clean up TEMPORARY layers (preview, guides, live labels)
            if (this.previewLine) {
                this.map.removeLayer(this.previewLine);
                this.previewLine = null;
            }
            
            if (this.mouseMarker) {
                this.map.removeLayer(this.mouseMarker);
                this.mouseMarker = null;
            }
            
            if (this.mouseGuideLine) {
                this.map.removeLayer(this.mouseGuideLine);
                this.mouseGuideLine = null;
            }
            
            // ✅ Clean up snap indicator
            if (this.snapIndicator) {
                this.map.removeLayer(this.snapIndicator);
                this.snapIndicator = null;
            }
            
            // ✅ CRITICAL: Only clean up TEMPORARY measurements (live labels, vertex markers)
            // DO NOT remove final labels - they stay with the finished shape!
            if (this.measurementUI) {
                // Only clear live segment label and vertex markers (temporary)
                this.measurementUI.clearLiveSegmentLabel();
                this.measurementUI.clearVertexMarkers();
                // DO NOT call clearFinalLabels() - those stay on the map!
                this.measurementUI = null;
            }
            
            // Restore map interaction
            this._restoreMapInteraction();
            
            // Clear vertices
            this.vertices = [];
        }
        
        /**
         * Set up map for drawing (disable zoom, focus for keyboard, etc.)
         * @private
         */
        _setupMapInteraction() {
            const container = this.map.getContainer();
            
            // Add crosshair cursor
            container.classList.add('drawing-mode');
            
            // Focus for keyboard events
            container.setAttribute('tabindex', '0');
            container.focus({ preventScroll: true });
            
            // Disable double-click zoom
            if (this.map.doubleClickZoom) {
                this.map.doubleClickZoom.disable();
            }
        }
        
        /**
         * Restore map to normal state
         * @private
         */
        _restoreMapInteraction() {
            const container = this.map.getContainer();
            
            // Remove crosshair cursor
            container.classList.remove('drawing-mode');
            
            // Re-enable double-click zoom
            if (this.map.doubleClickZoom) {
                this.map.doubleClickZoom.enable();
            }
        }
        
        /**
         * Handle map click
         * @private
         */
        _onClick(e) {
            const latlng = e.latlng;
            
            // Check if clicking near first vertex (snap to close)
            if (this.vertices.length >= 2 && this._isNearFirstVertex(latlng)) {
                this.finish(true);  // Close the fence
                return;
            }
            
            // Otherwise add vertex
            this.addVertex(latlng);
        }
        
        /**
         * Handle mouse move
         * @private
         */
        _onMouseMove(e) {
            const latlng = e.latlng;
            
            // Update mouse marker position
            if (this.mouseMarker) {
                this.mouseMarker.setLatLng(latlng);
            }
            
            // ✅ Check if near first vertex for snap indicator (like polygon tool)
            if (this.vertices.length >= 2 && this._isNearFirstVertex(latlng)) {
                // Show green snap indicator
                if (!this.snapIndicator) {
                    this.snapIndicator = L.circleMarker(this.vertices[0], {
                        radius: 8,
                        color: '#00ff00',
                        fillColor: '#00ff00',
                        fillOpacity: 0.5,
                        weight: 3,
                        interactive: false
                    }).addTo(this.map);
                }
            } else {
                // Remove snap indicator
                if (this.snapIndicator) {
                    this.map.removeLayer(this.snapIndicator);
                    this.snapIndicator = null;
                }
            }
            
            // Update guide line from last vertex to mouse
            if (this.vertices.length > 0 && this.mouseGuideLine) {
                const lastVertex = this.vertices[this.vertices.length - 1];
                this.mouseGuideLine.setLatLngs([lastVertex, latlng]);
                
                // Update live distance label
                const distance = this._calculateDistance(lastVertex, latlng);
                this.measurementUI.updateLiveSegmentLabel(
                    lastVertex,
                    latlng,
                    `${distance.toFixed(1)} ft`
                );
            }
        }
        
        /**
         * Handle keyboard events
         * @private
         */
        _onKeyDown(e) {
            if (e.key === 'Enter' && this.vertices.length >= 2) {
                e.preventDefault();
                this.finish(false);  // Finish open
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancel();
            }
        }
        
        /**
         * Check if latlng is near first vertex (within pixel tolerance)
         * @private
         */
        _isNearFirstVertex(latlng) {
            if (this.vertices.length === 0) return false;
            
            const first = this.vertices[0];
            const pA = this.map.latLngToContainerPoint(first);
            const pB = this.map.latLngToContainerPoint(latlng);
            
            const dx = pA.x - pB.x;
            const dy = pA.y - pB.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            return distance <= this.options.snapTolerance;
        }
        
        /**
         * Check if two points are the same (within tolerance)
         * @private
         */
        _isSamePoint(a, b) {
            if (!a || !b) return false;
            return Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;
        }
        
        /**
         * Calculate distance in feet between two points
         * @private
         */
        _calculateDistance(latlng1, latlng2) {
            const distanceMeters = this.map.distance(latlng1, latlng2);
            return distanceMeters * 3.28084;  // Convert to feet
        }
    }
    
    // ===== PUBLIC API =====
    if (typeof window !== 'undefined') {
        window.FenceDrawSession = FenceDrawSession;
    }
    
    console.log('✅ FenceDrawSession class initialized');
    
})();
