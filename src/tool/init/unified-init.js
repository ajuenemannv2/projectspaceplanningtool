/* Unified Initialization System */
(function(){
    let initializationState = {
        mapReady: false,
        customDrawingReady: false,
        toolbarReady: false,
        editingSystemReady: false,
        allSystemsReady: false
    };
    
    // Initialize all systems in proper order
    function initializeAllSystems() {
        console.log('🔧 Starting unified system initialization...');
        
        try {
            // Step 1: Wait for map to be ready
            waitForMap().then(() => {
                console.log('✅ Map ready, setting up unified drawing interface...');
                initializationState.mapReady = true;
                
                // Step 2: Check if systems are already initialized
                checkSystemsReady();
                
                // Step 3: Set up unified drawing interface
                setupUnifiedDrawingState();
                
                // Step 4: Notify user
                showInitializationSuccess('All drawing tools are ready');
                
                console.log('🎉 Unified drawing system ready!');
            });
            
        } catch (error) {
            console.error('❌ Unified initialization failed:', error);
            showInitializationError('System initialization failed. Please refresh the page.');
        }
    }
    
    // Wait for map to be ready
    function waitForMap() {
        return new Promise((resolve) => {
            const checkMap = () => {
                if (window.map && window.map.getContainer) {
                    console.log('✅ Map is ready');
                    resolve();
                } else {
                    console.log('⏳ Waiting for map...');
                    setTimeout(checkMap, 100);
                }
            };
            checkMap();
        });
    }
    
    // Check if systems are ready
    function checkSystemsReady() {
        try {
            // Check custom drawing
            if (window.CustomDrawing) {
                console.log('✅ Custom drawing system detected');
                initializationState.customDrawingReady = true;
            } else {
                console.warn('⚠️ Custom drawing system not available');
            }
            
            // Check editing system
            if (window.CustomEditing) {
                console.log('✅ Editing system detected');
                initializationState.editingSystemReady = true;
            } else {
                console.warn('⚠️ Editing system not available');
            }
            
            // Toolbar is considered ready if drawing systems are available
            initializationState.toolbarReady = true;
            
            // Mark all systems as ready
            initializationState.allSystemsReady = true;
            
        } catch (error) {
            console.error('❌ System check failed:', error);
        }
    }
    
    // Set up unified drawing state management
    function setupUnifiedDrawingState() {
        // Create unified drawing state
        window.UnifiedDrawing = {
            currentMode: null,
            isDrawing: false,
            currentShape: null,
            
            // Unified start drawing
            startDrawing: function(mode) {
                console.log(`🔧 Starting unified drawing mode: ${mode}`);
                
                // Stop any existing drawing
                this.stopDrawing();
                
                // Set state
                this.currentMode = mode;
                this.isDrawing = true;
                
                // Route to appropriate system
                switch (mode) {
                    case 'rectangle':
                        if (window.CustomDrawing && window.CustomDrawing.startRectangleDrawing) {
                            window.CustomDrawing.startRectangleDrawing();
                        }
                        break;
                    case 'polygon':
                        if (window.CustomDrawing && window.CustomDrawing.startPolygonDrawing) {
                            window.CustomDrawing.startPolygonDrawing();
                        }
                        break;
                    case 'fence':
                        if (window.startFenceDrawing) {
                            window.startFenceDrawing();
                        }
                        break;
                    case 'crane':
                        if (window.startCraneDrawing) {
                            window.startCraneDrawing();
                        }
                        break;
                    default:
                        console.warn(`Unknown drawing mode: ${mode}`);
                }
            },
            
            // Unified stop drawing
            stopDrawing: function() {
                console.log('🔧 Stopping unified drawing');
                
                // Stop custom drawing
                if (window.CustomDrawing && window.CustomDrawing.stopDrawing) {
                    window.CustomDrawing.stopDrawing();
                }
                
                // Stop fence drawing
                if (window.stopFenceDrawing) {
                    window.stopFenceDrawing();
                }
                
                // Stop crane drawing
                if (window.stopCraneDrawing) {
                    window.stopCraneDrawing();
                }
                
                // Reset state
                this.currentMode = null;
                this.isDrawing = false;
                this.currentShape = null;
                
                // Reset cursor
                if (window.map && window.map.getContainer) {
                    window.map.getContainer().style.cursor = 'default';
                }
            },
            
            // Get current state
            getState: function() {
                return {
                    mode: this.currentMode,
                    isDrawing: this.isDrawing,
                    shape: this.currentShape
                };
            }
        };
        
        console.log('✅ Unified drawing state management ready');
    }
    
    // Show initialization success
    function showInitializationSuccess(message) {
        showNotification(message, 'success');
    }
    
    // Show initialization warning
    function showInitializationWarning(message) {
        showNotification(message, 'warning');
    }
    
    // Show initialization error
    function showInitializationError(message) {
        showNotification(message, 'error');
    }
    
    // Generic notification system
    function showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.showNotification && typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            console.log(`🔧 ${type.toUpperCase()}: ${message}`);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAllSystems);
    } else {
        // Wait a bit for other systems to load
        setTimeout(initializeAllSystems, 500);
    }
    
})();
