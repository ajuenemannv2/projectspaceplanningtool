/* Custom Edit Panel System - Construction Planning Focused */
(function(){
    let editPanel = null;
    let currentShapeType = null;
    let currentCapabilities = null;
    
    // Show edit panel
    function showEditPanel(shapeType, capabilities) {
        // Remove existing panel
        const existingPanel = document.getElementById('editPanel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // Create new panel
        editPanel = document.createElement('div');
        editPanel.id = 'editPanel';
        editPanel.className = 'edit-panel';
        
        // Add panel content based on shape type
        switch (shapeType) {
            case 'rectangle':
                editPanel.innerHTML = createRectangleEditPanel(capabilities);
                break;
            case 'polygon':
                editPanel.innerHTML = createPolygonEditPanel(capabilities);
                break;
            case 'fence':
                editPanel.innerHTML = createFenceEditPanel(capabilities);
                break;
            case 'crane':
                editPanel.innerHTML = createCraneEditPanel(capabilities);
                break;
        }
        
        // Add panel to DOM
        document.body.appendChild(editPanel);
        
        // Add event listeners
        addEditPanelListeners(editPanel, shapeType);
        
        // Store current state
        currentShapeType = shapeType;
        currentCapabilities = capabilities;
    }
    
    // Rectangle edit panel HTML
    function createRectangleEditPanel(capabilities) {
        return `
            <div class="edit-panel-header">
                <h3>Rectangle Editing</h3>
                <button id="closeEditPanel" class="close-btn">×</button>
            </div>
            
            <div class="edit-panel-content">
                <div class="measurements">
                    <div class="measurement-item">
                        <label>Width:</label>
                        <span id="rectangleWidth">0 ft</span>
                    </div>
                    <div class="measurement-item">
                        <label>Height:</label>
                        <span id="rectangleHeight">0 ft</span>
                    </div>
                    <div class="measurement-item">
                        <label>Area:</label>
                        <span id="rectangleArea">0 sq ft</span>
                    </div>
                    <div class="measurement-item">
                        <label>Perimeter:</label>
                        <span id="rectanglePerimeter">0 ft</span>
                    </div>
                </div>
                
                <div class="edit-tools">
                    <button id="cornerEdit" class="edit-tool active">Corner Edit</button>
                    <button id="edgeEdit" class="edit-tool">Edge Edit</button>
                    <button id="rotateEdit" class="edit-tool">Rotate</button>
                    <button id="moveEdit" class="edit-tool">Move</button>
                </div>
                
                <div class="edit-options">
                    <label>
                        <input type="checkbox" id="aspectLock" checked>
                        Lock Aspect Ratio
                    </label>
                    <label>
                        <input type="checkbox" id="gridSnap" checked>
                        Grid Snap (5ft)
                    </label>
                </div>
                
                <div class="system-status">
                    <div class="status-item">
                        <span class="status-label">Components:</span>
                        <span id="componentStatus" class="status-value">Preserved</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Systems:</span>
                        <span id="systemStatus" class="status-value">Disabled</span>
                    </div>
                </div>
                
                <div class="edit-actions">
                    <button id="undoEdit" class="action-btn">Undo</button>
                    <button id="redoEdit" class="action-btn">Redo</button>
                    <button id="doneEdit" class="action-btn primary">Done</button>
                </div>
            </div>
        `;
    }
    
    // Polygon edit panel HTML
    function createPolygonEditPanel(capabilities) {
        return `
            <div class="edit-panel-header">
                <h3>Polygon Editing</h3>
                <button id="closeEditPanel" class="close-btn">×</button>
            </div>
            
            <div class="edit-panel-content">
                <div class="measurements">
                    <div class="measurement-item">
                        <label>Vertices:</label>
                        <span id="polygonVertices">0</span>
                    </div>
                    <div class="measurement-item">
                        <label>Area:</label>
                        <span id="polygonArea">0 sq ft</span>
                    </div>
                    <div class="measurement-item">
                        <label>Perimeter:</label>
                        <span id="polygonPerimeter">0 ft</span>
                    </div>
                </div>
                
                <div class="edit-tools">
                    <button id="vertexEdit" class="edit-tool active">Vertex Edit</button>
                    <button id="edgeEdit" class="edit-tool">Edge Edit</button>
                    <button id="addVertex" class="edit-tool">Add Vertex</button>
                    <button id="removeVertex" class="edit-tool">Remove Vertex</button>
                </div>
                
                <div class="edit-options">
                    <label>
                        <input type="checkbox" id="gridSnap" checked>
                        Grid Snap (5ft)
                    </label>
                    <label>
                        <input type="checkbox" id="smoothEdges">
                        Smooth Edges
                    </label>
                </div>
                
                <div class="system-status">
                    <div class="status-item">
                        <span class="status-label">Components:</span>
                        <span id="componentStatus" class="status-value">Preserved</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Systems:</span>
                        <span id="systemStatus" class="status-value">Disabled</span>
                    </div>
                </div>
                
                <div class="edit-actions">
                    <button id="undoEdit" class="action-btn">Undo</button>
                    <button id="redoEdit" class="action-btn">Redo</button>
                    <button id="doneEdit" class="action-btn primary">Done</button>
                </div>
            </div>
        `;
    }
    
    // Fence edit panel HTML
    function createFenceEditPanel(capabilities) {
        return `
            <div class="edit-panel-header">
                <h3>Fence Editing</h3>
                <button id="closeEditPanel" class="close-btn">×</button>
            </div>
            
            <div class="edit-panel-content">
                <div class="measurements">
                    <div class="measurement-item">
                        <label>Length:</label>
                        <span id="fenceLength">0 ft</span>
                    </div>
                    <div class="measurement-item">
                        <label>Segments:</label>
                        <span id="fenceSegments">0</span>
                    </div>
                </div>
                
                <div class="edit-tools">
                    <button id="segmentEdit" class="edit-tool active">Segment Edit</button>
                    <button id="addGate" class="edit-tool">Add Gate</button>
                    <button id="removeGate" class="edit-tool">Remove Gate</button>
                    <button id="setHeight" class="edit-tool">Set Height</button>
                </div>
                
                <div class="edit-options">
                    <label>
                        <input type="checkbox" id="gridSnap" checked>
                        Grid Snap (5ft)
                    </label>
                    <label>
                        <input type="checkbox" id="perpendicularSnap">
                        Perpendicular Snap
                    </label>
                </div>
                
                <div class="system-status">
                    <div class="status-item">
                        <span class="status-label">Components:</span>
                        <span id="componentStatus" class="status-value">Preserved</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Systems:</span>
                        <span id="systemStatus" class="status-value">Disabled</span>
                    </div>
                </div>
                
                <div class="edit-actions">
                    <button id="undoEdit" class="action-btn">Undo</button>
                    <button id="redoEdit" class="action-btn">Redo</button>
                    <button id="doneEdit" class="action-btn primary">Done</button>
                </div>
            </div>
        `;
    }
    
    // Crane edit panel HTML
    function createCraneEditPanel(capabilities) {
        return `
            <div class="edit-panel-header">
                <h3>Crane Editing</h3>
                <button id="closeEditPanel" class="close-btn">×</button>
            </div>
            
            <div class="edit-panel-content">
                <div class="measurements">
                    <div class="measurement-item">
                        <label>Pad Size:</label>
                        <span id="cranePadSize">0 ft × 0 ft</span>
                    </div>
                    <div class="measurement-item">
                        <label>Radius:</label>
                        <span id="craneRadius">0 ft</span>
                    </div>
                    <div class="measurement-item">
                        <label>Sweep:</label>
                        <span id="craneSweep">0°</span>
                    </div>
                </div>
                
                <div class="edit-tools">
                    <button id="padEdit" class="edit-tool active">Pad Edit</button>
                    <button id="radiusEdit" class="edit-tool">Radius Edit</button>
                    <button id="sweepEdit" class="edit-tool">Sweep Edit</button>
                    <button id="positionEdit" class="edit-tool">Position Edit</button>
                </div>
                
                <div class="edit-options">
                    <label>
                        <input type="checkbox" id="gridSnap" checked>
                        Grid Snap (5ft)
                    </label>
                    <label>
                        <input type="checkbox" id="constraintLock">
                        Lock Constraints
                    </label>
                </div>
                
                <div class="system-status">
                    <div class="status-item">
                        <span class="status-label">Components:</span>
                        <span id="componentStatus" class="status-value">Preserved</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Systems:</span>
                        <span id="systemStatus" class="status-value">Disabled</span>
                    </div>
                </div>
                
                <div class="edit-actions">
                    <button id="undoEdit" class="action-btn">Undo</button>
                    <button id="redoEdit" class="action-btn">Redo</button>
                    <button id="doneEdit" class="action-btn primary">Done</button>
                </div>
            </div>
        `;
    }
    
    // Add event listeners to edit panel
    function addEditPanelListeners(panel, shapeType) {
        // Close button
        panel.querySelector('#closeEditPanel').addEventListener('click', exitEditMode);
        
        // Tool buttons
        panel.querySelectorAll('.edit-tool').forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all tools
                panel.querySelectorAll('.edit-tool').forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked tool
                this.classList.add('active');
                
                // Activate tool
                activateEditTool(this.id, shapeType);
            });
        });
        
        // Options
        panel.querySelector('#aspectLock')?.addEventListener('change', function() {
            if (window.EditSafety) {
                window.EditSafety.updateAppState({
                    editMode: { aspectLock: this.checked }
                });
            }
        });
        
        panel.querySelector('#gridSnap')?.addEventListener('change', function() {
            if (window.EditSafety) {
                window.EditSafety.updateAppState({
                    editMode: { snapSettings: { grid: this.checked } }
                });
            }
        });
        
        // Actions
        panel.querySelector('#undoEdit').addEventListener('click', undoEdit);
        panel.querySelector('#redoEdit').addEventListener('click', redoEdit);
        panel.querySelector('#doneEdit').addEventListener('click', exitEditMode);
    }
    
    // Activate edit tool
    function activateEditTool(toolId, shapeType) {
        console.log(`Activating tool: ${toolId} for shape type: ${shapeType}`);
        
        // Update tool state
        if (window.EditSafety) {
            window.EditSafety.updateAppState({
                editMode: { activeTool: toolId }
            });
        }
        
        // Update visual feedback
        updateToolVisualFeedback(toolId);
    }
    
    // Update tool visual feedback
    function updateToolVisualFeedback(toolId) {
        // Update handle visibility based on tool
        const handles = document.querySelectorAll('.edit-handle');
        handles.forEach(handle => {
            const handleType = handle._handleType;
            const shouldShow = shouldShowHandle(handleType, toolId);
            handle.style.display = shouldShow ? 'block' : 'none';
        });
    }
    
    // Determine if handle should be shown
    function shouldShowHandle(handleType, toolId) {
        const toolHandleMap = {
            'cornerEdit': ['corner'],
            'edgeEdit': ['edge'],
            'rotateEdit': ['rotation'],
            'moveEdit': ['corner', 'edge'],
            'vertexEdit': ['vertex'],
            'segmentEdit': ['fence']
        };
        
        return toolHandleMap[toolId]?.includes(handleType) || false;
    }
    
    // Undo edit operation
    function undoEdit() {
        if (window.EditSafety) {
            const state = window.EditSafety.getAppState();
            if (state.undoStack.length > 0) {
                const lastOperation = state.undoStack.pop();
                // Implement undo logic
                console.log('Undoing operation:', lastOperation);
            }
        }
    }
    
    // Redo edit operation
    function redoEdit() {
        if (window.EditSafety) {
            const state = window.EditSafety.getAppState();
            if (state.redoStack.length > 0) {
                const nextOperation = state.redoStack.pop();
                // Implement redo logic
                console.log('Redoing operation:', nextOperation);
            }
        }
    }
    
    // Exit edit mode
    function exitEditMode() {
        if (window.EditSafety) {
            window.EditSafety.forceCleanup();
        }
        
        // Hide edit panel
        hideEditPanel();
        
        // Update state tracking
        if (window.updateToolState) {
            window.updateToolState('none', 'idle', null, false);
        }
    }
    
    // Hide edit panel
    function hideEditPanel() {
        if (editPanel) {
            editPanel.remove();
            editPanel = null;
        }
        currentShapeType = null;
        currentCapabilities = null;
    }
    
    // Update measurements in edit panel
    function updateEditPanelMeasurements(shape) {
        if (!editPanel) return;
        
        const shapeType = currentShapeType;
        
        switch (shapeType) {
            case 'rectangle':
                updateRectangleMeasurements(shape);
                break;
            case 'polygon':
                updatePolygonMeasurements(shape);
                break;
            case 'fence':
                updateFenceMeasurements(shape);
                break;
            case 'crane':
                updateCraneMeasurements(shape);
                break;
        }
    }
    
    function updateRectangleMeasurements(shape) {
        const bounds = shape.getBounds();
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        
        const latDiff = northEast.lat - southWest.lat;
        const lngDiff = northEast.lng - southWest.lng;
        
        const latFeet = latDiff * 364000;
        const lngFeet = lngDiff * 364000 * Math.cos(bounds.getCenter().lat * Math.PI / 180);
        
        const width = Math.abs(lngFeet);
        const height = Math.abs(latFeet);
        const area = width * height;
        const perimeter = 2 * (width + height);
        
        const widthElement = document.getElementById('rectangleWidth');
        const heightElement = document.getElementById('rectangleHeight');
        const areaElement = document.getElementById('rectangleArea');
        const perimeterElement = document.getElementById('rectanglePerimeter');
        
        if (widthElement) widthElement.textContent = `${width.toFixed(1)} ft`;
        if (heightElement) heightElement.textContent = `${height.toFixed(1)} ft`;
        if (areaElement) areaElement.textContent = `${area.toFixed(1)} sq ft`;
        if (perimeterElement) perimeterElement.textContent = `${perimeter.toFixed(1)} ft`;
    }
    
    function updatePolygonMeasurements(shape) {
        const area = L.GeometryUtil.geodesicArea(shape.getLatLngs()[0]);
        const areaSqFt = Math.round(area * 10.764);
        const vertices = shape.getLatLngs()[0].length;
        
        const verticesElement = document.getElementById('polygonVertices');
        const areaElement = document.getElementById('polygonArea');
        
        if (verticesElement) verticesElement.textContent = vertices;
        if (areaElement) areaElement.textContent = `${areaSqFt} sq ft`;
    }
    
    function updateFenceMeasurements(shape) {
        const latLngs = shape.getLatLngs();
        let totalLength = 0;
        
        for (let i = 0; i < latLngs.length - 1; i++) {
            const distance = latLngs[i].distanceTo(latLngs[i + 1]) * 3.28084;
            totalLength += distance;
        }
        
        const lengthElement = document.getElementById('fenceLength');
        const segmentsElement = document.getElementById('fenceSegments');
        
        if (lengthElement) lengthElement.textContent = `${totalLength.toFixed(1)} ft`;
        if (segmentsElement) segmentsElement.textContent = latLngs.length - 1;
    }
    
    function updateCraneMeasurements(shape) {
        // Crane measurement updates will be implemented here
        console.log('Updating crane measurements');
    }
    
    // Export functions
    if (typeof window !== 'undefined') {
        window.EditPanel = {
            showEditPanel,
            hideEditPanel,
            updateEditPanelMeasurements,
            exitEditMode
        };
    }
})();



