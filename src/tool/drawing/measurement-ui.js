/* Measurement UI Module - Centralized label management */
(function(){
    
    // ===== MEASUREMENT LABEL MANAGER =====
    class MeasurementManager {
        constructor(map) {
            this.map = map;
            this.liveSegmentLabel = null;
            this.finalLabels = [];
            this.vertexMarkers = [];
        }
        
        /**
         * Show live measurement label that follows the mouse
         * @param {L.LatLng} startPoint - Start point of segment
         * @param {L.LatLng} endPoint - End point (mouse position)
         * @param {string} text - Measurement text (e.g., "45.2 ft")
         */
        updateLiveSegmentLabel(startPoint, endPoint, text) {
            const midpoint = this._calculateMidpoint(startPoint, endPoint);
            
            if (!this.liveSegmentLabel) {
                // Create once
                this.liveSegmentLabel = L.marker(midpoint, {
                    icon: this._createLabelIcon(text, 'measurement-label measurement-segment'),
                    interactive: false
                }).addTo(this.map);
            } else {
                // Update position and content
                this.liveSegmentLabel.setLatLng(midpoint);
                this.liveSegmentLabel.setIcon(this._createLabelIcon(text, 'measurement-label measurement-segment'));
            }
        }
        
        /**
         * Clear the live segment label
         */
        clearLiveSegmentLabel() {
            if (this.liveSegmentLabel) {
                this.map.removeLayer(this.liveSegmentLabel);
                this.liveSegmentLabel = null;
            }
        }
        
        /**
         * Add a final segment label (after vertex is placed)
         * @param {L.LatLng} startPoint - Start point of segment
         * @param {L.LatLng} endPoint - End point of segment
         * @param {number} distance - Distance in feet
         */
        addFinalSegmentLabel(startPoint, endPoint, distance) {
            // Guard against 0 ft artifacts
            if (distance < 0.5) {
                console.log('Skipping label for distance < 0.5 ft');
                return;
            }
            
            const midpoint = this._calculateMidpoint(startPoint, endPoint);
            const text = `${distance.toFixed(1)} ft`;
            
            const marker = L.marker(midpoint, {
                icon: this._createLabelIcon(text, 'measurement-label-final measurement-segment'),
                interactive: false
            }).addTo(this.map);
            
            this.finalLabels.push(marker);
            return marker;
        }
        
        /**
         * Add vertex marker
         * @param {L.LatLng} latlng - Vertex position
         * @param {object} options - Marker options
         */
        addVertexMarker(latlng, options = {}) {
            const defaultOptions = {
                radius: 5,
                color: '#ffd700',
                fillColor: '#ffd700',
                fillOpacity: 0.8,
                interactive: false
            };
            
            const marker = L.circleMarker(latlng, { ...defaultOptions, ...options }).addTo(this.map);
            this.vertexMarkers.push(marker);
            return marker;
        }
        
        /**
         * Add area label at center
         * @param {L.LatLng} center - Center position
         * @param {number} area - Area in square feet
         */
        addAreaLabel(center, area) {
            const text = `${area.toFixed(1)} ft²`;
            
            const marker = L.marker(center, {
                icon: this._createLabelIcon(text, 'measurement-label-final measurement-area'),
                interactive: false
            }).addTo(this.map);
            
            this.finalLabels.push(marker);
            return marker;
        }
        
        /**
         * Clear all final labels (but keep live label)
         */
        clearFinalLabels() {
            this.finalLabels.forEach(label => {
                try {
                    this.map.removeLayer(label);
                } catch(e) {}
            });
            this.finalLabels = [];
        }
        
        /**
         * Clear all vertex markers
         */
        clearVertexMarkers() {
            this.vertexMarkers.forEach(marker => {
                try {
                    this.map.removeLayer(marker);
                } catch(e) {}
            });
            this.vertexMarkers = [];
        }
        
        /**
         * Clear everything and reset
         */
        dispose() {
            this.clearLiveSegmentLabel();
            this.clearFinalLabels();
            this.clearVertexMarkers();
        }
        
        /**
         * Create a styled label icon
         * @private
         */
        _createLabelIcon(text, className = 'measurement-label') {
            return L.divIcon({
                className: 'distance-label',
                html: `<div class="${className}">${text}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });
        }
        
        /**
         * Calculate midpoint between two points
         * @private
         */
        _calculateMidpoint(p1, p2) {
            return L.latLng(
                (p1.lat + p2.lat) / 2,
                (p1.lng + p2.lng) / 2
            );
        }
    }
    
    // ===== PUBLIC API =====
    if (typeof window !== 'undefined') {
        window.MeasurementUI = MeasurementManager;
    }
    
    console.log('✅ MeasurementUI module initialized');
    
})();



