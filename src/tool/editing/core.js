/* Custom Editing Core System - Construction Planning Focused */
(function(){
    let editMode = {
        active: false,
        shape: null,
        type: null,
        tools: [],
        components: [],
        snapSettings: {},
        originalState: null,
        disabledSystems: {},
        handles: []
    };
    
    // Shape type detection
    function detectShapeType(shape) {
        // Check for custom properties first
        if (shape && shape._isCraneShape) return 'crane';
        if (shape && shape._isFenceShape) return 'fence';
        if (shape && shape._isRectangleShape) return 'rectangle';

        // Check geometry type
        if (typeof L !== 'undefined') {
            if (shape instanceof L.Rectangle) return 'rectangle';
            if (shape instanceof L.Polygon) return 'polygon';
            if (shape instanceof L.Polyline) return 'fence';
            // L.GeoJSON is a layer group; treat cranes specially
            if (L.GeoJSON && shape instanceof L.GeoJSON) {
                return shape._isCraneShape ? 'crane' : 'polygon';
            }
            if (L.LayerGroup && shape instanceof L.LayerGroup) {
                return shape._isCraneShape ? 'crane' : 'polygon';
            }
        }

        // Fallback
        return 'polygon';
    }
    
    // Capabilities detection
    function getShapeCapabilities(shapeType) {
        const capabilities = {
            rectangle: {
                tools: ['corner', 'edge', 'rotate', 'move'],
                measurements: ['area', 'perimeter', 'dimensions'],
                components: ['labels', 'watermarks', 'measurements'],
                snap: ['grid', 'shapes', 'measurements']
            },
            polygon: {
                tools: ['vertex', 'edge', 'addVertex', 'removeVertex'],
                measurements: ['area', 'perimeter'],
                components: ['labels', 'watermarks', 'measurements'],
                snap: ['grid', 'shapes', 'measurements']
            },
            fence: {
                tools: ['segment', 'addGate', 'removeGate', 'height'],
                measurements: ['length', 'segments'],
                components: ['labels', 'measurements'],
                snap: ['grid', 'shapes', 'perpendicular']
            },
            crane: {
                tools: ['pad', 'radius', 'sweep', 'position'],
                measurements: ['area', 'radius', 'sweep', 'capacity'],
                components: ['labels', 'measurements', 'capacity'],
                snap: ['grid', 'shapes', 'measurements']
            }
        };
        
        return capabilities[shapeType] || capabilities.polygon;
    }
    
    // Capture shape state
    function captureShapeState(shape) {
        // Safely resolve bounds for both single layers and grouped GeoJSON
        let bounds = null;
        if (shape && typeof shape.getBounds === 'function') {
            bounds = shape.getBounds();
        } else if (shape && typeof shape.eachLayer === 'function' && typeof L !== 'undefined') {
            try {
                const fg = L.featureGroup();
                shape.eachLayer(l => { try { fg.addLayer(l); } catch(_) {} });
                bounds = fg.getBounds();
            } catch(_) {}
        }

        // Safely resolve latLngs
        let latLngs = null;
        if (shape && typeof shape.getLatLngs === 'function') {
            latLngs = shape.getLatLngs();
        } else if (shape && typeof shape.eachLayer === 'function') {
            const collected = [];
            try {
                shape.eachLayer(l => {
                    if (l && typeof l.getLatLngs === 'function') {
                        collected.push(l.getLatLngs());
                    }
                });
            } catch(_) {}
            latLngs = collected;
        }

        return {
            bounds: bounds,
            latLngs: latLngs,
            popup: (shape && shape.getPopup && shape.getPopup()) ? (shape.getPopup().getContent ? shape.getPopup().getContent() : null) : null,
            style: shape && shape.options ? { ...shape.options } : {},
            customProperties: {
                _isCraneShape: !!(shape && shape._isCraneShape),
                _isFenceShape: !!(shape && shape._isFenceShape),
                _isRectangleShape: !!(shape && shape._isRectangleShape),
                _spaceData: shape && shape._spaceData ? shape._spaceData : null,
                _spaceId: shape && shape._spaceId ? shape._spaceId : null
            }
        };
    }
    
    // Disable conflicting systems
    function disableConflictingSystems(shape) {
        const disabledSystems = {};
        
        // Disable Leaflet edit mode
        try {
            const editHandler = window.map?._drawControl?._toolbars?.edit?._modes?.edit?.handler;
            if (editHandler && editHandler._enabled) {
                editHandler.disable();
                disabledSystems.leafletEdit = true;
            }
        } catch(_) {}
        
        // Disable rotation system
        if (shape._rotationHandle) {
            try {
                if (window.disablePolygonRotation) {
                    window.disablePolygonRotation(shape);
                }
                disabledSystems.rotation = true;
            } catch(_) {}
        }
        
        // Disable rectangle scale mode
        if (shape._rectScaleActive) {
            try {
                if (window.disableRectScaleMode) {
                    window.disableRectScaleMode(shape);
                }
                disabledSystems.rectangleScale = true;
            } catch(_) {}
        }
        
        // Disable fence mode
        if (window.isFenceModeActive) {
            try {
                window.isFenceModeActive = false;
                if (window.cleanupDrawingState) {
                    window.cleanupDrawingState();
                }
                disabledSystems.fenceMode = true;
            } catch(_) {}
        }
        
        // Disable crane mode
        if (window.isCraneModeActive) {
            try {
                if (window.stopCraneDrawing) {
                    window.stopCraneDrawing();
                }
                disabledSystems.craneMode = true;
            } catch(_) {}
        }
        
        // Disable drawing controls
        if (window.disableDrawingControls) {
            window.disableDrawingControls();
        }
        
        return disabledSystems;
    }
    
    // Preserve all components
    function preserveAllComponents(shape) {
        const shapeId = shape._leaflet_id;
        
        const components = {
            // Distance labels
            distanceLabels: shape.distanceLabels || [],
            
            // Watermark
            watermark: shape._watermarkMarker || null,
            
            // Rotation system
            rotationHandle: shape._rotationHandle || null,
            rotationCenter: shape._rotationCenter || null,
            
            // Rectangle scale system
            rectScaleHandles: {
                mid: shape._rectScaleHandlesMid || [],
                corner: shape._rectScaleHandlesCorner || []
            },
            rectModel: shape._rectModel || null,
            
            // Popup content
            popupContent: shape.getPopup()?.getContent() || null,
            
            // Custom properties
            customProperties: {
                _isCraneShape: shape._isCraneShape || false,
                _isFenceShape: shape._isFenceShape || false,
                _isRectangleShape: shape._isRectangleShape || false,
                _spaceData: shape._spaceData || null,
                _spaceId: shape._spaceId || null
            }
        };
        
        // Store in component registry
        if (window.EditSafety) {
            window.EditSafety.trackShapeReference(shape, components);
        }
        
        return components;
    }
    
    // Create edit handles for different shape types
    function createEditHandles(shape, shapeType, capabilities) {
        const handles = [];
        
        switch (shapeType) {
            case 'rectangle':
                handles.push(...createRectangleHandles(shape));
                break;
            case 'polygon':
                handles.push(...createPolygonHandles(shape));
                break;
            case 'fence':
                handles.push(...createFenceHandles(shape));
                break;
            case 'crane':
                handles.push(...createCraneHandles(shape));
                break;
        }
        
        // Store handles in edit mode
        editMode.handles = handles;
        
        // Add event listeners with safety
        handles.forEach(handle => {
            if (window.EditSafety) {
                window.EditSafety.addSafeEventListener(handle, 'mousedown', startHandleDrag, 10);
                window.EditSafety.addSafeEventListener(handle, 'mousemove', updateHandleDrag, 10);
                window.EditSafety.addSafeEventListener(handle, 'mouseup', endHandleDrag, 10);
            }
        });
        
        return handles;
    }
    
    // Rectangle handles creation
    function createRectangleHandles(rectangle) {
        const bounds = rectangle.getBounds();
        const handles = [];
        
        // Corner handles (4)
        const corners = [
            bounds.getNorthEast(), // NE
            bounds.getNorthWest(), // NW  
            bounds.getSouthWest(), // SW
            bounds.getSouthEast()  // SE
        ];
        
        corners.forEach((corner, index) => {
            const handle = L.circleMarker(corner, {
                radius: 8,
                color: '#0078d4',
                fillColor: '#ffffff',
                weight: 2,
                className: 'edit-handle corner-handle'
            });
            
            handle._handleType = 'corner';
            handle._cornerIndex = index;
            handle._originalBounds = bounds;
            handle._isEditHandle = true;
            
            handles.push(handle);
        });
        
        // Edge handles (4)
        const edges = [
            { point: bounds.getNorth(), type: 'north' },
            { point: bounds.getSouth(), type: 'south' },
            { point: bounds.getEast(), type: 'east' },
            { point: bounds.getWest(), type: 'west' }
        ];
        
        edges.forEach(edge => {
            const handle = L.circleMarker(edge.point, {
                radius: 6,
                color: '#28a745',
                fillColor: '#ffffff',
                weight: 2,
                className: 'edit-handle edge-handle'
            });
            
            handle._handleType = 'edge';
            handle._edgeType = edge.type;
            handle._originalBounds = bounds;
            handle._isEditHandle = true;
            
            handles.push(handle);
        });
        
        // Rotation handle
        const center = bounds.getCenter();
        const rotationHandle = L.circleMarker([
            center.lat + 0.001, center.lng
        ], {
            radius: 6,
            color: '#ffc107',
            fillColor: '#ffffff',
            weight: 2,
            className: 'edit-handle rotation-handle'
        });
        
        rotationHandle._handleType = 'rotation';
        rotationHandle._center = center;
        rotationHandle._isEditHandle = true;
        
        handles.push(rotationHandle);
        
        return handles;
    }
    
    // Polygon handles creation
    function createPolygonHandles(polygon) {
        const latLngs = polygon.getLatLngs()[0];
        const handles = [];
        
        // Vertex handles
        latLngs.forEach((latLng, index) => {
            const handle = L.circleMarker(latLng, {
                radius: 6,
                color: '#0078d4',
                fillColor: '#ffffff',
                weight: 2,
                className: 'edit-handle vertex-handle'
            });
            
            handle._handleType = 'vertex';
            handle._vertexIndex = index;
            handle._isEditHandle = true;
            
            handles.push(handle);
        });
        
        return handles;
    }
    
    // Fence handles creation
    function createFenceHandles(fence) {
        const latLngs = fence.getLatLngs();
        const handles = [];
        
        // Vertex handles
        latLngs.forEach((latLng, index) => {
            const handle = L.circleMarker(latLng, {
                radius: 6,
                color: '#ffd700',
                fillColor: '#ffffff',
                weight: 2,
                className: 'edit-handle fence-handle'
            });
            
            handle._handleType = 'fence';
            handle._vertexIndex = index;
            handle._isEditHandle = true;
            
            handles.push(handle);
        });
        
        return handles;
    }
    
    // Crane handles creation
    function createCraneHandles(crane) {
        const handles = [];
        
        // Crane-specific handles will be implemented based on crane structure
        // This is a placeholder for crane editing
        
        return handles;
    }
    
    // Handle drag events
    function startHandleDrag(e) {
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
        }
        
        const handle = e.target;
        const shape = editMode.shape;
        
        // Store drag state
        editMode.dragState = {
            active: true,
            handle: handle,
            startLatLng: e.latlng,
            startBounds: shape.getBounds()
        };
        
        // Update visual feedback
        handle.setStyle({
            radius: handle.options.radius + 2,
            weight: 3
        });
    }
    
    function updateHandleDrag(e) {
        if (!editMode.dragState || !editMode.dragState.active) return;
        
        const handle = editMode.dragState.handle;
        const shape = editMode.shape;
        const newLatLng = e.latlng;
        
        // Apply grid snapping if enabled
        if (editMode.snapSettings.grid) {
            newLatLng = snapToGrid(newLatLng);
        }
        
        // Update shape based on handle type
        switch (handle._handleType) {
            case 'corner':
                handleRectangleCornerDrag(handle, newLatLng);
                break;
            case 'edge':
                handleRectangleEdgeDrag(handle, newLatLng);
                break;
            case 'rotation':
                handleRectangleRotation(handle, newLatLng);
                break;
            case 'vertex':
                handlePolygonVertexDrag(handle, newLatLng);
                break;
            case 'fence':
                handleFenceVertexDrag(handle, newLatLng);
                break;
        }
        
        // Update all components
        updateAllComponents(shape);
    }
    
    function endHandleDrag(e) {
        if (!editMode.dragState || !editMode.dragState.active) return;
        
        const handle = editMode.dragState.handle;
        
        // Reset visual feedback
        handle.setStyle({
            radius: handle.options.radius - 2,
            weight: 2
        });
        
        // Clear drag state
        editMode.dragState = null;
    }
    
    // Rectangle editing math
    function handleRectangleCornerDrag(handle, newLatLng) {
        const rectangle = editMode.shape;
        const bounds = rectangle.getBounds();
        const cornerIndex = handle._cornerIndex;
        
        let newBounds;
        
        switch (cornerIndex) {
            case 0: // NE corner
                newBounds = L.latLngBounds(
                    bounds.getSouthWest(),
                    newLatLng
                );
                break;
            case 1: // NW corner
                newBounds = L.latLngBounds(
                    L.latLng(bounds.getSouth(), newLatLng.lng),
                    L.latLng(newLatLng.lat, bounds.getEast())
                );
                break;
            case 2: // SW corner
                newBounds = L.latLngBounds(
                    newLatLng,
                    bounds.getNorthEast()
                );
                break;
            case 3: // SE corner
                newBounds = L.latLngBounds(
                    L.latLng(newLatLng.lat, bounds.getWest()),
                    L.latLng(bounds.getNorth(), newLatLng.lng)
                );
                break;
        }
        
        // Apply grid snapping if enabled
        if (editMode.snapSettings.grid) {
            newBounds = snapBoundsToGrid(newBounds);
        }
        
        // Update rectangle
        rectangle.setBounds(newBounds);
        
        // Update measurements
        updateRectangleMeasurements(rectangle);
    }
    
    function handleRectangleEdgeDrag(handle, newLatLng) {
        const rectangle = editMode.shape;
        const bounds = rectangle.getBounds();
        const edgeType = handle._edgeType;
        
        let newBounds;
        
        switch (edgeType) {
            case 'north':
                newBounds = L.latLngBounds(
                    bounds.getSouthWest(),
                    L.latLng(newLatLng.lat, bounds.getEast())
                );
                break;
            case 'south':
                newBounds = L.latLngBounds(
                    L.latLng(newLatLng.lat, bounds.getWest()),
                    bounds.getNorthEast()
                );
                break;
            case 'east':
                newBounds = L.latLngBounds(
                    bounds.getSouthWest(),
                    L.latLng(bounds.getNorth(), newLatLng.lng)
                );
                break;
            case 'west':
                newBounds = L.latLngBounds(
                    L.latLng(bounds.getSouth(), newLatLng.lng),
                    bounds.getNorthEast()
                );
                break;
        }
        
        // Apply grid snapping if enabled
        if (editMode.snapSettings.grid) {
            newBounds = snapBoundsToGrid(newBounds);
        }
        
        // Update rectangle
        rectangle.setBounds(newBounds);
        
        // Update measurements
        updateRectangleMeasurements(rectangle);
    }
    
    function handleRectangleRotation(handle, newLatLng) {
        // Rotation implementation will be added here
        // This is a placeholder for rotation logic
    }
    
    function handlePolygonVertexDrag(handle, newLatLng) {
        const polygon = editMode.shape;
        const latLngs = polygon.getLatLngs()[0];
        const vertexIndex = handle._vertexIndex;
        
        // Update vertex position
        latLngs[vertexIndex] = newLatLng;
        
        // Update polygon
        polygon.setLatLngs(latLngs);
        
        // Update measurements
        updatePolygonMeasurements(polygon);
    }
    
    function handleFenceVertexDrag(handle, newLatLng) {
        const fence = editMode.shape;
        const latLngs = fence.getLatLngs();
        const vertexIndex = handle._vertexIndex;
        
        // Update vertex position
        latLngs[vertexIndex] = newLatLng;
        
        // Update fence
        fence.setLatLngs(latLngs);
        
        // Update measurements
        updateFenceMeasurements(fence);
    }
    
    // Grid snapping
    function snapToGrid(latLng) {
        const gridSize = 5; // 5 feet
        const center = window.map.getCenter();
        
        // Convert to feet
        const latFeet = latLng.lat * 364000;
        const lngFeet = latLng.lng * 364000 * Math.cos(center.lat * Math.PI / 180);
        
        // Snap to grid
        const snappedLatFeet = Math.round(latFeet / gridSize) * gridSize;
        const snappedLngFeet = Math.round(lngFeet / gridSize) * gridSize;
        
        // Convert back to lat/lng
        const snappedLat = snappedLatFeet / 364000;
        const snappedLng = snappedLngFeet / (364000 * Math.cos(center.lat * Math.PI / 180));
        
        return L.latLng(snappedLat, snappedLng);
    }
    
    function snapBoundsToGrid(bounds) {
        const center = bounds.getCenter();
        const snappedCenter = snapToGrid(center);
        
        const latOffset = snappedCenter.lat - center.lat;
        const lngOffset = snappedCenter.lng - center.lng;
        
        return L.latLngBounds(
            L.latLng(bounds.getSouth() + latOffset, bounds.getWest() + lngOffset),
            L.latLng(bounds.getNorth() + latOffset, bounds.getEast() + lngOffset)
        );
    }
    
    // Measurement updates
    function updateRectangleMeasurements(rectangle) {
        const bounds = rectangle.getBounds();
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        
        // Calculate dimensions in feet
        const latDiff = northEast.lat - southWest.lat;
        const lngDiff = northEast.lng - southWest.lng;
        
        const latFeet = latDiff * 364000;
        const lngFeet = lngDiff * 364000 * Math.cos(bounds.getCenter().lat * Math.PI / 180);
        
        const width = Math.abs(lngFeet);
        const height = Math.abs(latFeet);
        const area = width * height;
        const perimeter = 2 * (width + height);
        
        // Update measurement display
        updateMeasurementDisplay({
            width: width.toFixed(1),
            height: height.toFixed(1),
            area: area.toFixed(1),
            perimeter: perimeter.toFixed(1)
        });
    }
    
    function updatePolygonMeasurements(polygon) {
        const area = L.GeometryUtil.geodesicArea(polygon.getLatLngs()[0]);
        const areaSqFt = Math.round(area * 10.764);
        
        updateMeasurementDisplay({
            area: areaSqFt.toFixed(0)
        });
    }
    
    function updateFenceMeasurements(fence) {
        const latLngs = fence.getLatLngs();
        let totalLength = 0;
        
        for (let i = 0; i < latLngs.length - 1; i++) {
            const distance = calculateDistanceInFeet(latLngs[i], latLngs[i + 1]);
            totalLength += distance;
        }
        
        updateMeasurementDisplay({
            length: totalLength.toFixed(1)
        });
    }
    
    function calculateDistanceInFeet(latLng1, latLng2) {
        const distanceInMeters = latLng1.distanceTo(latLng2);
        return distanceInMeters * 3.28084;
    }
    
    function updateMeasurementDisplay(measurements) {
        // Update edit panel measurements
        Object.keys(measurements).forEach(key => {
            const element = document.getElementById(`rectangle${key.charAt(0).toUpperCase() + key.slice(1)}`);
            if (element) {
                element.textContent = `${measurements[key]} ${key === 'area' ? 'sq ft' : 'ft'}`;
            }
        });
    }
    
    // Update all components
    function updateAllComponents(shape) {
        if (window.EditSafety) {
            window.EditSafety.updateShapeReferences(shape);
        }
        
        // Update distance labels
        if (shape.distanceLabels) {
            shape.distanceLabels.forEach(label => {
                updateDistanceLabelPosition(label, shape);
            });
        }
        
        // Update watermark
        if (shape._watermarkMarker) {
            const center = shape.getBounds().getCenter();
            shape._watermarkMarker.setLatLng(center);
        }
    }
    
    // Update distance label position
    function updateDistanceLabelPosition(label, shape) {
        // Update distance label position logic
        // This will be implemented based on the specific label type
        try {
            if (label && label.setLatLng) {
                // Update label position based on shape bounds
                const bounds = shape.getBounds();
                const center = bounds.getCenter();
                label.setLatLng(center);
            }
        } catch (error) {
            console.warn('Error updating distance label position:', error);
        }
    }
    
    
    // Export functions
    if (typeof window !== 'undefined') {
        window.CustomEditCore = {
            detectShapeType,
            getShapeCapabilities,
            captureShapeState,
            disableConflictingSystems,
            preserveAllComponents,
            createEditHandles,
            updateAllComponents,
            updateDistanceLabelPosition
        };
    }
})();
