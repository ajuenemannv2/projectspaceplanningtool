/* Main Custom Editing System - Integration with existing codebase */
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
    
    // Main edit mode activation
    function activateEditMode(shape, shapeType, capabilities) {
        // 1. Validate inputs
        if (!shape || !shapeType || !capabilities) {
            console.error('Invalid edit mode activation parameters');
            return false;
        }
        
        // 2. Check for existing edit mode
        if (editMode.active) {
            console.warn('Edit mode already active, cleaning up first');
            exitEditMode();
        }
        
        // 3. Direct activation (simplified approach)
        try {
            activateEditModeInternal(shape, shapeType, capabilities);
            return true;
        } catch (error) {
            console.error('Error activating edit mode:', error);
            return false;
        }
    }
    
    // Internal edit mode activation
    async function activateEditModeInternal(shape, shapeType, capabilities) {
        try {
            console.log('🔧 Activating edit mode for:', shapeType);
            
            // 1. Backup original state (safe for groups/GeoJSON)
            let originalState = null;
            if (window.CustomEditCore && window.CustomEditCore.captureShapeState) {
                originalState = window.CustomEditCore.captureShapeState(shape);
            }
            
            // 2. Disable conflicting systems
            let disabledSystems = {};
            if (window.CustomEditCore && window.CustomEditCore.disableConflictingSystems) {
                disabledSystems = window.CustomEditCore.disableConflictingSystems(shape);
            }
            
            // 3. Preserve all components
            let components = {};
            if (window.CustomEditCore && window.CustomEditCore.preserveAllComponents) {
                components = window.CustomEditCore.preserveAllComponents(shape);
            }
            
            // 4. Create custom edit handles
            let handles = [];
            if (window.CustomEditCore && window.CustomEditCore.createEditHandles) {
                handles = window.CustomEditCore.createEditHandles(shape, shapeType, capabilities);
            }
            
            // 5. Show edit panel (DISABLED by default to keep map unobstructed)
            // Toggle with window.SHOW_EDIT_PANEL = true if needed
            if (window.SHOW_EDIT_PANEL === true && window.EditPanel && window.EditPanel.showEditPanel) {
                window.EditPanel.showEditPanel(shapeType, capabilities);
            }
            
            // 6. Update state
            editMode = {
                active: true,
                shape: shape,
                type: shapeType,
                tools: capabilities.tools || [],
                components: components,
                snapSettings: {
                    grid: true,
                    shapes: true,
                    measurements: true
                },
                originalState: originalState,
                disabledSystems: disabledSystems,
                handles: handles
            };
            
            // 7. Update visual state (guard non-styleable groups)
            try { updateShapeVisualState(shape, 'editing'); } catch(_) {}
            
            // 8. Update state tracking
            if (window.updateToolState) {
                window.updateToolState('edit', 'editing', shape, false);
            }
            
            console.log('✅ Edit mode activated successfully');
            
        } catch (error) {
            console.error('❌ Edit mode activation error:', error);
            // Rollback on error
            await rollbackEditMode(shape);
        }
    }
    
    // Exit edit mode
    function exitEditMode() {
        if (!editMode.active) return;
        
        const shape = editMode.shape;
        
        try {
            // 1. Restore all components
            restoreAllComponents(shape);
            
            // 2. Clean up custom edit handles
            cleanupCustomEditHandles();
            
            // 3. Hide edit panel if it was explicitly enabled
            if (window.SHOW_EDIT_PANEL === true && window.EditPanel) {
                window.EditPanel.hideEditPanel();
            }
            
            // 4. Re-enable disabled systems
            reEnableDisabledSystems(shape);
            
            // 5. Update state tracking
            if (window.updateToolState) {
                window.updateToolState('none', 'idle', null, false);
            }
            
            // 6. Reset edit mode
            editMode = {
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
            
            // 7. Update visual state
            updateShapeVisualState(shape, 'normal');
            
            console.log('✅ Edit mode exited successfully');
            
        } catch (error) {
            console.error('❌ Edit mode exit error:', error);
            // Force cleanup
            if (window.EditSafety) {
                window.EditSafety.forceCleanup();
            }
        }
    }
    
    // Restore all components
    function restoreAllComponents(shape) {
        if (!editMode.components) return;
        
        const components = editMode.components;
        
        // Restore distance labels
        if (components.distanceLabels) {
            shape.distanceLabels = components.distanceLabels;
        }
        
        // Restore watermark
        if (components.watermark) {
            shape._watermarkMarker = components.watermark;
        }
        
        // Restore rotation handle
        if (components.rotationHandle) {
            shape._rotationHandle = components.rotationHandle;
        }
        
        // Restore rectangle scale handles
        if (components.rectScaleHandles) {
            shape._rectScaleHandlesMid = components.rectScaleHandles.mid;
            shape._rectScaleHandlesCorner = components.rectScaleHandles.corner;
        }
        
        // Restore popup content
        if (components.popupContent) {
            shape.bindPopup(components.popupContent);
        }
        
        // Restore custom properties
        if (components.customProperties) {
            Object.keys(components.customProperties).forEach(key => {
                shape[key] = components.customProperties[key];
            });
        }
    }
    
    // Clean up custom edit handles
    function cleanupCustomEditHandles() {
        if (editMode.handles) {
            editMode.handles.forEach(handle => {
                try {
                    if (window.map && window.map.hasLayer(handle)) {
                        window.map.removeLayer(handle);
                    }
                } catch (error) {
                    console.error('Handle cleanup error:', error);
                }
            });
        }
    }
    
    // Re-enable disabled systems
    function reEnableDisabledSystems(shape) {
        const disabledSystems = editMode.disabledSystems;
        
        // Re-enable Leaflet edit mode
        if (disabledSystems.leafletEdit) {
            try {
                const editHandler = window.map?._drawControl?._toolbars?.edit?._modes?.edit?.handler;
                if (editHandler) {
                    editHandler.enable();
                }
            } catch(_) {}
        }
        
        // Re-enable rotation system
        if (disabledSystems.rotation && shape._rotationHandle) {
            try {
                if (window.enablePolygonRotation) {
                    window.enablePolygonRotation(shape);
                }
            } catch(_) {}
        }
        
        // Re-enable rectangle scale mode
        if (disabledSystems.rectangleScale && shape._rectScaleActive) {
            try {
                if (window.enableRectScaleMode) {
                    window.enableRectScaleMode(shape);
                }
            } catch(_) {}
        }
        
        // Re-enable drawing controls
        if (window.enableDrawingControls) {
            window.enableDrawingControls();
        }
    }
    
    // Update shape visual state
    function updateShapeVisualState(shape, state) {
        try {
            const applyStyle = (layer) => {
                if (!layer || typeof layer.setStyle !== 'function') return;
                if (state === 'editing') {
                    layer.setStyle({ color: '#ff6b35', weight: 3, opacity: 0.8 });
                } else if (state === 'normal') {
                    layer.setStyle({ color: '#0078d4', weight: 2, opacity: 0.6 });
                }
            };
            if (shape && typeof shape.eachLayer === 'function') {
                shape.eachLayer(applyStyle);
            } else {
                applyStyle(shape);
            }
        } catch (error) {
            console.error('Visual state update error:', error);
        }
    }
    
    // Rollback edit mode on error
    async function rollbackEditMode(shape) {
        console.warn('Rolling back edit mode due to error');
        
        try {
            // Force cleanup
            if (window.EditSafety) {
                window.EditSafety.forceCleanup();
            }
            
            // Reset edit mode
            editMode = {
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
            
            // Update state tracking
            if (window.updateToolState) {
                window.updateToolState('none', 'idle', null, false);
            }
            
        } catch (error) {
            console.error('Rollback error:', error);
        }
    }
    
    // Handle edit operations
    async function handleEditOperation(operation) {
        const { action, shape, shapeType, capabilities } = operation;
        
        switch (action) {
            case 'activate':
                await activateEditModeInternal(shape, shapeType, capabilities);
                break;
            case 'deactivate':
                await exitEditMode();
                break;
            case 'update':
                await updateEditModeInternal(shape, operation.updates);
                break;
            default:
                console.warn('Unknown edit action:', action);
        }
    }
    
    // Update edit mode
    async function updateEditModeInternal(shape, updates) {
        try {
            // Update edit mode state
            Object.keys(updates).forEach(key => {
                if (editMode[key] !== undefined) {
                    editMode[key] = updates[key];
                }
            });
            
            // Update components
            if (window.CustomEditCore) {
                window.CustomEditCore.updateAllComponents(shape);
            }
            
            // Update edit panel
            if (window.EditPanel) {
                window.EditPanel.updateEditPanelMeasurements(shape);
            }
            
        } catch (error) {
            console.error('Edit mode update error:', error);
        }
    }
    
    // Handle component updates
    async function handleComponentUpdate(operation) {
        const { shape, components } = operation;
        
        try {
            // Update components
            if (window.CustomEditCore) {
                window.CustomEditCore.updateAllComponents(shape);
            }
            
        } catch (error) {
            console.error('Component update error:', error);
        }
    }
    
    // Handle state updates
    async function handleStateUpdate(operation) {
        const { updates } = operation;
        
        try {
            // Update app state
            if (window.EditSafety) {
                window.EditSafety.updateAppState(updates);
            }
            
        } catch (error) {
            console.error('State update error:', error);
        }
    }
    
    // Enhanced shape click handler
    function setupShapeClickHandler(shape) {
        // Check if shape exists and has the on method
        if (!shape || typeof shape.on !== 'function') {
            console.warn('Invalid shape provided to setupShapeClickHandler');
            return;
        }
        
        // Remove existing click handlers safely
        try {
            shape.off('click');
        } catch (error) {
            console.warn('Error removing existing click handlers:', error);
        }
        
        // Add new click handler (only on single click, not double click)
        shape.on('click', function(e) {
            // Stop event propagation if possible
            if (e.originalEvent && e.originalEvent.stopPropagation) {
                e.originalEvent.stopPropagation();
            }
            
            // Check if edit mode is already active
            if (editMode.active) {
                console.log('Edit mode already active');
                return;
            }
            
            // Check if dependencies are available
            if (!window.CustomEditCore) {
                console.warn('CustomEditCore not available');
                return;
            }
            
            // Add a small delay to prevent interference with double-click
            setTimeout(() => {
                // Check if edit mode is still not active (double-click might have activated something)
                if (editMode.active) {
                    return;
                }
                
                // Detect shape type and capabilities
                const shapeType = window.CustomEditCore.detectShapeType(shape);
                const capabilities = window.CustomEditCore.getShapeCapabilities(shapeType);
                
                // Activate edit mode
                activateEditMode(shape, shapeType, capabilities);
            }, 200);
        });
    }
    
    // Initialize custom editing system
    function initializeCustomEditing() {
        console.log('🔧 Initializing custom editing system...');
        
        // Wait for dependencies to load
        const checkDependencies = setInterval(() => {
            if (window.EditSafety && window.CustomEditCore && window.EditPanel) {
                clearInterval(checkDependencies);
                console.log('✅ Custom editing system initialized');
            }
        }, 100);
        
        // Set up global error handling
        window.addEventListener('error', function(event) {
            if (editMode.active) {
                console.error('Error during edit mode:', event.error);
                exitEditMode();
            }
        });
        
        // Set up before unload handler
        window.addEventListener('beforeunload', function() {
            if (editMode.active) {
                exitEditMode();
            }
        });
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCustomEditing);
    } else {
        initializeCustomEditing();
    }
    
    // Basic edit panel fallback removed (map-only editing UX)
    
    // Test function for debugging
    function testCustomEditing() {
        console.log('🧪 Testing custom editing system...');
        
        // Check if all dependencies are loaded
        const dependencies = {
            EditSafety: !!window.EditSafety,
            CustomEditCore: !!window.CustomEditCore,
            EditPanel: !!window.EditPanel
        };
        
        console.log('Dependencies loaded:', dependencies);
        
        // Check if we have any shapes on the map
        if (window.map) {
            const layers = [];
            window.map.eachLayer(layer => {
                if (layer._isEditHandle || layer._isRectangleShape || layer._isFenceShape || layer._isCraneShape) {
                    layers.push(layer);
                }
            });
            console.log('Editable shapes found:', layers.length);
        }
        
        // Check edit mode state
        console.log('Current edit mode:', editMode);
        
        return {
            dependencies,
            editMode,
            shapesFound: layers ? layers.length : 0
        };
    }
    
    // Export functions
    if (typeof window !== 'undefined') {
        window.CustomEditing = {
            activateEditMode,
            activateEditModeInternal,
            exitEditMode,
            setupShapeClickHandler,
            getEditMode: () => editMode,
            test: testCustomEditing
        };
    }
})();
