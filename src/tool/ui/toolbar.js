/* Revit-Style Toolbar System */
(function(){
    let currentTool = null; // No tool selected by default
    let currentMode = null;
    
    // Initialize toolbar
    function initializeToolbar() {
        console.log('🔧 Initializing Revit-style toolbar...');
        
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', setupToolbar);
            } else {
                setupToolbar();
            }
            
            // Add undo functionality to the new toolbar
            addUndoToNewToolbar();
            
        } catch (error) {
            console.error('❌ Toolbar initialization failed:', error);
        }
    }
    
    // Add undo functionality to the new toolbar
    function addUndoToNewToolbar() {
        // Find the undo button in the new toolbar
        const undoButton = document.getElementById('undoTool');
        if (undoButton) {
            undoButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🔧 Undo button clicked');
                
                // Use existing undo functionality
                if (window.undoLastAction && typeof window.undoLastAction === 'function') {
                    const result = window.undoLastAction();
                    if (result) {
                        showNotification('Action undone successfully', 'success');
                    } else {
                        showNotification('Nothing to undo', 'info');
                    }
                } else {
                    showNotification('Undo functionality not available', 'error');
                }
            });
        }
    }
    
    // Setup toolbar with proper error handling
    function setupToolbar() {
        try {
            // Add event listeners to all toolbar buttons
            setupToolbarListeners();
            
            // Set initial state
            updateToolbarState();
            
            // Integrate with existing save functionality
            integrateWithSaveSystem();
            
            // Test all functionality
            testToolbarFunctionality();
            
            console.log('✅ Toolbar initialized successfully');
        } catch (error) {
            console.error('❌ Toolbar setup failed:', error);
            showToolbarError('Toolbar initialization failed. Please refresh the page.');
        }
    }
    
    // Test toolbar functionality
    function testToolbarFunctionality() {
        const tests = [
            () => testButtonExists('rectangleTool'),
            () => testButtonExists('polygonTool'),
            () => testButtonExists('fenceTool'),
            () => testButtonExists('craneTool'),
            () => testButtonExists('selectTool'),
            () => testButtonExists('editTool'),
            () => testButtonExists('deleteTool'),
            () => testButtonExists('zoomIn'),
            () => testButtonExists('zoomOut'),
            () => testButtonExists('fitToView'),
            () => testButtonExists('resetView'),
            () => testButtonExists('exportImage'),
            () => testButtonExists('exportJSON')
        ];
        
        const results = tests.map(test => {
            try {
                return test();
            } catch (error) {
                console.error('Toolbar test failed:', error);
                return false;
            }
        });
        
        const allPassed = results.every(result => result === true);
        
        if (!allPassed) {
            console.warn('⚠️ Some toolbar buttons are missing or not working');
            showToolbarError('Some toolbar buttons are not working properly.');
        }
    }
    
    // Test if button exists and is clickable
    function testButtonExists(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.error(`Button ${buttonId} not found`);
            return false;
        }
        
        if (typeof button.addEventListener !== 'function') {
            console.error(`Button ${buttonId} is not a valid element`);
            return false;
        }
        
        return true;
    }
    
    // Show toolbar error to user
    function showToolbarError(message) {
        showNotification(message, 'error');
    }
    
    // Show export loading state
    function showExportLoading(message) {
        showNotification(message, 'loading');
    }
    
    // Show export success
    function showExportSuccess(message) {
        showNotification(message, 'success');
    }
    
    // Show export error
    function showExportError(message) {
        showNotification(message, 'error');
    }
    
    // Generic notification system
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.toolbar-notification');
        existing.forEach(notification => notification.remove());
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'toolbar-notification';
        
        const colors = {
            success: '#10b981',
            error: '#dc2626',
            loading: '#3b82f6',
            info: '#6b7280'
        };
        
        const icons = {
            success: '✅',
            error: '❌',
            loading: '⏳',
            info: 'ℹ️'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        notification.textContent = `${icons[type]} ${message}`;
        
        document.body.appendChild(notification);
        
        // Auto-remove after appropriate time
        const timeout = type === 'loading' ? 10000 : 5000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, timeout);
    }
    
    // Integrate toolbar with existing save system
    function integrateWithSaveSystem() {
        // Let the legacy/global save handler run so we don't double-validate.
        // No override here to avoid duplicate alerts.
        const btn = document.getElementById('saveSpace');
        if (!btn) return;
        // Ensure we don't attach an extra handler that calls alert/validation again.
    }
    
    // Handle save space functionality
    // Legacy toolbar save flow removed to prevent duplicate alerts.
    
    // Save space to database
    async function saveSpaceToDatabase(formData) {
        try {
            console.log('🔧 Saving space to database:', formData);
            
            // Get shape data
            const shapeData = window.currentShape.toGeoJSON();
            
            // Prepare space data
            const spaceData = {
                project_id: formData.projectId,
                space_name: formData.spaceName,
                category: formData.spaceCategory,
                trade: formData.companyName,
                description: formData.description,
                geometry: shapeData.geometry,
                phases: formData.phases
            };
            
            // Save to database using existing function
            if (window.saveSpace) {
                const result = await window.saveSpace(spaceData);
                if (result.success) {
                    console.log('✅ Space saved successfully');
                    alert('Space saved successfully!');
                    
                    // Clear form
                    clearForm();
                    
                    // Clear current shape
                    window.currentShape = null;
                    
                    // Update submit button
                    if (window.updateSubmitButton) {
                        window.updateSubmitButton();
                    }
                } else {
                    console.error('Save failed:', result.error);
                    alert('Error saving space: ' + result.error);
                }
            } else {
                console.error('Save function not available');
                alert('Save function not available. Please refresh the page.');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('Error saving space: ' + error.message);
        }
    }
    
    // Clear form
    function clearForm() {
        document.getElementById('spaceName').value = '';
        document.getElementById('spaceCategory').value = '';
        document.getElementById('companyName').value = '';
        document.getElementById('description').value = '';
        
        // Clear phase checkboxes
        document.querySelectorAll('#projectPhases input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    }
    
    // Setup toolbar event listeners
    function setupToolbarListeners() {
        // Drawing Tools
        document.getElementById('rectangleTool')?.addEventListener('click', () => activateTool('rectangle'));
        document.getElementById('polygonTool')?.addEventListener('click', () => activateTool('polygon'));
        document.getElementById('fenceTool')?.addEventListener('click', () => activateTool('fence'));
        document.getElementById('craneTool')?.addEventListener('click', () => activateTool('crane'));
        
        // Edit Tools
        document.getElementById('selectTool')?.addEventListener('click', () => activateTool('select'));
        document.getElementById('editTool')?.addEventListener('click', () => activateTool('edit'));
        document.getElementById('deleteTool')?.addEventListener('click', () => activateTool('delete'));
        
        // View Tools
        document.getElementById('zoomIn')?.addEventListener('click', () => zoomIn());
        document.getElementById('zoomOut')?.addEventListener('click', () => zoomOut());
        document.getElementById('fitToView')?.addEventListener('click', () => fitToView());
        document.getElementById('resetView')?.addEventListener('click', () => resetView());
        
        // Export Tools
        document.getElementById('exportImage')?.addEventListener('click', () => exportImage());
        document.getElementById('exportJSON')?.addEventListener('click', () => exportJSON());
    }
    
    // Activate tool
    function activateTool(tool) {
        console.log('🔧 Activating tool:', tool);
        
        // DON'T set currentTool here - let the individual tool functions handle it
        // This allows them to check if they're already active for toggle behavior
        
        // Activate tool functionality
        switch (tool) {
            case 'rectangle':
                activateRectangleTool();
                break;
            case 'polygon':
                activatePolygonTool();
                break;
            case 'fence':
                activateFenceTool();
                break;
            case 'crane':
                activateCraneTool();
                break;
            case 'select':
                activateSelectTool();
                break;
            case 'edit':
                activateEditTool();
                break;
            case 'delete':
                activateDeleteTool();
                break;
        }
        
        // Update toolbar visual state after tool activates
        updateToolbarVisualState();
        updateToolbarState();
        
        // Update state tracking
        if (window.updateToolState && currentTool) {
            window.updateToolState(currentTool, 'active', null, false);
        }
    }
    
    // Update toolbar visual state
    function updateToolbarVisualState() {
        // Remove active class from all buttons
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to current tool (if any)
        if (currentTool) {
            const activeButton = document.getElementById(currentTool + 'Tool');
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
    }
    
    // Tool activation functions
    function activateRectangleTool() {
        console.log('🔧 Activating rectangle tool');
        
        try {
            // If already active, deactivate
            if (currentTool === 'rectangle') {
                console.log('🔧 Deactivating rectangle tool');
                deactivateCurrentTool();
                return;
            }
            
            // Deactivate any current tool first
            deactivateCurrentTool();
            
            // Set as current tool
            currentTool = 'rectangle';
            currentMode = 'draw';
            
            // Use rectangle facade (isolated module)
            if (window.RectangleTool && typeof window.RectangleTool.startDraw === 'function') {
                window.RectangleTool.startDraw();
                console.log('✅ Rectangle tool activated');
                updateToolbarVisualState();
                updateToolbarState();
            } else {
                console.warn('Rectangle facade not available');
                showNotification('Rectangle tool not available - system not ready', 'error');
                currentTool = null;
                currentMode = null;
            }
        } catch (error) {
            console.error('❌ Error activating rectangle tool:', error);
            showNotification('Error activating rectangle tool: ' + error.message, 'error');
            currentTool = null;
            currentMode = null;
        }
    }
    
    function activatePolygonTool() {
        console.log('🔧 Activating polygon tool');
        
        try {
            // If already active, deactivate
            if (currentTool === 'polygon') {
                console.log('🔧 Deactivating polygon tool');
                deactivateCurrentTool();
                return;
            }
            
            // Deactivate any current tool first
            deactivateCurrentTool();
            
            // Set as current tool
            currentTool = 'polygon';
            currentMode = 'draw';
            
            // Use polygon facade
            if (window.PolygonTool && typeof window.PolygonTool.startDraw === 'function') {
                window.PolygonTool.startDraw();
                console.log('✅ Polygon tool activated');
                updateToolbarVisualState();
                updateToolbarState();
            } else {
                console.warn('Polygon facade not available');
                showNotification('Polygon tool not available - system not ready', 'error');
                currentTool = null;
                currentMode = null;
            }
        } catch (error) {
            console.error('❌ Error activating polygon tool:', error);
            showNotification('Error activating polygon tool: ' + error.message, 'error');
            currentTool = null;
            currentMode = null;
        }
    }
    
    // Deactivate current tool
    function deactivateCurrentTool() {
        if (!currentTool) return;
        
        console.log(`🔧 Deactivating ${currentTool} tool`);
        
        // Stop any drawing in progress
        if (window.UnifiedDrawing && typeof window.UnifiedDrawing.stopDrawing === 'function') {
            window.UnifiedDrawing.stopDrawing();
        }
        
        // Clear tool state
        currentTool = null;
        currentMode = null;
        
        // Update toolbar state and visuals
        updateToolbarVisualState();
        updateToolbarState();
    }
    
    function activateFenceTool() {
        console.log('🔧 Activating fence tool');
        currentMode = 'draw';
        
        // Disable other drawing tools
        if (window.disableDrawingControls) {
            window.disableDrawingControls();
        }
        
        // Disable crane mode
        if (window.isCraneModeActive !== undefined) {
            window.isCraneModeActive = false;
        }
        
        // Disable all Leaflet draw modes
        if (window.map && window.map._drawControl) {
            try {
                const drawControl = window.map._drawControl._toolbars.draw;
                Object.keys(drawControl._modes).forEach(mode => {
                    if (drawControl._modes[mode].handler && drawControl._modes[mode].handler._enabled) {
                        drawControl._modes[mode].handler.disable();
                    }
                });
            } catch (error) {
                console.warn('Error disabling draw modes:', error);
            }
        }
        
        // Enable fence drawing - use unified system
        try {
            // Use unified drawing system
            if (window.UnifiedDrawing && typeof window.UnifiedDrawing.startDrawing === 'function') {
                window.UnifiedDrawing.startDrawing('fence');
                console.log('✅ Fence tool activated (unified)');
                showNotification('Fence tool activated - Click to start drawing fence', 'success');
            } else {
                console.warn('Unified drawing system not available');
                showNotification('Fence tool not available - system not ready', 'error');
            }
        } catch (error) {
            console.error('❌ Error activating fence tool:', error);
            showNotification('Error activating fence tool: ' + error.message, 'error');
        }
    }
    
    function activateCraneTool() {
        console.log('🔧 Activating crane tool');
        currentMode = 'draw';
        
        // Disable other drawing tools
        if (window.disableDrawingControls) {
            window.disableDrawingControls();
        }
        
        // Disable fence mode
        if (window.isFenceModeActive !== undefined) {
            window.isFenceModeActive = false;
        }
        
        // Disable all Leaflet draw modes
        if (window.map && window.map._drawControl) {
            try {
                const drawControl = window.map._drawControl._toolbars.draw;
                Object.keys(drawControl._modes).forEach(mode => {
                    if (drawControl._modes[mode].handler && drawControl._modes[mode].handler._enabled) {
                        drawControl._modes[mode].handler.disable();
                    }
                });
            } catch (error) {
                console.warn('Error disabling draw modes:', error);
            }
        }
        
        // Enable crane drawing - use direct crane tool
        try {
            if (window.CraneTool && window.CraneTool.startCraneDrawing) {
                window.CraneTool.startCraneDrawing();
                console.log('✅ Crane tool activated (direct)');
                showNotification('Crane tool activated - Click to start placing crane', 'success');
            } else {
                console.warn('Crane tool not available');
                showNotification('Crane tool not available - system not ready', 'error');
            }
        } catch (error) {
            console.error('❌ Error activating crane tool:', error);
            showNotification('Error activating crane tool: ' + error.message, 'error');
        }
    }
    
    function activateSelectTool() {
        console.log('🔧 Activating select tool');
        currentMode = 'select';
        
        // Disable all drawing tools
        if (window.disableDrawingControls) {
            window.disableDrawingControls();
        }
        
        // Disable fence and crane modes
        if (window.isFenceModeActive !== undefined) {
            window.isFenceModeActive = false;
        }
        if (window.isCraneModeActive !== undefined) {
            window.isCraneModeActive = false;
        }
        
        // Disable all Leaflet draw modes
        if (window.map && window.map._drawControl) {
            try {
                const drawControl = window.map._drawControl._toolbars.draw;
                Object.keys(drawControl._modes).forEach(mode => {
                    if (drawControl._modes[mode].handler && drawControl._modes[mode].handler._enabled) {
                        drawControl._modes[mode].handler.disable();
                    }
                });
            } catch (error) {
                console.warn('Error disabling draw modes:', error);
            }
        }
        
        // Enable selection mode
        if (window.map) {
            window.map.dragging.enable();
            window.map.boxZoom.enable();
            
            // Reset cursor to default
            if (window.map.getContainer) {
                window.map.getContainer().style.cursor = 'default';
            }
            
            console.log('✅ Select tool activated');
            showNotification('Select tool activated - Click on shapes to select them', 'success');
        } else {
            console.warn('Map not available');
            showNotification('Select tool not available - map not ready', 'error');
        }
    }
    
    function activateEditTool() {
        console.log('🔧 Activating edit tool');
        currentMode = 'edit';
        
        // Check if there's a selected shape
        if (window.currentShape) {
            // Activate custom editing system
            if (window.CustomEditing) {
                const shapeType = window.CustomEditCore?.detectShapeType(window.currentShape) || 'polygon';
                const capabilities = window.CustomEditCore?.getShapeCapabilities(shapeType) || { tools: [] };
                window.CustomEditing.activateEditMode(window.currentShape, shapeType, capabilities);
                console.log('✅ Edit tool activated');
                showNotification('Edit tool activated - Use handles to modify the shape', 'success');
            } else {
                console.warn('Custom editing system not available');
                showNotification('Edit tool not available - custom editing system not loaded', 'error');
            }
        } else {
            console.warn('No shape selected for editing');
            showNotification('No shape selected - please select a shape first', 'error');
        }
    }
    
    function activateDeleteTool() {
        console.log('🔧 Activating delete tool');
        currentMode = 'delete';
        
        // Check if there's a selected shape or saved space id
        const selectedLayer = window.currentShape || window.lastSelectedSpaceLayer || null;
        const selectedSpaceId = (selectedLayer && selectedLayer._spaceId) || window.lastSelectedSpaceId || null;
        if (selectedLayer || selectedSpaceId) {
            if (confirm('Are you sure you want to delete this shape?')) {
                // If it's a saved space, delete from DB too
                if (selectedSpaceId && typeof window.deleteSavedSpace === 'function') {
                    window.deleteSavedSpace(selectedSpaceId).then(() => {
                        console.log('✅ Saved space deleted');
                        showNotification('Space deleted successfully', 'success');
                        window.currentShape = null; window.lastSelectedSpaceLayer = null; window.lastSelectedSpaceId = null;
                        if (window.updateSubmitButton) window.updateSubmitButton();
                    }).catch(err => {
                        console.error('Delete error:', err);
                        showNotification('Error deleting space', 'error');
                    });
                    return;
                }

                // Otherwise just remove from map
                if (window.map && selectedLayer && window.map.hasLayer(selectedLayer)) {
                    window.map.removeLayer(selectedLayer);
                }
                window.currentShape = null; window.lastSelectedSpaceLayer = null; window.lastSelectedSpaceId = null;
                if (window.updateSubmitButton) window.updateSubmitButton();
                console.log('✅ Shape deleted'); showNotification('Shape deleted successfully', 'success');
            }
        } else {
            console.warn('No shape selected for deletion');
            showNotification('No shape selected - please select a shape first', 'error');
        }
    }
    
    // View functions
    function zoomIn() {
        if (window.map) {
            window.map.zoomIn();
        }
    }
    
    function zoomOut() {
        if (window.map) {
            window.map.zoomOut();
        }
    }
    
    function fitToView() {
        if (window.map && window.drawnItems) {
            if (window.drawnItems.getLayers().length > 0) {
                window.map.fitBounds(window.drawnItems.getBounds());
            }
        }
    }
    
    function resetView() {
        if (window.map && window.currentProject) {
            window.map.setView(window.currentProject.coordinates, window.currentProject.zoom || 18);
        }
    }
    
    // Export functions
    function exportImage() {
        console.log('🔧 Exporting as image');
        
        // Show loading state
        showExportLoading('Preparing image export...');
        
        if (!window.map) {
            console.warn('Map not available for export');
            showExportError('Map not available for export');
            return;
        }
        
        try {
            // Use html2canvas to capture the map
            if (typeof html2canvas !== 'undefined') {
                html2canvas(document.getElementById('map'), {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    foreignObjectRendering: true
                }).then(canvas => {
                    // Create download link
                    const link = document.createElement('a');
                    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                    link.download = `map-export-${timestamp}.png`;
                    link.href = canvas.toDataURL('image/png', 1.0);
                    link.click();
                    
                    // Show success message
                    showExportSuccess('Image exported successfully!');
                    console.log('✅ Image exported successfully');
                }).catch(error => {
                    console.error('Error exporting image:', error);
                    showExportError('Error exporting image: ' + error.message);
                });
            } else {
                // Fallback: use Leaflet's built-in export
                if (window.map.getContainer) {
                    const container = window.map.getContainer();
                    const canvas = container.querySelector('canvas');
                    if (canvas) {
                        const link = document.createElement('a');
                        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                        link.download = `map-export-${timestamp}.png`;
                        link.href = canvas.toDataURL();
                        link.click();
                        showExportSuccess('Image exported successfully!');
                        console.log('✅ Image exported successfully (fallback)');
                    } else {
                        showExportError('Image export not available. Please install html2canvas library.');
                    }
                } else {
                    showExportError('Map container not found');
                }
            }
        } catch (error) {
            console.error('Export error:', error);
            showExportError('Error exporting image: ' + error.message);
        }
    }
    
    function exportJSON() {
        console.log('🔧 Exporting as JSON');
        
        if (!window.map || !window.drawnItems) {
            console.warn('Map or drawn items not available for export');
            return;
        }
        
        try {
            const layers = window.drawnItems.getLayers();
            const features = [];
            
            layers.forEach(layer => {
                const geoJSON = layer.toGeoJSON();
                features.push(geoJSON);
            });
            
            const geoJSONData = {
                type: 'FeatureCollection',
                features: features,
                metadata: {
                    exportDate: new Date().toISOString(),
                    projectName: window.currentProject?.name || 'Unknown Project',
                    totalFeatures: features.length
                }
            };
            
            // Create and download JSON file
            const blob = new Blob([JSON.stringify(geoJSONData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `map-data-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('✅ JSON exported successfully');
        } catch (error) {
            console.error('JSON export error:', error);
            alert('Error exporting JSON. Please try again.');
        }
    }
    
    // Update toolbar state
    function updateToolbarState() {
        // Remove active class from all buttons
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to current tool
        if (currentTool) {
            const toolButton = document.getElementById(currentTool + 'Tool');
            if (toolButton) {
                toolButton.classList.add('active');
            }
        }
        
        // Update tool indicators
        const toolIndicator = document.querySelector('.tool-indicator');
        if (toolIndicator) {
            if (currentTool) {
                toolIndicator.textContent = currentTool.charAt(0).toUpperCase() + currentTool.slice(1);
                toolIndicator.className = `tool-indicator tool-${currentTool}`;
            } else {
                toolIndicator.textContent = 'No Tool';
                toolIndicator.className = 'tool-indicator tool-none';
            }
        }
        
        // Update stage indicator
        const stageIndicator = document.querySelector('.stage-indicator');
        if (stageIndicator) {
            if (currentMode) {
                stageIndicator.textContent = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
                stageIndicator.className = `stage-indicator stage-${currentMode}`;
            } else {
                stageIndicator.textContent = 'Idle';
                stageIndicator.className = 'stage-indicator stage-idle';
            }
        }
    }
    
    // Get current tool
    function getCurrentTool() {
        return currentTool;
    }
    
    // Get current mode
    function getCurrentMode() {
        return currentMode;
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeToolbar);
    } else {
        initializeToolbar();
    }
    
    // Export functions
    if (typeof window !== 'undefined') {
        window.Toolbar = {
            activateTool,
            getCurrentTool,
            getCurrentMode,
            updateToolbarState
        };
    }
})();
