/* Geometry Library - Reusable functions for measurements and calculations */
(function(){
    
    // Calculate distance between two lat/lng points in feet
    function calculateDistance(latlng1, latlng2) {
        if (!latlng1 || !latlng2) return 0;
        
        // Use Leaflet's distance method (returns meters)
        const meters = window.map.distance(latlng1, latlng2);
        
        // Convert meters to feet
        const feet = meters * 3.28084;
        
        return feet;
    }
    
    // Calculate area of a polygon in square feet
    function calculatePolygonArea(latlngs) {
        if (!latlngs || latlngs.length < 3) return 0;
        
        try {
            // Use Leaflet's geodesic area calculation if available
            if (L.GeometryUtil && L.GeometryUtil.geodesicArea) {
                const squareMeters = L.GeometryUtil.geodesicArea(latlngs);
                const squareFeet = squareMeters * 10.7639; // Convert to square feet
                return squareFeet;
            }
        } catch (error) {
            console.warn('Leaflet GeometryUtil not available, using fallback');
        }
        
        // Fallback calculation
        return latlngs.length * 100; // Rough estimate
    }
    
    // Calculate rectangle dimensions in feet
    function calculateRectangleDimensions(bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const nw = L.latLng(ne.lat, sw.lng);
        const se = L.latLng(sw.lat, ne.lng);
        
        const width = calculateDistance(sw, se);
        const height = calculateDistance(sw, nw);
        const area = width * height;
        
        return { width, height, area };
    }
    
    // Format measurement for display
    function formatMeasurement(value, unit = 'ft') {
        if (value < 0.1) return `< 0.1 ${unit}`;
        if (value < 10) return `${value.toFixed(1)} ${unit}`;
        return `${Math.round(value)} ${unit}`;
    }
    
    // Create measurement marker
    function createMeasurementMarker(latlng, text, className = 'measurement-label') {
        return L.marker(latlng, {
            icon: L.divIcon({
                className: 'measurement-marker',
                html: `<div class="${className}">${text}</div>`,
                iconSize: [80, 20],
                iconAnchor: [40, 10]
            })
        });
    }
    
    // Calculate midpoint between two lat/lng points
    function calculateMidpoint(latlng1, latlng2) {
        return L.latLng(
            (latlng1.lat + latlng2.lat) / 2,
            (latlng1.lng + latlng2.lng) / 2
        );
    }
    
    // Get the center of a bounds object
    function getBoundsCenter(bounds) {
        return bounds.getCenter();
    }
    
    // Calculate bearing between two points in radians
    function bearingRad(from, to) {
        const lat1 = from.lat * Math.PI / 180;
        const lat2 = to.lat * Math.PI / 180;
        const deltaLng = (to.lng - from.lng) * Math.PI / 180;
        
        const y = Math.sin(deltaLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
        
        let bearing = Math.atan2(y, x);
        return bearing;
    }
    
    // Calculate bearing between two points in whole degrees
    function wholeDegreeBearing(from, to) {
        const bearing = bearingRad(from, to);
        const degrees = (bearing * 180 / Math.PI + 360) % 360;
        return Math.round(degrees);
    }
    
    // Convert degrees to radians
    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }
    
    // Convert radians to degrees
    function radToDeg(radians) {
        return radians * 180 / Math.PI;
    }
    
    // Export geometry library
    window.GeometryLib = {
        calculateDistance,
        calculatePolygonArea,
        calculateRectangleDimensions,
        formatMeasurement,
        createMeasurementMarker,
        calculateMidpoint,
        getBoundsCenter,
        bearingRad,
        wholeDegreeBearing,
        degToRad,
        radToDeg
    };
    
    // Also expose functions globally for backward compatibility
    window.bearingRad = bearingRad;
    window.wholeDegreeBearing = wholeDegreeBearing;
    window.degToRad = degToRad;
    window.radToDeg = radToDeg;
    
    console.log('✅ Geometry library initialized');
    console.log('🔧 Global functions exposed:', {
        bearingRad: typeof window.bearingRad,
        wholeDegreeBearing: typeof window.wholeDegreeBearing,
        degToRad: typeof window.degToRad,
        radToDeg: typeof window.radToDeg
    });
    
})();


