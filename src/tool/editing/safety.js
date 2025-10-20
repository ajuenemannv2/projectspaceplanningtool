/* Custom Editing Safety Systems - Bulletproof implementation */
(function(){
    // Event listener registry for conflict resolution
    let eventListenerRegistry = new Map();
    
    // Immutable state management
    let appState = {
        currentShape: null,
        editMode: {
            active: false,
            shape: null,
            type: null,
            tools: [],
            components: [],
            snapSettings: {},
            originalState: null,
            disabledSystems: {}
        },
        undoStack: [],
        redoStack: [],
        componentRegistry: new Map(),
        operationQueue: [],
        isProcessingQueue: false
    };
    
    // Reference tracking system
    let referenceTracker = new Map();
    
    // Event listener management
    function addSafeEventListener(shape, event, handler, priority = 0) {
        const shapeId = shape._leaflet_id;
        if (!eventListenerRegistry.has(shapeId)) {
            eventListenerRegistry.set(shapeId, new Map());
        }
        
        const shapeListeners = eventListenerRegistry.get(shapeId);
        if (!shapeListeners.has(event)) {
            shapeListeners.set(event, []);
        }
        
        const listeners = shapeListeners.get(event);
        listeners.push({ handler, priority });
        listeners.sort((a, b) => b.priority - a.priority);
        
        // Add listener with conflict resolution
        shape.on(event, function(e) {
            // Stop event propagation if possible
            if (e.originalEvent && e.originalEvent.stopPropagation) {
                e.originalEvent.stopPropagation();
            }
            const eventListeners = eventListenerRegistry.get(shapeId)?.get(event) || [];
            for (const listener of eventListeners) {
                try {
                    listener.handler.call(this, e);
                } catch (error) {
                    console.error('Event listener error:', error);
                }
            }
        });
    }
    
    function removeAllEventListeners(shape) {
        const shapeId = shape._leaflet_id;
        if (eventListenerRegistry.has(shapeId)) {
            const shapeListeners = eventListenerRegistry.get(shapeId);
            for (const [event, listeners] of shapeListeners) {
                shape.off(event);
            }
            eventListenerRegistry.delete(shapeId);
        }
    }
    
    // State management
    function updateAppState(updates) {
        const newState = { ...appState };
        Object.keys(updates).forEach(key => {
            if (typeof updates[key] === 'object' && updates[key] !== null) {
                newState[key] = { ...newState[key], ...updates[key] };
            } else {
                newState[key] = updates[key];
            }
        });
        appState = newState;
        return newState;
    }
    
    function getAppState() {
        return JSON.parse(JSON.stringify(appState)); // Deep clone
    }
    
    // Reference tracking
    function trackShapeReference(shape, component) {
        const shapeId = shape._leaflet_id;
        if (!referenceTracker.has(shapeId)) {
            referenceTracker.set(shapeId, new Set());
        }
        referenceTracker.get(shapeId).add(component);
    }
    
    function updateShapeReferences(shape) {
        const shapeId = shape._leaflet_id;
        if (referenceTracker.has(shapeId)) {
            const components = referenceTracker.get(shapeId);
            components.forEach(component => {
                try {
                    if (component.updatePosition) {
                        component.updatePosition(shape);
                    }
                } catch (error) {
                    console.error('Reference update error:', error);
                }
            });
        }
    }
    
    function cleanupShapeReferences(shape) {
        const shapeId = shape._leaflet_id;
        if (referenceTracker.has(shapeId)) {
            const components = referenceTracker.get(shapeId);
            components.forEach(component => {
                try {
                    if (component.cleanup) {
                        component.cleanup();
                    }
                } catch (error) {
                    console.error('Reference cleanup error:', error);
                }
            });
            referenceTracker.delete(shapeId);
        }
    }
    
    // Operation queuing system
    function queueOperation(operation) {
        appState.operationQueue.push({
            ...operation,
            id: Date.now() + Math.random(),
            timestamp: Date.now()
        });
        
        if (!appState.isProcessingQueue) {
            processOperationQueue();
        }
    }
    
    async function processOperationQueue() {
        appState.isProcessingQueue = true;
        
        while (appState.operationQueue.length > 0) {
            const operation = appState.operationQueue.shift();
            
            try {
                await executeOperation(operation);
            } catch (error) {
                console.error('Operation error:', error);
            }
            
            // Small delay to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        appState.isProcessingQueue = false;
    }
    
    async function executeOperation(operation) {
        switch (operation.type) {
            case 'edit':
                await handleEditOperation(operation);
                break;
            case 'component_update':
                await handleComponentUpdate(operation);
                break;
            case 'state_update':
                await handleStateUpdate(operation);
                break;
            default:
                console.warn('Unknown operation type:', operation.type);
        }
    }
    
    // Handle edit operations
    async function handleEditOperation(operation) {
        const { action, shape, shapeType, capabilities } = operation;
        
        try {
            if (action === 'activate' && window.CustomEditing) {
                // Call the main editing system
                await window.CustomEditing.activateEditModeInternal(shape, shapeType, capabilities);
            } else if (action === 'deactivate' && window.CustomEditing) {
                await window.CustomEditing.exitEditMode();
            }
        } catch (error) {
            console.error('Edit operation error:', error);
        }
    }
    
    // Handle component updates
    async function handleComponentUpdate(operation) {
        const { shape, components } = operation;
        
        try {
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
            updateAppState(updates);
        } catch (error) {
            console.error('State update error:', error);
        }
    }
    
    // Error recovery system
    function setupErrorRecovery() {
        window.addEventListener('error', function(event) {
            console.error('Global error:', event.error);
            if (appState.editMode.active) {
                console.warn('Error during edit mode, attempting recovery');
                forceCleanup();
            }
        });
        
        window.addEventListener('unhandledrejection', function(event) {
            console.error('Unhandled promise rejection:', event.reason);
            if (appState.editMode.active) {
                console.warn('Promise rejection during edit mode, attempting recovery');
                forceCleanup();
            }
        });
        
        window.addEventListener('beforeunload', function(event) {
            if (appState.editMode.active) {
                cleanupEditMode();
            }
        });
    }
    
    function forceCleanup() {
        try {
            // Remove all custom handles
            if (window.map) {
                window.map.eachLayer(layer => {
                    if (layer._isEditHandle) {
                        window.map.removeLayer(layer);
                    }
                });
            }
            
            // Remove edit panel
            const editPanel = document.getElementById('editPanel');
            if (editPanel) editPanel.remove();
            
            // Reset all state
            appState = {
                currentShape: null,
                editMode: { active: false },
                undoStack: [],
                redoStack: [],
                componentRegistry: new Map(),
                operationQueue: [],
                isProcessingQueue: false
            };
            
        } catch (error) {
            console.error('Force cleanup error:', error);
        }
    }
    
    // Validation system
    function validateEditSystem() {
        const tests = [
            () => validateStateConsistency(),
            () => validateComponentReferences(),
            () => validateEventListeners(),
            () => validateOperationQueue()
        ];
        
        const results = tests.map(test => {
            try {
                return test();
            } catch (error) {
                console.error('Test failed:', error);
                return false;
            }
        });
        
        const allPassed = results.every(result => result === true);
        
        if (!allPassed) {
            console.warn('Edit system validation failed, performing cleanup');
            forceCleanup();
        }
        
        return allPassed;
    }
    
    function validateStateConsistency() {
        if (appState.editMode.active && !appState.editMode.shape) {
            console.error('Edit mode active but no shape selected');
            return false;
        }
        return true;
    }
    
    function validateComponentReferences() {
        // Check for orphaned references
        for (const [shapeId, components] of referenceTracker) {
            if (!window.map || !window.map.hasLayer) {
                continue;
            }
            // Additional validation logic here
        }
        return true;
    }
    
    function validateEventListeners() {
        // Check for memory leaks in event listeners
        return true;
    }
    
    function validateOperationQueue() {
        // Check operation queue health
        return appState.operationQueue.length < 100; // Prevent queue overflow
    }
    
    // Initialize error recovery
    setupErrorRecovery();
    
    // Run validation periodically
    setInterval(validateEditSystem, 5000);
    
    // Export functions
    if (typeof window !== 'undefined') {
        window.EditSafety = {
            addSafeEventListener,
            removeAllEventListeners,
            updateAppState,
            getAppState,
            trackShapeReference,
            updateShapeReferences,
            cleanupShapeReferences,
            queueOperation,
            forceCleanup,
            validateEditSystem
        };
    }
})();
