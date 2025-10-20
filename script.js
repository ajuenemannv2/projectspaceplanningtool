// Security functions will be loaded via script tag

// ===== GLOBAL DEBUG LOGGER =====
if (typeof window.DEBUG_DRAW === 'undefined') window.DEBUG_DRAW = false;
if (!window.DrawDebug) {
    window.DrawDebug = function(tag, msg, data){
        if (!window.DEBUG_DRAW) return;
        try { console.log(`[DRAW][${tag}] ${msg}`, data || ''); } catch(_) {}
    };
}

// Build crane geometry as a MultiGeometry (pad polygon + sweep polygon + radius line)
// ✅ MIGRATED: buildCraneGeometry moved to src/tool/crane.js
// Global variables
let map;
let drawnItems;
let drawingLayer;
let siteLayoutLayer;
let currentShape = null;
let selectedProject = null; // Will be set from database
let currentProject = null; // Current project object

// Projects will be loaded from database
let PROJECTS = {};

// Clean watermark system - creates watermarks that are bound to shapes and move with them
function updateCurrentShapeWatermark() {
    if (!currentShape) return;
    
    const companyName = document.getElementById('companyName')?.value;
    
    // Remove existing watermark
    removeWatermarkFromShape(currentShape);
    
    if (companyName) {
        // Create watermark as a custom marker that moves with the shape
        createShapeWatermark(currentShape, companyName);
    }
}

// Create a watermark that's bound to a specific shape
function createShapeWatermark(shape, companyName) {
    const bounds = shape.getBounds();
    const center = bounds.getCenter();
    
    // Calculate appropriate font size based on shape size
    const width = bounds.getEast() - bounds.getWest();
    const height = bounds.getNorth() - bounds.getSouth();
    const area = width * height;
    
    let fontSize = 16;
    if (area < 0.00005) fontSize = 10;      // Very small shapes
    else if (area < 0.0001) fontSize = 12;    // Small shapes
    else if (area < 0.0005) fontSize = 14;  // Medium-small shapes
    else if (area < 0.001) fontSize = 16;   // Medium shapes
    else if (area < 0.005) fontSize = 18;    // Large shapes
    else fontSize = 20;                      // Very large shapes
    
    // Create a custom marker that will move with the shape
    const watermarkMarker = L.marker(center, {
        icon: L.divIcon({
            className: 'watermark-marker',
            html: `
                <div class="watermark-content" style="
                    transform: rotate(45deg);
                    color: #ffffff;
                    font-size: ${fontSize}px;
                    font-weight: bold;
                    opacity: 0.6;
                    pointer-events: none;
                    white-space: nowrap;
                    text-shadow: 
                        -1px -1px 0 #000000,
                        1px -1px 0 #000000,
                        -1px 1px 0 #000000,
                        1px 1px 0 #000000,
                        0 0 3px rgba(0,0,0,0.8);
                    text-align: center;
                    background: transparent;
                    border: none;
                    box-shadow: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                ">${companyName}</div>
            `,
            iconSize: [120, 60],
            iconAnchor: [60, 30]
        })
    });
    
    // Add to map
    watermarkMarker.addTo(map);
    
    // Store reference for cleanup
    if (!window.watermarkMarkers) {
        window.watermarkMarkers = [];
    }
    window.watermarkMarkers.push(watermarkMarker);
    
    // Store the watermark marker on the shape for easy removal
    shape._watermarkMarker = watermarkMarker;
}

// Remove watermark from a specific shape
function removeWatermarkFromShape(shape) {
    if (shape._watermarkMarker) {
        map.removeLayer(shape._watermarkMarker);
        shape._watermarkMarker = null;
    }
}

// Clean up function
function cleanupDebugElements() {
    console.log('🧹 Cleaned up debugging elements');
}

// Default project configuration (fallback)
const DEFAULT_PROJECT = {
    name: 'Default Project',
        coordinates: [45.5442515697061, -122.91389689455964],
        zoom: 16
};

// These will be loaded from the database
let COMPANIES = [];
let SPACE_CATEGORIES = [];

// Supabase configuration (provided by config/public-supabase-config.js)
const SUPABASE_CONFIG = window.SUPABASE_CONFIG;

// Initialize Supabase client (will be loaded via CDN)
let supabaseClient = null;

// Configuration
const CONFIG = {
    // Default map center (will be updated after admin data loads)
    defaultCenter: [45.5442515697061, -122.91389689455964], // Fallback to Ronler coordinates
    defaultZoom: 16, // Fallback zoom
    // Power Automate endpoint (you'll need to replace this with your actual endpoint)
    powerAutomateEndpoint: 'https://your-tenant.flow.microsoft.com/webhook/your-webhook-id',
    // Zoom threshold where we switch between satellite and street
    // Lower value => street view activates further out (smaller zoom numbers)
    streetSwitchZoom: 17
};

// UI style settings
function getUIStyleSettings() {
    try {
        const raw = localStorage.getItem('ui_style_settings');
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed || {};
    } catch(_) { return {}; }
}
function getStyleOrDefault(key, fallback) {
    const s = getUIStyleSettings();
    return (s && Object.prototype.hasOwnProperty.call(s, key) && s[key]) ? s[key] : fallback;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Application starting...');
    
    // Show loading animation
    showLoadingAnimation();
    // Global error banner (delegate to ToolUI when available)
    if (window.ToolUI && typeof window.ToolUI.initGlobalErrorBanner === 'function') {
        try { window.ToolUI.initGlobalErrorBanner(); } catch(_) {}
    }
    function showError(message, retryFn) {
        if (window.ToolUI && typeof window.ToolUI.showError === 'function') {
            return window.ToolUI.showError(message, retryFn);
        }
        // Fallback minimal behavior if ToolUI not loaded
        const banner = document.getElementById('globalErrorBanner');
        const text = document.getElementById('globalErrorText');
        const retry = document.getElementById('globalErrorRetry');
        const dismiss = document.getElementById('globalErrorDismiss');
        if (text) text.textContent = message || 'An error occurred.';
        if (banner) banner.style.display = 'block';
        if (retry) retry.onclick = function(){ hideError(); try { retryFn && retryFn(); } catch(_) {} };
        if (dismiss) dismiss.onclick = hideError;
    }
    function hideError() {
        if (window.ToolUI && typeof window.ToolUI.hideError === 'function') {
            return window.ToolUI.hideError();
        }
        const banner = document.getElementById('globalErrorBanner');
        if (banner) banner.style.display = 'none';
    }
    
    try {
    console.log('L.GeometryUtil available:', typeof L !== 'undefined' && L.GeometryUtil);
    initializeMap();
    initializeEventListeners();
    
        // Initialize Supabase client with gating
        if (typeof supabase === 'undefined') {
            console.warn('⚠️ Supabase not loaded');
            showError('Configuration error: Supabase library not loaded. Data cannot be fetched. Check network/CDN and reload.', () => window.location.reload());
        } else if (!SUPABASE_CONFIG || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
            console.warn('⚠️ Supabase config missing');
            showError('Configuration error: Supabase settings not found. Ensure config/public-supabase-config.js is included with a valid URL and anon key.', () => window.location.reload());
        } else {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log('✅ Supabase client initialized');
        }
        
        // Load projects from database
        const loadProjectsAttempt = async () => {
        await loadProjectsFromDatabase();
        };
        try {
            await loadProjectsAttempt();
        } catch (e) {
            console.error('❌ Failed to load projects:', e);
            showError("Can't reach the database right now. Check your internet or credentials, then retry.", loadProjectsAttempt);
            throw e;
        }
        
        // Load admin data and populate dropdowns
    loadAdminData(); // Load admin data and integrate
        loadCategoriesFromDatabase(); // Load space categories from database
        loadCompaniesFromDatabase(); // Load companies from database
    populateCompanyDropdown();
    populateProjectDropdown(); // Populate project dropdown with database data
    
    // Restore saved or deep-linked project selection and update map
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
        const projectKeys = Object.keys(PROJECTS);
        if (projectKeys.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const savedProject = params.get('project') || localStorage.getItem('selected_project_id');
            const savedZoom = params.get('zoom') || localStorage.getItem('selected_project_zoom');
            const firstKey = projectKeys[0];
            const targetKey = (savedProject && PROJECTS[savedProject]) ? savedProject : firstKey;
            projectSelect.value = targetKey;
            try { navigateToProject(targetKey); } catch(_) {}
            try {
                if (window.ToolSelection && typeof window.ToolSelection.persistProject === 'function') {
                    const z = (typeof map !== 'undefined' && map && typeof map.getZoom === 'function') ? map.getZoom() : (currentProject?.zoom || CONFIG?.defaultZoom || 16);
                    window.ToolSelection.persistProject(targetKey, z);
                }
            } catch(_) {}
            try {
                const proj = PROJECTS[targetKey];
                if (window.ToolUI && typeof window.ToolUI.setCurrentProjectName === 'function') {
                    window.ToolUI.setCurrentProjectName(proj && proj.name);
            } else {
                    updateCurrentProjectBanner(targetKey);
                }
            } catch(_) {}
            // Apply zoom override if provided
            if (savedZoom && map) {
                const z = parseInt(savedZoom, 10);
                if (!isNaN(z)) { try { map.setZoom(z); } catch(_) {} }
            }
            // Load phases for the selected (or default) project
            populatePhaseCheckboxes(targetKey);
            try {
                if (window.ToolPhases && typeof window.ToolPhases.restoreForProject === 'function') {
                    window.ToolPhases.restoreForProject(targetKey);
                    if (window.ToolSpaces && typeof window.ToolSpaces.refresh === 'function') window.ToolSpaces.refresh();
                }
            } catch(_) {}
        }
    }
    
    await loadSiteLayout();
    updateDrawingStatus('Ready to draw');
    console.log('Application initialized');
    } catch (error) {
        console.error('❌ Error initializing application:', error);
    } finally {
        // Hide loading animation
        hideLoadingAnimation();
    }
});

// Initialize Leaflet map
function initializeMap() {
    // Create map instance with higher max zoom
    map = L.map('map', {
        maxZoom: 22,
        minZoom: 10,
        preferCanvas: true,
        renderer: L.canvas({ padding: 1.0 }) // expanded padding (~2x) to further reduce edge clipping
    }).setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    
    // Make map globally available for other systems
    window.map = map;
    
    // Base layers
    let satelliteLayer, streetLayer, hybridLayer, baseMaps;
    if (window.ToolMap && typeof window.ToolMap.makeBaseLayers === 'function') {
        try {
            const layers = window.ToolMap.makeBaseLayers(map);
            satelliteLayer = layers.satelliteLayer;
            streetLayer = layers.streetLayer;
            hybridLayer = layers.hybridLayer;
            baseMaps = layers.baseMaps;
        } catch(_) {}
    }
    if (!satelliteLayer || !streetLayer || !baseMaps) {
        // Fallback to inline definitions
        satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { attribution: '© Google Satellite', maxZoom: 22 });
        streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 });
        hybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { attribution: '© Google Hybrid', maxZoom: 22 });
        baseMaps = { "Satellite": satelliteLayer, "Hybrid": hybridLayer, "Street": streetLayer };
    }
    
    // Add satellite layer by default
    satelliteLayer.addTo(map);
    
    // Add layer control
    L.control.layers(baseMaps).addTo(map);
    
    // Add real-time measurement system
    addRealTimeMeasurements();
    
    // Auto-switch between satellite/hybrid and street view based on zoom level
    if (window.ToolMap && typeof window.ToolMap.attachAutoSwitch === 'function') {
        try { window.ToolMap.attachAutoSwitch(map, satelliteLayer, streetLayer, hybridLayer); } catch(_) {}
    } else {
    map.on('zoomend', function() {
        const currentZoom = map.getZoom();
            const switchZoom = (window.ToolMap && typeof window.ToolMap.getSwitchZoom === 'function') 
                ? window.ToolMap.getSwitchZoom() 
                : (CONFIG?.streetSwitchZoom ?? 15);
            const currentLayer = (window.ToolMap && typeof window.ToolMap.currentBase === 'function')
                ? window.ToolMap.currentBase(map, satelliteLayer, hybridLayer)
                : (map.hasLayer(satelliteLayer) ? 'satellite' : (map.hasLayer(hybridLayer) ? 'hybrid' : 'street'));
            
            if (currentLayer === 'street' && currentZoom > switchZoom) {
            map.removeLayer(streetLayer);
            satelliteLayer.addTo(map);
            updateDrawingStatus('Switched to satellite view for higher zoom');
            } else if ((currentLayer === 'satellite' || currentLayer === 'hybrid') && currentZoom <= switchZoom) {
                if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
                if (map.hasLayer(hybridLayer)) map.removeLayer(hybridLayer);
            streetLayer.addTo(map);
            updateDrawingStatus('Switched to street view');
        }
    });
    }
    
    // Initialize drawing layer
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    // Initialize cranes layer (separate from staging shapes)
    window.cranesLayer = new L.FeatureGroup();
    map.addLayer(window.cranesLayer);
    
    // DISABLED: Old Leaflet.Draw toolbar - replaced with custom Revit-style toolbar
    // const drawControl = new L.Control.Draw({...});
    // window.drawControl = drawControl;
    // map.addControl(drawControl);
    
    // Create a minimal draw control for compatibility but don't add it to map
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: false,
            rectangle: false,
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: false
        }
    });
    
    // Store draw control globally for compatibility but don't add to map
    window.drawControl = drawControl;
    // map.addControl(drawControl); // DISABLED - using custom toolbar instead
    
    // DISABLED: Old toolbar buttons - replaced with custom Revit-style toolbar
    // addUndoButtonToToolbar();
    // addFenceButtonToToolbar();
    // addCraneButtonToToolbar();
    // Try injecting caution pattern shortly after map init
    setTimeout(() => { try { injectCautionPattern(); } catch(_) {} }, 250);
    // Try injecting caution pattern shortly after map init
    setTimeout(injectCautionPattern, 250);
    
    // Drawing event listeners
    map.on('draw:created', function(e){ DrawDebug('LIFECYCLE','draw:created', e); onShapeCreated(e); });
    map.on('draw:edited', function(e){ DrawDebug('LIFECYCLE','draw:edited', e); onShapeEdited(e); });
    map.on('draw:deleted', function(e){ DrawDebug('LIFECYCLE','draw:deleted', e); onShapeDeleted(e); });
    map.on('draw:drawstart', function(e){ DrawDebug('LIFECYCLE','draw:drawstart', e); onDrawStart(e); });
    map.on('draw:drawstop', function(e){ DrawDebug('LIFECYCLE','draw:drawstop', e); onDrawStop(e); });
    map.on('draw:drawing', function(e){ DrawDebug('LIFECYCLE','draw:drawing', e); onDrawing(e); }); // Real-time drawing events
}

// Loading Animation Functions
function showLoadingAnimation() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = `
        <div class="loading-container">
            <div class="loading-text">Loading Project Space Planning Tool</div>
            <div class="brick-wall" id="brickWall"></div>
            <div class="loading-dots"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    startBrickAnimation();
}

function hideLoadingAnimation() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

function startBrickAnimation() {
    const brickWall = document.getElementById('brickWall');
    if (!brickWall) return;

    // Prepare high-DPI canvas for smooth, jank-free animation
            brickWall.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.width = '200px';
    canvas.style.height = '240px';
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = 200 * dpr;
    canvas.height = 240 * dpr;
    brickWall.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Brick layout
    const rows = 5;
    const perRow = 4;
    const bw = 40;
    const bh = 20;
    const rowOffset = bw / 2;
    const total = rows * perRow;

    // Timings
    const appearMs = 110; // time between bricks
    const riseMs = 220;   // rise animation duration per brick
    const resetDelay = 700;

    let start = performance.now();
    let rafId = 0;

    const ease = t => t < 0 ? 0 : t > 1 ? 1 : (1 - Math.cos(Math.PI * t)) / 2; // cosine ease

    function draw(now) {
        const t = now - start;
        // Smooth background clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw built bricks
        for (let i = 0; i < total; i++) {
            const row = Math.floor(i / perRow);
            const col = i % perRow;
            const x = col * bw + (row % 2) * rowOffset;
            const y = row * bh;

            const appearAt = i * appearMs;
            const prog = ease((t - appearAt) / riseMs);
            if (prog <= 0) continue;

            // Brick body with subtle gradient
            const grad = ctx.createLinearGradient(x, y, x + bw, y + bh);
            grad.addColorStop(0, '#1e40af');
            grad.addColorStop(1, '#3b82f6');
            ctx.fillStyle = grad;
            ctx.strokeStyle = '#172554';
            ctx.lineWidth = 2;

            const yy = y - (1 - prog) * 18; // rise from above
            ctx.beginPath();
            ctx.rect(Math.round(x) + 1, Math.round(yy) + 1, bw - 2, bh - 2);
            ctx.fill();
            ctx.stroke();

            // highlight mortar lines
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(Math.round(x) + 3, Math.round(yy) + 4, bw - 6, 3);
        }

        // Restart once wall is completed
        if (t > total * appearMs + riseMs + resetDelay) {
            start = now;
        }
        rafId = requestAnimationFrame(draw);
    }

    // Start rAF loop and store id for cleanup if needed
    try { cancelAnimationFrame(brickWall._rafId); } catch(_) {}
    brickWall._rafId = requestAnimationFrame(draw);
}

// Populate company dropdown
function populateCompanyDropdown() {
    console.log('🔧 Populating company dropdown with:', COMPANIES);
    
    const companySelect = document.getElementById('companyName');
    if (companySelect) {
        // Clear existing options
        companySelect.innerHTML = '<option value="">Select your company</option>';
        
        // Add company options
        COMPANIES.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            companySelect.appendChild(option);
        });
        
        console.log('🔧 Company dropdown populated with', COMPANIES.length, 'companies');
    } else {
        console.error('🔧 Company select element not found!');
    }
}

// Navigate to selected project
function navigateToProject(projectKey) {
    const project = PROJECTS[projectKey];
    if (project) {
        selectedProject = projectKey;
        currentProject = project;
        try { localStorage.setItem('selected_project_id', String(projectKey)); } catch(_) {}
        
        // Validate coordinates before setting map view
        if (project.coordinates && project.coordinates.length === 2) {
            const [lat, lng] = project.coordinates;
            if (!isNaN(lat) && !isNaN(lng)) {
                map.setView(project.coordinates, project.zoom);
                updateDrawingStatus(`Navigated to ${project.name} project`);
            } else {
                console.warn(`⚠️ Invalid coordinates for project "${project.name}":`, project.coordinates);
                updateDrawingStatus(`Project "${project.name}" has invalid coordinates`);
            }
        } else {
            console.warn(`⚠️ Missing coordinates for project "${project.name}":`, project.coordinates);
            updateDrawingStatus(`Project "${project.name}" has missing coordinates`);
        }
        
        // Update project selection dropdown
        const projectSelect = document.getElementById('projectSelect');
        if (projectSelect) {
            projectSelect.value = projectKey;
        }
        
        // Load saved spaces for this project
        loadProjectSpaces();
    }
}

// Navigate to Logistics Map carrying the selected project across pages
function goToLogisticsMap(event) {
    if (event) event.preventDefault();
    try {
        const projectId = selectedProject || document.getElementById('projectSelect')?.value;
        if (projectId) localStorage.setItem('selected_project_id', String(projectId));
        // capture current zoom to keep presentation parity
        let zoom = null;
        try {
            zoom = (typeof map !== 'undefined' && map && typeof map.getZoom === 'function') ? map.getZoom() : null;
        } catch(_) {}
        if (!zoom && currentProject && currentProject.zoom) {
            zoom = currentProject.zoom;
        } else if (!zoom) {
            zoom = CONFIG?.defaultZoom || 16;
        }
        if (zoom) {
            localStorage.setItem('selected_project_zoom', String(zoom));
        }
        const url = projectId ? `logistics-map.html?project=${encodeURIComponent(projectId)}${zoom ? `&zoom=${encodeURIComponent(zoom)}` : ''}` : 'logistics-map.html';
        window.location.href = url;
    } catch(_) {
        window.location.href = 'logistics-map.html';
    }
}

// ============================================================================
// TOPOJSON COORDINATE TRANSFORMATION SYSTEM
// ============================================================================

/**
 * Debug logging system for TopoJSON operations
 */
const TopoJSONDebug = {
    enabled: true,
    log: function(message, data = null) {
        if (this.enabled) {
            console.log(`🔧 [TopoJSON] ${message}`, data || '');
        }
    },
    error: function(message, error = null) {
        if (this.enabled) {
            console.error(`❌ [TopoJSON Error] ${message}`, error || '');
        }
    },
    warn: function(message, data = null) {
        if (this.enabled) {
            console.warn(`⚠️ [TopoJSON Warning] ${message}`, data || '');
        }
    }
};

/**
 * TopoJSON Coordinate Transformation System
 */
class TopoJSONTransformer {
    constructor() {
        this.originalTopoJSON = null;
        this.transform = null;
        this.scale = null;
        this.translate = null;
        this.arcsCount = 0;
    }

    /**
     * Initialize the transformer with the original TopoJSON
     */
    initialize(originalTopoJSON) {
        TopoJSONDebug.log('Initializing TopoJSON transformer');
        
        if (!originalTopoJSON || !originalTopoJSON.transform) {
            TopoJSONDebug.error('Invalid TopoJSON structure - missing transform');
            return false;
        }

        this.originalTopoJSON = originalTopoJSON;
        this.transform = originalTopoJSON.transform;
        this.scale = this.transform.scale;
        this.translate = this.transform.translate;
        this.arcsCount = originalTopoJSON.arcs ? originalTopoJSON.arcs.length : 0;

        TopoJSONDebug.log('Transform initialized', {
            scale: this.scale,
            translate: this.translate,
            arcsCount: this.arcsCount
        });

        // Test the transformation with a known coordinate
        const testCoord = this.transformCoordinates(45.5442515697061, -122.91389689455964);
        TopoJSONDebug.log('Test transformation for Ronler coordinates', {
            input: { lat: 45.5442515697061, lng: -122.91389689455964 },
            output: testCoord
        });

        return true;
    }

    /**
     * Transform WGS84 coordinates to TopoJSON coordinate system
     */
    transformCoordinates(lat, lng) {
        if (!this.scale || !this.translate) {
            TopoJSONDebug.error('Transformer not initialized');
            return null;
        }

        // Apply inverse transform: (coord - translate) / scale
        const x = Math.round((lng - this.translate[0]) / this.scale[0]);
        const y = Math.round((lat - this.translate[1]) / this.scale[1]);

        return [x, y];
    }

    /**
     * Create proper TopoJSON arcs from coordinates
     */
    createArcs(coordinates) {
        if (!coordinates || coordinates.length < 3) {
            TopoJSONDebug.error('Invalid coordinates for arc creation', coordinates);
            return null;
        }

        TopoJSONDebug.log('Creating arcs from coordinates', coordinates);

        const arcPoints = [];
        let previousPoint = null;

        for (let i = 0; i < coordinates.length; i++) {
            const coord = coordinates[i];
            const transformedPoint = this.transformCoordinates(coord[1], coord[0]); // lat, lng

            if (!transformedPoint) {
                TopoJSONDebug.error('Failed to transform coordinate', coord);
                return null;
            }

            if (previousPoint === null) {
                // First point: absolute coordinates
                arcPoints.push(transformedPoint);
                TopoJSONDebug.log('First arc point (absolute)', transformedPoint);
            } else {
                // Subsequent points: relative differences from the previous absolute point
                const deltaX = transformedPoint[0] - previousPoint[0];
                const deltaY = transformedPoint[1] - previousPoint[1];
                arcPoints.push([deltaX, deltaY]);
                TopoJSONDebug.log('Arc point (relative)', [deltaX, deltaY]);
            }

            previousPoint = transformedPoint;
        }

        // Ensure the polygon closes by adding a segment back to the first point
        if (arcPoints.length > 0) {
            const firstPoint = arcPoints[0];
            const lastTransformedPoint = this.transformCoordinates(
                coordinates[coordinates.length - 1][1], 
                coordinates[coordinates.length - 1][0]
            );
            
            const closingDeltaX = firstPoint[0] - lastTransformedPoint[0];
            const closingDeltaY = firstPoint[1] - lastTransformedPoint[1];
            
            // Only add if it's not already closed
            if (closingDeltaX !== 0 || closingDeltaY !== 0) {
                arcPoints.push([closingDeltaX, closingDeltaY]);
                TopoJSONDebug.log('Added closing arc segment', [closingDeltaX, closingDeltaY]);
            }
        }

        // Return as a single arc array (not multiple separate arcs)
        const arcs = [arcPoints];

        TopoJSONDebug.log('Created arcs successfully', {
            arcCount: arcs.length,
            arcPointsCount: arcPoints.length,
            arcs: arcs
        });

        return arcs;
    }

    /**
     * Create geometry object for the staging request
     */
    createStagingGeometry(arcs, properties) {
        if (!arcs || arcs.length === 0) {
            TopoJSONDebug.error('No arcs provided for geometry creation');
            return null;
        }

        // Since arcs is now an array containing a single arc array, we only need one index
        const arcIndex = this.arcsCount;

        const geometry = {
            type: "Polygon",
            arcs: [[arcIndex]],
            properties: properties
        };

        TopoJSONDebug.log('Created staging geometry', {
            geometry: geometry,
            arcIndex: arcIndex,
            arcCount: arcs.length
        });

        return geometry;
    }

    /**
     * Integrate new geometry into the existing TopoJSON
     */
    integrateGeometry(newGeometry, newArcs) {
        if (!this.originalTopoJSON || !newGeometry || !newArcs) {
            TopoJSONDebug.error('Missing required data for integration');
            return null;
        }

        TopoJSONDebug.log('Integrating new geometry into TopoJSON');

        // Create a deep copy of the original TopoJSON
        const integratedTopoJSON = JSON.parse(JSON.stringify(this.originalTopoJSON));

        // Add new arcs to the arcs array (newArcs is now an array containing arc arrays)
        integratedTopoJSON.arcs.push(...newArcs);

        // Add new geometry to the existing "Test Split V2" object instead of creating a separate object
        if (integratedTopoJSON.objects["Test Split V2"] && 
            integratedTopoJSON.objects["Test Split V2"].geometries) {
            
            integratedTopoJSON.objects["Test Split V2"].geometries.push(newGeometry);
            
            TopoJSONDebug.log('Integration completed', {
                totalArcs: integratedTopoJSON.arcs.length,
                totalGeometries: integratedTopoJSON.objects["Test Split V2"].geometries.length,
                newArcsAdded: newArcs.length,
                lastFewArcs: integratedTopoJSON.arcs.slice(-3),
                newGeometryArcs: newGeometry.arcs
            });
        } else {
            TopoJSONDebug.error('Could not find "Test Split V2" object or geometries array');
            return null;
        }

        return integratedTopoJSON;
    }

    /**
     * Validate the integrated TopoJSON structure
     */
    validateTopoJSON(topoJSON) {
        if (!topoJSON) {
            TopoJSONDebug.error('TopoJSON is null or undefined');
            return false;
        }

        const requiredFields = ['type', 'arcs', 'transform', 'objects'];
        for (const field of requiredFields) {
            if (!topoJSON[field]) {
                TopoJSONDebug.error(`Missing required field: ${field}`);
                return false;
            }
        }

        if (topoJSON.type !== 'Topology') {
            TopoJSONDebug.error('Invalid TopoJSON type', topoJSON.type);
            return false;
        }

        if (!Array.isArray(topoJSON.arcs)) {
            TopoJSONDebug.error('Arcs field is not an array');
            return false;
        }

        TopoJSONDebug.log('TopoJSON validation passed', {
            type: topoJSON.type,
            arcsCount: topoJSON.arcs.length,
            objectsCount: Object.keys(topoJSON.objects).length
        });

        return true;
    }
}

// Global transformer instance
const topoJSONTransformer = new TopoJSONTransformer();

/**
 * Load the original TopoJSON file for reference
 */
async function loadSiteLayout() {
    try {
        TopoJSONDebug.log('Loading original TopoJSON file');
        
        const response = await fetch('construction-campusog.json');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const topoJSON = await response.json();
        
        // Store the original TopoJSON globally
        window.originalTopoJSON = topoJSON;
        
        // Initialize the transformer
        if (!topoJSONTransformer.initialize(topoJSON)) {
            throw new Error('Failed to initialize TopoJSON transformer');
        }
        
        TopoJSONDebug.log('Original TopoJSON loaded successfully', {
            arcsCount: topoJSON.arcs.length,
            objectsCount: Object.keys(topoJSON.objects).length
        });
        
    } catch (error) {
        TopoJSONDebug.error('Error loading TopoJSON reference', error);
        console.error('Error loading TopoJSON reference:', error);
    }
}

// Load phases for a specific project
async function loadProjectPhases(projectId) {
    try {
        console.log('🔧 Loading phases for project:', projectId);
        
        if (!supabaseClient || !projectId) {
            console.warn('⚠️ Supabase client not available or no project selected');
            return [];
        }
        
        const { data: phases, error } = await supabaseClient
            .from('project_phases')
            .select('*')
            .eq('project_id', projectId)
            .order('phase_order', { ascending: true });
        
        if (error) {
            console.error('❌ Error loading phases:', error);
            logSecurityEvent('DATABASE_ERROR', 'Failed to load project phases', { 
                error: error.message, 
                projectId 
            });
            return [];
        }
        
        console.log('✅ Phases loaded successfully:', phases?.length || 0);
        return phases || [];
        
    } catch (error) {
        console.error('❌ Error loading project phases:', error);
        return [];
    }
}

// Populate phase checkboxes
async function populatePhaseCheckboxes(projectId) {
    const phaseContainer = document.getElementById('projectPhases');
    if (!phaseContainer) {
        console.error('🔧 Phase container not found!');
        return;
    }
    
    // Show loading state
    phaseContainer.innerHTML = '<div class="phase-loading">Loading phases...</div>';
    
    try {
        const phases = await loadProjectPhases(projectId);
        
        if (phases.length === 0) {
            phaseContainer.innerHTML = '<div class="phase-empty">No phases available for this project</div>';
            return;
        }
        
        // Clear container and add checkboxes
        phaseContainer.innerHTML = '';
        
        phases.forEach(phase => {
            const checkboxItem = document.createElement('div');
            checkboxItem.className = 'phase-checkbox-item';
            
            checkboxItem.innerHTML = `
                <input type="checkbox" id="phase_${phase.id}" value="${phase.id}" name="projectPhases">
                <label for="phase_${phase.id}">${phase.name}</label>
            `;
            
            phaseContainer.appendChild(checkboxItem);
        });
        
        console.log('✅ Phase checkboxes populated:', phases.length);
        // Restore previously selected phases for this project if available
        try {
            const saved = localStorage.getItem('selected_phase_ids');
            const savedProject = localStorage.getItem('selected_project_id');
            const ids = saved ? JSON.parse(saved) : [];
            if (String(savedProject) === String(projectId) && Array.isArray(ids) && ids.length > 0) {
                ids.forEach(id => {
                    const cb = document.getElementById(`phase_${id}`);
                    if (cb) cb.checked = true;
                });
            }
        } catch(_) {}

        // Ensure map reflects restored selections immediately
        try { loadProjectSpaces(); } catch(_) {}
        
    } catch (error) {
        console.error('❌ Error populating phase checkboxes:', error);
        phaseContainer.innerHTML = '<div class="phase-empty">Error loading phases</div>';
    }
}

// Get selected phases
function getSelectedPhases() {
    const checkboxes = document.querySelectorAll('input[name="projectPhases"]:checked');
    return Array.from(checkboxes).map(checkbox => checkbox.value);
}

// Get selected phase names for display
function getSelectedPhaseNames() {
    const checkboxes = document.querySelectorAll('input[name="projectPhases"]:checked');
    return Array.from(checkboxes).map(checkbox => {
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        return label ? label.textContent : checkbox.value;
    });
}

// Load projects from Supabase database
async function loadProjectsFromDatabase() {
    try {
        console.log('🔧 Loading projects from database...');
        
        if (!supabaseClient) {
            console.warn('⚠️ Supabase client not available, using fallback data');
            // Use fallback data
            PROJECTS = {
                'default': {
                    id: 'default',
                    name: 'Default Project',
                    coordinates: [45.5442515697061, -122.91389689455964],
                    zoom: 16,
                    status: 'active'
                }
            };
            return;
        }
        
        const { data: projects, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error loading projects:', error);
            throw error;
        }
        
        // Clear existing projects
        PROJECTS = {};
        
        // Add projects from database
        if (projects && projects.length > 0) {
            projects.forEach(project => {
                console.log(`🔧 Processing project from database:`, project);
                console.log(`🔧 Raw latitude:`, project.latitude, typeof project.latitude);
                console.log(`🔧 Raw longitude:`, project.longitude, typeof project.longitude);
                
                // Handle both coordinate formats: array [lat, lng] or separate lat/lng fields
                let coordinates;
                
                if (project.coordinates && Array.isArray(project.coordinates) && project.coordinates.length === 2) {
                    // Database has coordinates as array [lat, lng]
                    coordinates = project.coordinates;
                    console.log(`🔧 Using coordinates array:`, coordinates);
                } else if (project.latitude !== undefined && project.longitude !== undefined) {
                    // Database has separate latitude/longitude fields
                    const lat = parseFloat(project.latitude);
                    const lng = parseFloat(project.longitude);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        coordinates = [lat, lng];
                        console.log(`🔧 Using lat/lng fields:`, coordinates);
                    }
                }
                
                // Validate coordinates
                if (!coordinates || coordinates.length !== 2 || isNaN(coordinates[0]) || isNaN(coordinates[1])) {
                    console.warn(`⚠️ Invalid coordinates for project "${project.name}":`, coordinates);
                    coordinates = [45.5442515697061, -122.91389689455964]; // Default coordinates
                }
                
                PROJECTS[project.id] = {
                    id: project.id,
                    name: project.name,
                    coordinates: coordinates,
                    zoom: project.zoom_level || 16,
                    status: project.status,
                    description: project.description
                };
                console.log(`🔧 Added project ${project.id}:`, PROJECTS[project.id]);
                console.log(`🔧 Final coordinates array:`, PROJECTS[project.id].coordinates);
            });
        } else {
            console.warn('⚠️ No projects found in database, using fallback');
            // Use fallback data
            PROJECTS = {
                'default': {
                    id: 'default',
                    name: 'Default Project',
                    coordinates: [45.5442515697061, -122.91389689455964],
                    zoom: 16,
                    status: 'active'
                }
            };
        }
        
        console.log('✅ Projects loaded successfully:', Object.keys(PROJECTS).length);
        
    } catch (error) {
        console.error('❌ Error loading projects from database:', error);
        // Use fallback data
        PROJECTS = {
            'default': {
                id: 'default',
                name: 'Default Project',
                coordinates: [45.5442515697061, -122.91389689455964],
                zoom: 16,
                status: 'active'
            }
        };
    }
}

// Load admin data and integrate with main application
function loadAdminData() {
    console.log('🔧 Loading admin data...');
    
    // Note: Projects are now loaded from database in loadProjectsFromDatabase()
    // This function is kept for backward compatibility and contractor loading

    // Load contractors from admin panel
    const adminContractors = JSON.parse(localStorage.getItem('admin_contractors'));
    console.log('🔧 Admin contractors found:', adminContractors);
    
    if (adminContractors) {
        const activeContractors = adminContractors.filter(c => c.status === 'active');
        console.log('🔧 Active contractors:', activeContractors);
        
        COMPANIES.length = 0; // Clear existing companies
        activeContractors.forEach(contractor => {
            COMPANIES.push(contractor.name);
        });
        
        console.log('🔧 Updated COMPANIES array:', COMPANIES);
        
        // Update contractor dropdown
        populateCompanyDropdown();
    }
    
    console.log('🔧 Admin data loading completed');
}

// Load space categories from database
async function loadCategoriesFromDatabase() {
    try {
        console.log('🔧 Loading space categories from database...');
        
        const { data: categories, error } = await supabaseClient
            .from('space_categories')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        SPACE_CATEGORIES = categories || [];
        console.log('✅ Space categories loaded:', SPACE_CATEGORIES.length);
        
        // Populate the space category dropdown
        populateSpaceCategoryDropdown();
        
    } catch (error) {
        console.error('❌ Error loading space categories:', error);
        // Fallback to hardcoded categories if database fails
        SPACE_CATEGORIES = [
            { name: 'Staging Area', description: 'Area for staging materials and equipment' },
            { name: 'Material Storage', description: 'Storage area for construction materials' },
            { name: 'Equipment Parking', description: 'Parking area for construction equipment' },
            { name: 'Job Trailer', description: 'Temporary office or storage trailer' },
            { name: 'Safety Zone', description: 'Designated safety area' },
            { name: 'Access Road', description: 'Temporary access road or pathway' },
            { name: 'Utility Area', description: 'Area for utilities and services' },
            { name: 'Waste Management', description: 'Area for waste collection and management' }
        ];
        populateSpaceCategoryDropdown();
    }
}

// Load companies from database
async function loadCompaniesFromDatabase() {
    try {
        console.log('🔧 Loading companies from database...');
        
        const { data: companies, error } = await supabaseClient
            .from('companies')
            .select('*')
            .eq('is_active', true)
            .order('name', { ascending: true });
        
        if (error) throw error;
        
        // Convert to simple array of names for backward compatibility
        COMPANIES = companies.map(company => company.name);
        console.log('✅ Companies loaded:', COMPANIES.length);
        
        // Update the company dropdown
        populateCompanyDropdown();
        
    } catch (error) {
        console.error('❌ Error loading companies:', error);
        // Fallback to hardcoded companies if database fails
        COMPANIES = [
            'ABC Construction',
            'XYZ Contractors',
            'BuildRight Inc.',
            'Quality Builders',
            'Elite Construction',
            'Premier Contractors',
            'Reliable Builders',
            'Professional Construction'
        ];
        populateCompanyDropdown();
    }
}

// Populate space category dropdown
function populateSpaceCategoryDropdown() {
    console.log('🔧 Populating space category dropdown with:', SPACE_CATEGORIES);
    
    const categorySelect = document.getElementById('spaceCategory');
    if (!categorySelect) {
        console.warn('⚠️ Space category dropdown not found');
        return;
    }
    
    // Clear existing options except the first one
    categorySelect.innerHTML = '<option value="">Select space type</option>';
    
    // Add category options
    SPACE_CATEGORIES.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        if (category.description) {
            option.title = category.description;
        }
        categorySelect.appendChild(option);
    });
    
    console.log('🔧 Space category dropdown populated with', SPACE_CATEGORIES.length, 'categories');
}

// Populate project dropdown with database data
function populateProjectDropdown() {
    console.log('🔧 Populating project dropdown with:', PROJECTS);
    
    const projectSelect = document.getElementById('projectSelect');
    if (!projectSelect) {
        console.error('🔧 Project select element not found!');
        return;
    }
    
    // Clear existing options except the first one
    projectSelect.innerHTML = '<option value="">Select project</option>';
    
    Object.keys(PROJECTS).forEach(key => {
        const project = PROJECTS[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = project.name;
        projectSelect.appendChild(option);
    });
    
    console.log('🔧 Project dropdown populated with', Object.keys(PROJECTS).length, 'projects');
}

// Note: updateCampusDropdown() removed - now using populateProjectDropdown() for database-driven projects

// Open admin panel in same window
function openAdminPanel(event) {
    event.preventDefault();
    window.location.href = 'admin.html';
}

// Update current project banner
function updateCurrentProjectBanner(projectKey) {
    try {
        const el = document.getElementById('currentProjectBanner');
        const nameEl = document.getElementById('currentProjectName');
        if (!el) return;
        const proj = PROJECTS && projectKey ? PROJECTS[projectKey] : null;
        if (!proj) { el.style.display = 'none'; return; }
        if (nameEl) nameEl.textContent = proj.name;
        el.style.display = 'block';
    } catch(_) {}
}


// Log activity to admin panel
function logActivityToAdmin(action, details) {
    try {
        // Get existing activity log or create new one
        let activityLog = JSON.parse(localStorage.getItem('admin_activity_log')) || [];
        
        const activity = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action: action,
            user: details.contactName || 'User',
            details: details,
            status: 'completed'
        };
        
        // Add to beginning of array
        activityLog.unshift(activity);
        
        // Keep only last 1000 activities
        if (activityLog.length > 1000) {
            activityLog = activityLog.slice(0, 1000);
        }
        
        // Save back to localStorage
        localStorage.setItem('admin_activity_log', JSON.stringify(activityLog));
        
        console.log('Activity logged to admin panel:', activity);
    } catch (error) {
        console.error('Error logging activity to admin panel:', error);
    }
}

// Function to disable drawing controls when a shape exists
function disableDrawingControls() {
    if (window.drawControl && window.drawControl._toolbars.draw) {
        // Disable polygon drawing
        if (window.drawControl._toolbars.draw._modes.polygon && window.drawControl._toolbars.draw._modes.polygon.handler) {
            window.drawControl._toolbars.draw._modes.polygon.handler.disable();
        }
        // Disable rectangle drawing
        if (window.drawControl._toolbars.draw._modes.rectangle && window.drawControl._toolbars.draw._modes.rectangle.handler) {
            window.drawControl._toolbars.draw._modes.rectangle.handler.disable();
        }
        
        // Also disable the toolbar buttons visually
        const polygonButton = document.querySelector('.leaflet-draw-toolbar .leaflet-draw-draw-polygon');
        const rectangleButton = document.querySelector('.leaflet-draw-toolbar .leaflet-draw-draw-rectangle');
        
        if (polygonButton) {
            polygonButton.style.opacity = '0.5';
            polygonButton.style.pointerEvents = 'none';
            polygonButton.title = 'Drawing disabled - remove existing shape first';
        }
        if (rectangleButton) {
            rectangleButton.style.opacity = '0.5';
            rectangleButton.style.pointerEvents = 'none';
            rectangleButton.title = 'Drawing disabled - remove existing shape first';
        }
    }
    updateDrawingStatus('Shape created - drawing disabled. Use Undo to remove and draw again.');
}

// Function to enable drawing controls when no shape exists
function enableDrawingControls() {
    // Small delay to ensure toolbar is fully loaded
    setTimeout(() => {
        if (window.drawControl && window.drawControl._toolbars.draw) {
            // Enable polygon drawing
            if (window.drawControl._toolbars.draw._modes.polygon && window.drawControl._toolbars.draw._modes.polygon.handler) {
                window.drawControl._toolbars.draw._modes.polygon.handler.enable();
            }
            // Enable rectangle drawing
            if (window.drawControl._toolbars.draw._modes.rectangle && window.drawControl._toolbars.draw._modes.rectangle.handler) {
                window.drawControl._toolbars.draw._modes.rectangle.handler.enable();
            }
            
            // Also re-enable the toolbar buttons visually
            const polygonButton = document.querySelector('.leaflet-draw-toolbar .leaflet-draw-draw-polygon');
            const rectangleButton = document.querySelector('.leaflet-draw-toolbar .leaflet-draw-draw-rectangle');
            
            if (polygonButton) {
                polygonButton.style.opacity = '1';
                polygonButton.style.pointerEvents = 'auto';
                polygonButton.title = 'Draw a polygon';
            }
            if (rectangleButton) {
                rectangleButton.style.opacity = '1';
                rectangleButton.style.pointerEvents = 'auto';
                rectangleButton.title = 'Draw a rectangle';
            }
        }
        updateDrawingStatus('Ready to draw');
    }, 100);
}

// Drawing event handlers
function onShapeCreated(e) {
    // Prevent creating multiple shapes
    if (currentShape) {
        console.log('Shape creation prevented - shape already exists');
        drawnItems.removeLayer(e.layer);
        updateDrawingStatus('Remove existing shape before creating a new one');
        return;
    }
    
    const layer = e.layer;
    drawnItems.addLayer(layer);
    currentShape = layer;
    
    console.log('Shape created - layer:', layer);
    console.log('Shape type:', layer.constructor.name);
    console.log('Shape coordinates:', layer.getLatLngs());
    console.log('Shape GeoJSON:', layer.toGeoJSON());
    console.log('Shape bounds:', layer.getBounds());
    console.log('Shape center:', layer.getCenter ? layer.getCenter() : 'No center method');
    
    // Apply watermark if company is selected
    const companyName = document.getElementById('companyName')?.value;
    if (companyName) {
        console.log('🏷️ Applying watermark for company:', companyName);
        createShapeWatermark(layer, companyName);
    }
    
    // Disable drawing controls after creating a shape
    disableDrawingControls();
    
    // Add popup to show shape info
    const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
    const areaSqFt = Math.round(area * 10.764); // Convert square meters to square feet
    
    layer.bindPopup(`
        <strong>Drawn Area</strong><br>
        Area: ${areaSqFt} sq ft<br>
        ${companyName ? `Company: ${companyName}<br>` : ''}
        Double-click to edit | Use Undo to remove
    `);
    
    // Set up rectangle as rotatable polygon if drawn via rectangle tool
    if (e.layerType === 'rectangle' || layer instanceof L.Rectangle) {
        try {
            // If coming from v2 custom drawing, the layer is already a polygon with labels
            // Avoid recreating and instead reuse the provided layer
            let poly;
            if (e._fromCustomDrawing) {
                poly = layer; // Already a polygon
                currentShape = poly;
            } else {
            const rectLatLngs = layer.getLatLngs()[0]; // rectangle returns 1 ring
                poly = L.polygon(rectLatLngs, {
                color: '#0078d4',
                weight: 3,
                fill: true,
                fillOpacity: 0.15
            });
            try { drawnItems.removeLayer(layer); } catch(_) {}
            drawnItems.addLayer(poly);
            currentShape = poly;
            }

            // Bind similar popup
            const rectArea = L.GeometryUtil.geodesicArea(poly.getLatLngs()[0]);
            const rectAreaSqFt = Math.round(rectArea * 10.764);
            poly.bindPopup(`
                <strong>Drawn Area</strong><br>
                Area: ${rectAreaSqFt} sq ft<br>
                ${companyName ? `Company: ${companyName}<br>` : ''}
                Double-click to edit | Use Undo to remove
            `);

            // ✅ FIX: Only add legacy labels if needed (v2 shapes bring their own and have _recomputeLabels)
            if (!poly._hasMeasurements && !e._fromCustomDrawing) {
            addDistanceLabels(poly);
            }

            // Enable rotation via draggable handle
            if (window.PolygonTool && window.PolygonTool.enablePolygonRotation) {
                window.PolygonTool.enablePolygonRotation(poly);
            } else if (window.enablePolygonRotation) {
                window.enablePolygonRotation(poly);
            }

            // Replace references in undo stack
            undoStack.push({ action: 'draw', shape: poly });
            updateUndoButton();

            // Click/dblclick behavior
    poly.on('click', function(){ 
        currentShape = poly; 
        updateSubmitButton(); 
        // Clear any map errors since we now have a shape
        clearMapError();
        // Update state tracking
        updateToolState('edit', 'editing', poly, false);
    });
    
    // Setup custom editing for this shape (with delay to ensure shape is fully initialized)
    setTimeout(() => {
        if (window.CustomEditing && typeof window.CustomEditing.setupShapeClickHandler === 'function') {
            try {
                window.CustomEditing.setupShapeClickHandler(poly);
            } catch (error) {
                console.warn('Error setting up custom editing for shape:', error);
            }
        }
    }, 100);
            // Single-click enters edit/scale mode; double-click rotates
            poly.on('click', function(){
                try { 
                    if (window.RectangleTool && window.RectangleTool.enableRectScaleMode) {
                        window.RectangleTool.enableRectScaleMode(poly);
                    } else if (window.enableRectScaleMode) {
                        window.enableRectScaleMode(poly);
                    }
                } catch(_) {}
            });
            poly.on('dblclick', function(){
                try { 
                    if (window.RectangleTool && window.RectangleTool.disableRectScaleMode) {
                        window.RectangleTool.disableRectScaleMode(poly);
                    } else if (window.disableRectScaleMode) {
                        window.disableRectScaleMode(poly);
                    }
                } catch(_) {}
                if (window.PolygonTool && window.PolygonTool.enablePolygonRotation) {
                    window.PolygonTool.enablePolygonRotation(poly);
                } else if (window.enablePolygonRotation) {
                    window.enablePolygonRotation(poly);
                }
            });

            // Live updates while vertex editing / rotation / scaling
            // For v2 shapes, use _recomputeLabels; for legacy, use addDistanceLabels
            poly.on('edit', function(){
                try {
                    if (poly._recomputeLabels) { poly._recomputeLabels(); }
                    else if (!poly._hasMeasurements) { addDistanceLabels(poly); }
                } catch(_) {}
            });

            updateDrawingStatus(`Shape created - Area: ${rectAreaSqFt} sq ft`);
            updateSubmitButton();
            return; // finished rectangle branch
        } catch (errRect) {
            console.warn('Failed to convert rectangle to rotatable polygon:', errRect);
        }
    }
    
    // Handle fence measurements if this is a polyline (fence)
    const isFencePolyline = (e.layerType === 'polyline') || (layer instanceof L.Polyline && !(layer instanceof L.Polygon));
    if (isFencePolyline) {
        try {
            // Build definitive coordinate list based on closure mode
            const rawLatLngs = layer.getLatLngs();
            const isNested = Array.isArray(rawLatLngs[0]);
            const latLngs = (isNested ? rawLatLngs[0] : rawLatLngs).slice();
            if (latLngs.length >= 2) {
                const first = latLngs[0];
                const last = latLngs[latLngs.length - 1];
                const alreadyClosed = Math.abs(first.lat - last.lat) < 1e-9 && Math.abs(first.lng - last.lng) < 1e-9;
                if (!alreadyClosed && !finishingOpenFence) {
                    // Closed fence: append first point
                    latLngs.push(first);
                }
            }

            // Create a brand-new fence layer with the final coordinates
            const newFenceLayer = L.polyline(latLngs, {
                color: '#ffd700',
                weight: 3,
                opacity: 0.8
            });

            // Replace the original layer inside drawnItems
            try { drawnItems.removeLayer(layer); } catch (_) {}
            drawnItems.addLayer(newFenceLayer);
            currentShape = newFenceLayer;

            // Add distance labels for each segment
            addFenceDistanceLabels(newFenceLayer);

            // Calculate total length for the popup summary (works for open and closed)
            let totalLength = 0;
            for (let i = 0; i < latLngs.length - 1; i++) {
                totalLength += calculateDistanceInFeet(latLngs[i], latLngs[i + 1]);
            }

            // Bind popup
            newFenceLayer.bindPopup(`
                <strong>Fence</strong><br>
                Total Length: ${totalLength.toFixed(1)} ft<br>
                Segments: ${latLngs.length - 1}<br>
                ${finishingOpenFence ? '(Open-ended)' : '(Closed)'}<br>
                Double-click to edit | Use Undo to remove
            `);

            // Events for selection/edit UX
            newFenceLayer.on('click', function() {
                currentShape = newFenceLayer;
                updateSubmitButton();
            });

            newFenceLayer.on('dblclick', function() {
                const drawControl = map._drawControl;
                if (drawControl && drawControl._toolbars.edit) {
                    drawControl._toolbars.edit._modes.edit.handler.enable();
                    setTimeout(() => {
                        drawControl._toolbars.edit._modes.edit.handler._markersGroup.eachLayer(function(marker) {
                            if (marker._shape === newFenceLayer) {
                                marker.fire('click');
                            }
                        });
                    }, 100);
                }
            });

            // Dynamic measurement updates while editing this fence
            newFenceLayer.on('edit', function() {
                try {
                    addFenceDistanceLabels(newFenceLayer);
                    const pts = newFenceLayer.getLatLngs();
                    let len = 0;
                    for (let i = 0; i < pts.length - 1; i++) len += calculateDistanceInFeet(pts[i], pts[i+1]);
                    if (newFenceLayer.getPopup && newFenceLayer.getPopup()) {
                        newFenceLayer.getPopup().setContent(`
                            <strong>Fence</strong><br>
                            Total Length: ${len.toFixed(1)} ft<br>
                            Segments: ${Math.max(0, pts.length - 1)}<br>
                            Double-click to edit | Use Undo to remove
                        `);
                    }
                } catch(_) {}
            });

            // Update undo stack to reference the new layer
            if (undoStack.length > 0 && undoStack[undoStack.length - 1].action === 'draw') {
                undoStack[undoStack.length - 1].shape = newFenceLayer;
            }
        } catch (err) {
            console.warn('Fence replacement error:', err);
        } finally {
            closingFenceToStart = false;
            finishingOpenFence = false;
        }
    }
    
    // Add click and double-click handlers
    layer.on('click', function() {
        // Set as current shape when clicked
        currentShape = layer;
        updateSubmitButton();
    });
    
    layer.on('dblclick', function() {
        // Trigger edit mode for this shape
        const drawControl = map._drawControl;
        if (drawControl && drawControl._toolbars.edit) {
            // Enable edit mode
            drawControl._toolbars.edit._modes.edit.handler.enable();
            
            // Small delay to ensure edit mode is active
            setTimeout(() => {
                // Find and select this specific shape for editing
                drawControl._toolbars.edit._modes.edit.handler._markersGroup.eachLayer(function(marker) {
                    if (marker._shape === layer) {
                        marker.fire('click');
                    }
                });
            }, 100);
        }
    });
    
    // 🗑️ DISABLED: Legacy measurement updates - v2 system handles all measurements
    // Dynamic measurement updates while editing polygons/rectangles
    // if (!layer._hasMeasurements) {
    //     layer.on('edit', function() {
    //         try {
    //             if (layer instanceof L.Rectangle) {
    //                 updateRectangleMeasurements(layer);
    //             } else if (layer instanceof L.Polygon) {
    //                 addDistanceLabels(layer);
    //             }
    //         } catch(_) {}
    //     });
    // }
    
    // ✅ FIX: Only add distance measurements if we don't already have them
    // Check if v2 drawing system already added measurements
    if (drawingMarkers.length === 0 && !layer._hasMeasurements && !e._fromCustomDrawing) {
        addDistanceLabels(layer);
    } else {
        console.log('✅ Skipping duplicate measurements - v2 system already added them');
    }
    
    // Add to undo stack for easy removal
    undoStack.push({
        action: 'draw',
        shape: layer
    });
    updateUndoButton();
    
    updateDrawingStatus(`Shape created - Area: ${areaSqFt} sq ft`);
    updateSubmitButton();
    
    // Removed requestedArea field
}

function onShapeEdited(e) {
    const layers = e.layers;
    layers.eachLayer(function(layer) {
        // Update per type to avoid applying polygon logic to polylines
        if (layer instanceof L.Rectangle) {
            // 🗑️ DISABLED: Legacy rectangle measurements - v2 system handles this
            // updateRectangleMeasurements(layer);
            try {
        const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
        const areaSqFt = Math.round(area * 10.764);
                if (layer.getPopup && layer.getPopup()) {
        layer.getPopup().setContent(`
            <strong>Drawn Area</strong><br>
            Area: ${areaSqFt} sq ft<br>
            Click to edit or delete
        `);
                }
            } catch(_) {}
        } else if (layer instanceof L.Polygon) {
            // Polygon: update area popup and segment labels
            try {
                const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
                const areaSqFt = Math.round(area * 10.764);
                if (layer.getPopup && layer.getPopup()) {
                    layer.getPopup().setContent(`
                        <strong>Drawn Area</strong><br>
                        Area: ${areaSqFt} sq ft<br>
                        Click to edit or delete
                    `);
                }
            } catch(_) {}
            // ✅ FIX: Only update labels for legacy shapes (v2 shapes handle their own updates)
            if (!layer._hasMeasurements) {
            addDistanceLabels(layer);
            }
        } else if (layer instanceof L.Polyline) {
            // Fence/polyline: update segment labels and total length
            addFenceDistanceLabels(layer);
            try {
                const pts = layer.getLatLngs();
                let len = 0;
                for (let i = 0; i < pts.length - 1; i++) len += calculateDistanceInFeet(pts[i], pts[i+1]);
                if (layer.getPopup && layer.getPopup()) {
                    layer.getPopup().setContent(`
                        <strong>Fence</strong><br>
                        Total Length: ${len.toFixed(1)} ft<br>
                        Segments: ${Math.max(0, pts.length - 1)}<br>
                        Double-click to edit | Use Undo to remove
                    `);
                }
            } catch(_) {}
        }
    });
    
    updateDrawingStatus('Shape edited');
    updateSubmitButton();
}

function onShapeDeleted(e) {
    const layers = e.layers;
    layers.eachLayer(function(layer) {
        // Store in undo stack before removing
        undoStack.push({
            action: 'delete',
            shape: layer,
            data: layer.toGeoJSON()
        });
        
        // Remove distance labels when shape is deleted
        if (layer.distanceLabels) {
            layer.distanceLabels.forEach(label => {
                map.removeLayer(label);
            });
        }
        
        // Remove rectangle measurements when rectangle is deleted
        if (layer.constructor.name === 'Rectangle' && window.rectangleMeasurements) {
            window.rectangleMeasurements.forEach(marker => map.removeLayer(marker));
            window.rectangleMeasurements = [];
        }
        
        // Remove real-time rectangle measurements when rectangle is deleted
        if (layer.constructor.name === 'Rectangle' && window.realtimeRectangleMeasurements) {
            window.realtimeRectangleMeasurements.forEach(marker => map.removeLayer(marker));
            window.realtimeRectangleMeasurements = [];
        }
        
        // Remove fence measurements when fence is deleted (now handled by distanceLabels)
        // No need to clear window.fenceMeasurements as we're using the standard distanceLabels system
    });
    
    currentShape = null;
    
    // Re-enable drawing controls since no shape exists now
    enableDrawingControls();
    
    updateDrawingStatus('Shape deleted');
    updateSubmitButton();
    updateUndoButton();
    
    // Removed requestedArea field
}



// Variables for tracking drawing state
let currentDrawingLayer = null;
let isDrawing = false;
let drawingPolyline = null;
let drawingMarkers = [];
let mouseMarker = null;
let mouseLine = null;
let currentDrawingPolygon = null; // Track the actual polygon being drawn
let drawingVertices = []; // Track vertices as they're added
let closingFenceToStart = false; // Track if we closed fence to first point
let finishingOpenFence = false; // Track if we finished fence open at last point
let firstFinishMarker = null; // Clickable marker on first vertex (close)
let lastFinishMarker = null;  // Clickable marker on last vertex (finish open)
let isFenceModeActive = false; // Custom fence tool active
let currentFenceSession = null; // Current fence drawing session
let fenceRealtimeMarkers = []; // Realtime labels during fence drawing
let fenceMouseDistanceMarker = null; // Realtime label for last->mouse segment
let isShiftDown = false; // Track Shift modifier for snapping

// Real-time measurement system (LEGACY - mostly replaced by session classes)
function addRealTimeMeasurements() {
    // ✅ REMOVED: draw:drawstart and draw:drawstop - already attached in initMap()
    // Custom drawing tools (Fence, Rectangle, Polygon) manage their own events via session classes
    
    // Legacy event listeners for backward compatibility only
    // 🗑️ DISABLED: Old generic drawing listeners (v2/FenceDrawSession manage their own)
    // map.on('mousemove', onMouseMove);
    // map.on('click', onMapClick);
document.addEventListener('keydown', onKeyDown);
// Global Delete key to remove selected saved space (not during drawing)
document.addEventListener('keydown', async function(e){
    try {
        if (e.key === 'Delete' && !isDrawing) {
            // Prefer saved space selection
            const selected = window.currentShape || currentShape;
            const spaceId = selected?._spaceId || selected?.options?._spaceId || null;
            if (spaceId) {
                e.preventDefault();
                await deleteSavedSpace(spaceId);
            }
        }
    } catch(_) {}
});
    
    // Track modifier keys for snapping
    document.addEventListener('keydown', function(e){ if (e.key === 'Shift') { isShiftDown = true; } });
    document.addEventListener('keyup', function(e){ if (e.key === 'Shift') { isShiftDown = false; } });
    
    console.log('Real-time measurement system initialized');
}

// --- Angle snapping helpers ---
function maybeSnapLatLngFrom(lastLatLng, targetLatLng, domEventOrNull, incrementDegrees = 15) {
    try {
        const shiftActive = (domEventOrNull && domEventOrNull.shiftKey) || isShiftDown;
        if (!shiftActive || !lastLatLng || !targetLatLng || !map) return targetLatLng;
        const lastPt = map.latLngToContainerPoint(lastLatLng);
        const tgtPt = map.latLngToContainerPoint(targetLatLng);
        const dx = tgtPt.x - lastPt.x;
        const dy = tgtPt.y - lastPt.y;
        if (dx === 0 && dy === 0) return targetLatLng;
        const angle = Math.atan2(dy, dx);
        const inc = (Math.PI / 180) * incrementDegrees;
        const snappedAngle = Math.round(angle / inc) * inc;
        const dist = Math.hypot(dx, dy);
        const snappedDx = dist * Math.cos(snappedAngle);
        const snappedDy = dist * Math.sin(snappedAngle);
        const snappedPt = L.point(lastPt.x + snappedDx, lastPt.y + snappedDy);
        return map.containerPointToLatLng(snappedPt);
    } catch(_) {
        return targetLatLng;
    }
}

// --- Drawing mode UX helpers ---
function ensureDrawingModeStylesInjected() {
    if (document.getElementById('drawing-mode-style')) return;
    const style = document.createElement('style');
    style.id = 'drawing-mode-style';
    style.textContent = `
        /* Crosshair cursor while drawing */
        .drawing-mode .leaflet-container { cursor: crosshair !important; }
        /* Ensure all interactive vectors show crosshair during drawing */
        .drawing-mode .leaflet-interactive { cursor: crosshair !important; }
        /* Disable interactions with saved layers while drawing */
        .drawing-mode .saved-space-layer { pointer-events: none !important; }
    `;
    document.head.appendChild(style);
}

function setDrawingModeActive(active) {
    try {
        ensureDrawingModeStylesInjected();
        const root = document.body;
        if (active) {
            root.classList.add('drawing-mode');
        } else {
            root.classList.remove('drawing-mode');
        }
    } catch(_) {}
}

function onDrawStart(e) {
    // Prevent drawing if a shape already exists
    if (currentShape) {
        console.log('Drawing prevented - shape already exists');
        updateDrawingStatus('Remove existing shape before drawing a new one');
        return;
    }
    
    console.log('onDrawStart called', e);
    setDrawingModeActive(true);
    isDrawing = true;
    currentDrawingLayer = e.layer;
    
    // Update state tracking based on layer type
    let toolType = 'polygon';
    if (e.layerType === 'rectangle') toolType = 'rectangle';
    updateToolState(toolType, 'drawing', null, true);
    
    // Clear any existing drawing markers
    drawingMarkers.forEach(marker => map.removeLayer(marker));
    drawingMarkers = [];
    
    // Reset drawing state
    currentDrawingPolygon = null;
    drawingVertices = [];
    
    // Only create polyline for polygon drawing (not rectangles)
    if (e.layerType === 'polygon') {
        // Create polyline for drawing
        drawingPolyline = L.polyline([], {
            color: '#0078d4',
            weight: 2,
            fill: false
        }).addTo(map);
        
        // Create mouse marker and line
        mouseMarker = L.circleMarker([0, 0], {
            radius: 4,
            color: '#ff6b35',
            fillColor: '#ff6b35',
            fillOpacity: 0.8,
            weight: 2
        }).addTo(map);
        
        mouseLine = L.polyline([], {
            color: '#ff6b35',
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.8
        }).addTo(map);
    } else if (e.layerType === 'rectangle') {
        // For rectangles, set up custom real-time tracking
        console.log('🔧 Rectangle drawing started - setting up custom tracking');
        if (window.RectangleTool && window.RectangleTool.setupCustomRectangleTracking) {
            window.RectangleTool.setupCustomRectangleTracking();
        } else if (window.setupCustomRectangleTracking) {
            window.setupCustomRectangleTracking();
        }
    } else if (e.layerType === 'polyline') {
        // For fences (polylines), use same logic as polygons but with yellow color
        console.log('🔧 Fence drawing started - using polygon logic with yellow color');
        currentDrawingLayer = e; // Store the drawing layer info for color detection
        
        // Create polyline for drawing (like polygon but yellow)
        drawingPolyline = L.polyline([], {
            color: '#ffd700',
            weight: 3,
            fill: false
        }).addTo(map);
        
        // Create mouse marker and line (yellow styling)
        mouseMarker = L.circleMarker([0, 0], {
            radius: 4,
            color: '#ffd700',
            fillColor: '#ffd700',
            fillOpacity: 0.8,
            weight: 2
        }).addTo(map);
        
        mouseLine = L.polyline([], {
            color: '#ffd700',
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.8
        }).addTo(map);

        // Ensure finish markers are cleared at start
        removeFinishMarkers();
    }
    
    updateDrawingStatus('Drawing in progress...', 'drawing');
}

// Custom rectangle tracking using a different approach
// ✅ MIGRATED: setupCustomRectangleTracking moved to src/tool/rectangle.js

// 🗑️ DELETED: Legacy rectangle measurements - replaced by v2 custom drawing system

// Old fence measurement functions removed - now using standard distanceLabels system

// Add distance labels for fence (similar to addDistanceLabels but with yellow styling)
// ✅ MIGRATED: addFenceDistanceLabels moved to src/tool/fence.js

// Old setupFenceMeasurementsForCreated function removed - now using standard distanceLabels system

// Handle real-time drawing events (for rectangles)
function onDrawing(e) {
    if (!isDrawing) return;
    
    console.log('🔍 onDrawing called:', e.layerType, 'layer exists:', !!e.layer);
    
    // 🗑️ DISABLED: Legacy real-time rectangle measurements - v2 system handles this
    // if (e.layerType === 'rectangle' && e.layer) {
    //     console.log('🔍 Updating rectangle measurements in real-time');
    //     updateRectangleMeasurementsRealTime(e.layer);
    // }
}

// 🗑️ DELETED: Legacy rectangle real-time measurement functions
// Replaced by v2 custom drawing system

// 🗑️ DELETED: All legacy rectangle measurement functions
// Replaced by v2 custom drawing system (src/tool/drawing/custom-drawing-v2.js)

// Handle vertex addition during drawing
function onDrawVertex(e) {
    console.log('onDrawVertex called:', e);
    
    // We're now using only map clicks for vertex capture
    // This function is kept for compatibility but doesn't add vertices
    // All vertex capture is handled by onMapClick
}

// Handle key presses during drawing
function onKeyDown(e) {
    // Ignore global key handler while custom fence tool is active
    if (typeof isFenceModeActive !== 'undefined' && isFenceModeActive) {
        e.preventDefault();
        return;
    }
    if (!isDrawing) return;
    
    // Enter key to finish drawing (especially useful for fences)
    if (e.key === 'Enter' && drawingVertices.length >= 2) {
        console.log('Enter key pressed - letting Leaflet Draw handle completion');
        e.preventDefault();
        
        // Let Leaflet Draw handle fence completion - no custom logic needed
    }
    
    // Escape key to cancel drawing and delete everything
    if (e.key === 'Escape') {
        console.log('Escape key pressed - canceling drawing');
        e.preventDefault();
        
        // Cancel the current drawing
        cancelDrawing();
    }
}

// Finish the current drawing (called by Enter key or double-click)
// finishDrawing function removed - Leaflet Draw handles fence creation automatically

// Clean up all drawing state and elements
function cleanupDrawingState() {
    console.log('Cleaning up drawing state');
    
    // Set drawing state to false
    isDrawing = false;
    currentDrawingLayer = null;
    drawingVertices = [];
    
    // Clear drawing markers
    if (drawingMarkers) {
        drawingMarkers.forEach(marker => map.removeLayer(marker));
        drawingMarkers = [];
    }
    
    // Clear mouse line
    if (mouseLine) {
        map.removeLayer(mouseLine);
        mouseLine = null;
    }
    
    // Clear mouse marker and its distance marker
    if (mouseMarker) {
        map.removeLayer(mouseMarker);
        if (mouseMarker.distanceMarker) {
            map.removeLayer(mouseMarker.distanceMarker);
        }
        mouseMarker = null;
    }
    
    // Clear drawing polyline
    if (drawingPolyline) {
        map.removeLayer(drawingPolyline);
        drawingPolyline = null;
    }
    
    // Clear any real-time measurements
    if (window.realtimeRectangleMeasurements) {
        window.realtimeRectangleMeasurements.forEach(marker => map.removeLayer(marker));
        window.realtimeRectangleMeasurements = [];
    }

    // Remove finish markers
    removeFinishMarkers();
    
    console.log('Drawing state cleaned up');
}

// Clean up drawing state but preserve measurements (for when finishing drawing)
function cleanupDrawingStatePreserveMeasurements() {
    console.log('Cleaning up drawing state but preserving measurements');
    
    // Set drawing state to false
    isDrawing = false;
    currentDrawingLayer = null;
    drawingVertices = [];
    
    // DON'T clear drawingMarkers - they are now part of the fence's distanceLabels
    
    // Clear mouse line
    if (mouseLine) {
        map.removeLayer(mouseLine);
        mouseLine = null;
    }
    
    // Clear mouse marker and its distance marker
    if (mouseMarker) {
        map.removeLayer(mouseMarker);
        if (mouseMarker.distanceMarker) {
            map.removeLayer(mouseMarker.distanceMarker);
        }
        mouseMarker = null;
    }
    
    // Clear drawing polyline
    if (drawingPolyline) {
        map.removeLayer(drawingPolyline);
        drawingPolyline = null;
    }
    
    // Clear any real-time measurements
    if (window.realtimeRectangleMeasurements) {
        window.realtimeRectangleMeasurements.forEach(marker => map.removeLayer(marker));
        window.realtimeRectangleMeasurements = [];
    }
    
    
    console.log('Drawing state cleaned up, measurements preserved');
}

// Cancel the current drawing and delete everything
function cancelDrawing() {
    if (!isDrawing) return;
    
    console.log('Canceling drawing - deleting all created objects');
    
    // Clean up all drawing state and elements
    cleanupDrawingState();
    
    updateDrawingStatus('Drawing canceled');
    updateSubmitButton();
}

// Handle map clicks during drawing to capture vertices
function onMapClick(e) {
    // Ignore generic handler while custom Fence tool is active
    if (typeof isFenceModeActive !== 'undefined' && isFenceModeActive) return;
    if (!isDrawing) return;
    
    console.log('Map click during drawing:', e.latlng);
    
    // Add the clicked point to our vertex list
    if (drawingVertices.length > 0) {
        const lastPoint = drawingVertices[drawingVertices.length - 1];
        const snapped = maybeSnapLatLngFrom(lastPoint, e.latlng, e.originalEvent);
        drawingVertices.push(snapped);
    } else {
        drawingVertices.push(e.latlng);
    }
    console.log('Total vertices from clicks:', drawingVertices.length);
    
    // Update our polyline (only if it exists - for polygon drawing)
    if (drawingPolyline) {
    drawingPolyline.setLatLngs(drawingVertices);
    }
    
    // Add measurement for the newly completed segment (if we have at least 2 points)
    if (drawingVertices.length >= 2) {
        const lastPoint = drawingVertices[drawingVertices.length - 2];
        const currentPoint = drawingVertices[drawingVertices.length - 1];
        
        const distance = calculateDistanceInFeet(lastPoint, currentPoint);
        const midPoint = L.latLng(
            (lastPoint.lat + currentPoint.lat) / 2,
            (lastPoint.lng + currentPoint.lng) / 2
        );
        
        console.log('Adding measurement from click:', distance.toFixed(2), 'ft');
        
        // Use blue for all measurements (polygons and fences)
        let borderColor = '#0078d4'; // Blue for all
        let textColor = '#0078d4';
        
        // Offset the measurement position to prevent overlapping
        const offsetDistance = drawingMarkers.length * 0.00001; // Small offset for each measurement
        const offsetLat = midPoint.lat + offsetDistance;
        const offsetLng = midPoint.lng + offsetDistance;
        const offsetPoint = L.latLng(offsetLat, offsetLng);
        
        // Create permanent label for the completed segment
        const permanentLabel = L.divIcon({
            className: 'distance-label',
            html: `<div style="
                background: rgba(255, 255, 255, 0.98);
                border: 2px solid ${borderColor};
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 13px;
                font-weight: bold;
                color: ${textColor};
                white-space: nowrap;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                pointer-events: none;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center;
                min-width: 80px;
                max-width: 120px;
                line-height: 1.2;
            ">${distance.toFixed(1)} ft</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });
        
        // Add permanent marker for this completed segment
        const permanentMarker = L.marker(offsetPoint, { icon: permanentLabel }).addTo(map);
        drawingMarkers.push(permanentMarker);
        console.log('Added measurement marker from click');
    }

    // Update finish markers when drawing a fence
    if (currentDrawingLayer && currentDrawingLayer.layerType === 'polyline') {
        updateFinishMarkers();
    }
}

function onMouseMove(e) {
    // Ignore generic handler while custom Fence tool is active
    if (typeof isFenceModeActive !== 'undefined' && isFenceModeActive) return;
    if (!isDrawing || (!drawingPolyline && !currentDrawingLayer)) return;
    
    let mouseLatLng = e.latlng;
    
    // Use our tracked vertices instead of polyline coordinates
    if (drawingVertices.length === 0) {
        console.log('Mouse move: no vertices yet, waiting for first point...');
        return;
    }
    
    // Update mouse marker
    mouseMarker.setLatLng(mouseLatLng);
    
    // Update mouse line (from last vertex to mouse)
    const lastPoint = drawingVertices[drawingVertices.length - 1];
    // Snap the mouse preview when Shift is held
    mouseLatLng = maybeSnapLatLngFrom(lastPoint, mouseLatLng, e.originalEvent);
    if (mouseLine) {
    mouseLine.setLatLngs([lastPoint, mouseLatLng]);
    }
    
    // Show distance to mouse
    const distance = calculateDistanceInFeet(lastPoint, mouseLatLng);
    const midPoint = L.latLng(
        (lastPoint.lat + mouseLatLng.lat) / 2,
        (lastPoint.lng + mouseLatLng.lng) / 2
    );
    
    // Check if mouse is near start point for fence closing
    let showCloseIndicator = false;
    if (currentDrawingLayer && currentDrawingLayer.layerType === 'polyline' && drawingVertices.length >= 3) {
        const startPoint = drawingVertices[0];
        const distanceToStart = calculateDistanceInFeet(startPoint, mouseLatLng);
        showCloseIndicator = distanceToStart < 20;
    }
    
    // Update or create mouse distance label
    if (!mouseMarker.distanceLabel) {
        // Use blue for all measurements (polygons and fences)
        let borderColor = '#0078d4'; // Blue for all
        let textColor = '#0078d4';
        
    const displayText = showCloseIndicator ? 'Close Fence' : `${distance.toFixed(1)} ft`;
        const displayColor = showCloseIndicator ? '#28a745' : textColor; // Green for close indicator
        const displayBorder = showCloseIndicator ? '#28a745' : borderColor;
        
        mouseMarker.distanceLabel = L.divIcon({
            className: 'distance-label',
            html: `<div style="
                background: rgba(255, 255, 255, 0.98);
                border: 2px solid ${displayBorder};
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 13px;
                font-weight: bold;
                color: ${displayColor};
                white-space: nowrap;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                pointer-events: none;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center;
                min-width: 80px;
                max-width: 120px;
                line-height: 1.2;
            ">${displayText}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });
        
        mouseMarker.distanceMarker = L.marker(midPoint, { icon: mouseMarker.distanceLabel }).addTo(map);
    } else {
        mouseMarker.distanceMarker.setLatLng(midPoint);
        
        // Use blue for all measurements (polygons and fences)
        let borderColor = '#0078d4'; // Blue for all
        let textColor = '#0078d4';
        
        const displayText = showCloseIndicator ? 'Close Fence' : `${distance.toFixed(1)} ft`;
        const displayColor = showCloseIndicator ? '#28a745' : textColor; // Green for close indicator
        const displayBorder = showCloseIndicator ? '#28a745' : borderColor;
        
        mouseMarker.distanceMarker.setIcon(L.divIcon({
            className: 'distance-label',
            html: `<div style="
                background: rgba(255, 255, 255, 0.98);
                border: 2px solid ${displayBorder};
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 13px;
                font-weight: bold;
                color: ${displayColor};
                white-space: nowrap;
                box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                pointer-events: none;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center;
                min-width: 80px;
                max-width: 120px;
                line-height: 1.2;
            ">${displayText}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        }));
    }
}

// --- Finish markers for precise close/open ---
function updateFinishMarkers() {
    // Remove existing markers first
    removeFinishMarkers();
    if (drawingVertices.length === 0) return;
    // First point marker (close fence)
    const first = drawingVertices[0];
    firstFinishMarker = L.circleMarker(first, {
        radius: 7,
        color: '#ffd700',
        weight: 2,
        fillColor: '#ffd700',
        fillOpacity: 0.6
    }).addTo(map);
    firstFinishMarker.on('click', function(ev) {
        try { if (ev && ev.originalEvent) { ev.originalEvent.preventDefault(); ev.originalEvent.stopPropagation(); } } catch(_){ }
        closingFenceToStart = true;
        finishingOpenFence = false;
        const activeHandler = window.drawControl?._toolbars?.draw?._activeMode?.handler;
        if (activeHandler) {
            try {
                if (typeof activeHandler.completeShape === 'function') {
                    activeHandler.completeShape();
                } else if (typeof activeHandler._finishShape === 'function') {
                    activeHandler._finishShape();
                }
            } catch (err) {
                console.warn('Error completing fence (close) via handler:', err);
            }
        }
    });
    // Last point marker (finish open)
    const last = drawingVertices[drawingVertices.length - 1];
    lastFinishMarker = L.circleMarker(last, {
        radius: 7,
        color: '#ffd700',
        weight: 2,
        fillColor: '#ffd700',
        fillOpacity: 0.3
    }).addTo(map);
    lastFinishMarker.on('click', function(ev) {
        try { if (ev && ev.originalEvent) { ev.originalEvent.preventDefault(); ev.originalEvent.stopPropagation(); } } catch(_){ }
        closingFenceToStart = false;
        finishingOpenFence = true;
        const activeHandler = window.drawControl?._toolbars?.draw?._activeMode?.handler;
        if (activeHandler) {
            try {
                if (typeof activeHandler.completeShape === 'function') {
                    activeHandler.completeShape();
                } else if (typeof activeHandler._finishShape === 'function') {
                    activeHandler._finishShape();
                }
            } catch (err) {
                console.warn('Error completing fence (open) via handler:', err);
            }
        }
    });
}

function removeFinishMarkers() {
    if (firstFinishMarker) { try { map.removeLayer(firstFinishMarker); } catch(_){} firstFinishMarker = null; }
    if (lastFinishMarker) { try { map.removeLayer(lastFinishMarker); } catch(_){} lastFinishMarker = null; }
}

function updateDrawingMeasurements(latLngs) {
    // Clear previous markers
    drawingMarkers.forEach(marker => map.removeLayer(marker));
    drawingMarkers = [];
    
    // Add measurements for each line segment
    for (let i = 0; i < latLngs.length - 1; i++) {
        const currentPoint = latLngs[i];
        const nextPoint = latLngs[i + 1];
        
        const distance = calculateDistanceInFeet(currentPoint, nextPoint);
        const midPoint = L.latLng(
            (currentPoint.lat + nextPoint.lat) / 2,
            (currentPoint.lng + nextPoint.lng) / 2
        );
        
        // Create permanent label for completed segments
        const label = L.divIcon({
            className: 'distance-label',
            html: `<div style="
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid #0078d4;
                border-radius: 6px;
                padding: 6px 10px;
                font-size: 12px;
                font-weight: bold;
                color: #0078d4;
                white-space: nowrap;
                box-shadow: 0 3px 6px rgba(0,0,0,0.3);
                pointer-events: none;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center;
                min-width: 60px;
            ">${distance.toFixed(2)} ft</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });
        
        const marker = L.marker(midPoint, { icon: label }).addTo(map);
        drawingMarkers.push(marker);
    }
}

// This duplicate function is removed - using the comprehensive one above

function onDrawStop(e) {
    console.log('onDrawStop called:', e);
    updateDrawingStatus('Drawing completed');
    setDrawingModeActive(false);
    updateToolState('none', 'idle', null, false);
    
    // Use the comprehensive cleanup function
    cleanupDrawingState();
}

// Simple undo functionality
let undoStack = [];

function undoLastAction() {
    if (undoStack.length > 0) {
        const lastAction = undoStack.pop();
        
        if (lastAction.action === 'draw') {
            // Remove the last drawn shape
            const shapeToRemove = lastAction.shape;
            try { drawnItems.removeLayer(shapeToRemove); } catch(_) {}
            try { window.cranesLayer.removeLayer(shapeToRemove); } catch(_) {}
            
            // Remove distance labels from the shape
            if (shapeToRemove.distanceLabels) {
                shapeToRemove.distanceLabels.forEach(label => {
                    map.removeLayer(label);
                });
            }
            
            // Remove all drawing markers (measurement labels created during drawing)
            drawingMarkers.forEach(marker => {
                map.removeLayer(marker);
            });
            drawingMarkers = [];

            // Remove rectangle measurements (final and realtime)
            try {
                if (window.rectangleMeasurements) {
                    window.rectangleMeasurements.forEach(m => { try { map.removeLayer(m); } catch(_){} });
                    window.rectangleMeasurements = [];
                }
                if (window.realtimeRectangleMeasurements) {
                    window.realtimeRectangleMeasurements.forEach(m => { try { map.removeLayer(m); } catch(_){} });
                    window.realtimeRectangleMeasurements = [];
                }
            } catch(_) {}

            // Remove any remaining fence realtime markers
            try {
                if (typeof fenceRealtimeMarkers !== 'undefined' && fenceRealtimeMarkers && fenceRealtimeMarkers.length) {
                    fenceRealtimeMarkers.forEach(m => { try { map.removeLayer(m); } catch(_){} });
                    fenceRealtimeMarkers = [];
                }
                if (typeof fenceMouseDistanceMarker !== 'undefined' && fenceMouseDistanceMarker) {
                    try { map.removeLayer(fenceMouseDistanceMarker); } catch(_) {}
                    fenceMouseDistanceMarker = null;
                }
            } catch(_) {}
            
            // Update current shape if it was the one removed
            if (currentShape === shapeToRemove) {
                currentShape = null;
                // Remove watermark if it exists
                removeWatermarkFromShape(shapeToRemove);
            }
            
            // Re-enable drawing controls since no shape exists now
            enableDrawingControls();
            
            updateDrawingStatus('Undo: Last shape removed');
            updateSubmitButton();
            updateUndoButton();
        }
    }
}

// Distance calculation and labeling functions
function calculateDistanceInFeet(latLng1, latLng2) {
    // Calculate distance in meters using Haversine formula
    const R = 6371000; // Earth's radius in meters
    const lat1 = latLng1.lat * Math.PI / 180;
    const lat2 = latLng2.lat * Math.PI / 180;
    const deltaLat = (latLng2.lat - latLng1.lat) * Math.PI / 180;
    const deltaLng = (latLng2.lng - latLng1.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceInMeters = R * c;
    
    // Convert to feet (1 meter = 3.28084 feet)
    return distanceInMeters * 3.28084;
}

// 🗑️ DELETED: Legacy addDistanceLabels() function
// Replaced by v2 custom drawing system (src/tool/drawing/custom-drawing-v2.js)
// This stub prevents errors from legacy code that might still reference it
function addDistanceLabels(layer) {
    console.log('⚠️ Legacy addDistanceLabels() called - v2 system handles measurements now');
    return; // Do nothing - v2 system creates all measurements
}

// Initialize event listeners
function initializeEventListeners() {
    // ==== PHASE A DEBUG LOGGER ====
    // DrawDebug is now defined globally at the top of the file

    // Form validation
    const formInputs = document.querySelectorAll('input, select, textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });
    
    // Button event listeners (legacy controls removed)
    try { document.getElementById('clearDrawing')?.remove(); } catch(_) {}
    try { document.getElementById('resetView')?.remove(); } catch(_) {}
    // Project change updates banner
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
        projectSelect.addEventListener('change', function(e) {
            updateCurrentProjectBanner(e.target.value);
            // Persist selection immediately for cross-page continuity
            try {
                if (window.ToolSelection && typeof window.ToolSelection.persistProject === 'function') {
                    const z = (typeof map !== 'undefined' && map && typeof map.getZoom === 'function') ? map.getZoom() : (currentProject?.zoom || CONFIG?.defaultZoom || 16);
                    window.ToolSelection.persistProject(e.target.value, z);
                } else {
                    localStorage.setItem('selected_project_id', String(e.target.value));
                    const z = (typeof map !== 'undefined' && map && typeof map.getZoom === 'function') ? map.getZoom() : (currentProject?.zoom || CONFIG?.defaultZoom || 16);
                    if (z) localStorage.setItem('selected_project_zoom', String(z));
                }
            } catch(_) {}
            // After project switch, refresh phases and spaces if wrappers are available
            try {
                if (window.ToolPhases && typeof window.ToolPhases.populate === 'function') window.ToolPhases.populate(e.target.value);
                if (window.ToolPhases && typeof window.ToolPhases.restoreForProject === 'function') window.ToolPhases.restoreForProject(e.target.value);
                if (window.ToolSpaces && typeof window.ToolSpaces.refresh === 'function') window.ToolSpaces.refresh();
            } catch(_) {}
        });
    }
    // Legacy request actions removed
    try { document.getElementById('previewRequest')?.remove(); } catch(_) {}
    try { document.getElementById('submitRequest')?.remove(); } catch(_) {}
    document.getElementById('saveSpace').addEventListener('click', saveSpace);
    
    // Modal event listeners (legacy modals removed)
    try { document.getElementById('confirmSubmit')?.addEventListener('click', confirmSubmit); } catch(_) {}
    try { document.getElementById('cancelSubmit')?.addEventListener('click', closePreviewModal); } catch(_) {}
    try { document.getElementById('newRequest')?.addEventListener('click', resetForm); } catch(_) {}
    try { document.getElementById('closeSuccess')?.addEventListener('click', closeSuccessModal); } catch(_) {}
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const previewModal = document.getElementById('previewModal');
        const successModal = document.getElementById('successModal');
        
        if (event.target === previewModal) {
            closePreviewModal();
        }
        if (event.target === successModal) {
            closeSuccessModal();
        }
    });
    
    // Close modals with X button
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', function() {
            closePreviewModal();
            closeSuccessModal();
        });
    });
    
    // Project selection event listener
    document.getElementById('projectSelect').addEventListener('change', function() {
        const selectedProjectKey = this.value;
        if (selectedProjectKey) {
            navigateToProject(selectedProjectKey);
            // Load phases for the selected project
            populatePhaseCheckboxes(selectedProjectKey);
        } else {
            // Clear phases when no project is selected
            const phaseContainer = document.getElementById('projectPhases');
            if (phaseContainer) {
                phaseContainer.innerHTML = '<div class="phase-empty">Select a project to view phases</div>';
            }
        }
    });
    
    // Company selection should not clear or require re-drawing a shape.
    // Update watermark if a shape exists, and re-validate save button.
    document.getElementById('companyName').addEventListener('change', function() {
        console.log('🏢 Company selection changed:', this.value);
        try { updateCurrentShapeWatermark(); } catch(_) {}
        try { updateSubmitButton(); } catch(_) {}
        try { clearMapError(); } catch(_) {}
    });
    
    // Phase selection event listeners (for filtering saved spaces)
    let phaseChangeTimeout;
    document.addEventListener('change', function(e) {
        if (e.target.name === 'projectPhases') {
            console.log('🔄 Phase selection changed, updating space display');
            // Re-validate form when phases change
            updateSubmitButton();
            // Clear phase error when user makes a selection
            if (e.target.checked) {
                clearPhaseError();
            }
            // Debounce the phase change to prevent rapid API calls
            clearTimeout(phaseChangeTimeout);
            phaseChangeTimeout = setTimeout(() => {
                loadProjectSpaces();
            }, 300);
            // Persist selected phases for cross-page continuity
            try {
                const selected = Array.from(document.querySelectorAll('input[name="projectPhases"]:checked')).map(cb => parseInt(cb.value));
                localStorage.setItem('selected_phase_ids', JSON.stringify(selected));
                const projectSelectEl = document.getElementById('projectSelect');
                if (projectSelectEl && projectSelectEl.value) {
                    localStorage.setItem('selected_project_id', String(projectSelectEl.value));
                }
            } catch(_) {}
        }
    });
    
    // Undo button is now integrated into the Leaflet toolbar
}

// Form validation with enhanced UX feedback
function hasDrawableSelection() {
    const group = (typeof window !== 'undefined' && window.currentCraneGroup) || currentCraneGroup;
    // Accept any existing shape OR a crane feature group that has layers, regardless of transient stage flags
    if (currentShape) return true;
    if (group && typeof group.getLayers === 'function' && group.getLayers().length > 0) return true;
    if (drawnItems && drawnItems.getLayers().length > 0) return true;
    return false;
}

function validateForm() {
    const requiredFields = [
        'projectSelect',
        'spaceCategory',
        'companyName'
    ];
    
    let isValid = true;
    const errors = [];
    
    // Clear previous error messages
    clearFieldErrors();
    
    // Check required fields with enhanced validation
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const value = field.value.trim();
        
        if (!value) {
            isValid = false;
            showFieldError(fieldId, `${getFieldDisplayName(fieldId)} is required`);
        } else {
            clearFieldError(fieldId);
            
            // Additional validation for specific fields
            if (fieldId === 'companyName' && !isValidTrade(value)) {
                isValid = false;
                showFieldError(fieldId, 'Company name must be 1-100 characters');
            }
        }
    });
    
    // Validate space name if provided
    const spaceNameField = document.getElementById('spaceName');
    if (spaceNameField && spaceNameField.value.trim()) {
        const spaceName = spaceNameField.value.trim();
        if (!isValidSpaceName(spaceName)) {
            isValid = false;
            showFieldError('spaceName', 'Space name must be 1-50 characters');
        } else {
            clearFieldError('spaceName');
        }
    }
    
    // Validate description if provided
    const descriptionField = document.getElementById('description');
    if (descriptionField && descriptionField.value.trim()) {
        const description = descriptionField.value.trim();
        if (description.length > 500) {
            isValid = false;
            showFieldError('description', 'Description too long (max 500 characters)');
        } else {
            clearFieldError('description');
        }
    }
    
    // Check phase selection
    const selectedPhases = getSelectedPhases();
    if (selectedPhases.length === 0) {
        isValid = false;
        showPhaseError('Please select at least one project phase');
    } else {
        clearPhaseError();
    }
    
    // Check if there is a drawable selection to save (shape or crane group). Do not require specific crane state.
    const hasDrawable = hasDrawableSelection();
    
    if (!hasDrawable) { 
        isValid = false; 
        showMapError('Please draw a shape on the map');
    } else {
        clearMapError();
    }
    
    // Log validation errors for security monitoring
    if (!isValid && errors.length > 0) {
        logSecurityEvent('FORM_VALIDATION_FAILED', 'Form validation failed', { errors });
    }
    
    updateSubmitButton(isValid);
    return isValid;
}

// Helper functions for field error management
function getFieldDisplayName(fieldId) {
    const names = {
        'projectSelect': 'Project',
        'spaceCategory': 'Space Category',
        'companyName': 'Company Name',
        'spaceName': 'Space Name',
        'description': 'Description'
    };
    return names[fieldId] || fieldId;
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    // Add visual error styling
    field.classList.add('invalid');
    
    // Create or update error message
    let errorElement = document.getElementById(`${fieldId}-error`);
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = `${fieldId}-error`;
        errorElement.className = 'field-error';
        errorElement.style.cssText = 'color: #dc2626; font-size: 0.875rem; margin-top: 0.25rem;';
        field.parentNode.insertBefore(errorElement, field.nextSibling);
    }
    errorElement.textContent = message;
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.remove('invalid');
    }
    
    const errorElement = document.getElementById(`${fieldId}-error`);
    if (errorElement) {
        errorElement.remove();
    }
}

function clearFieldErrors() {
    const errorElements = document.querySelectorAll('.field-error');
    errorElements.forEach(el => el.remove());
    
    const invalidFields = document.querySelectorAll('.invalid');
    invalidFields.forEach(field => field.classList.remove('invalid'));
}

function showPhaseError(message) {
    const phaseContainer = document.getElementById('projectPhases');
    if (!phaseContainer) return;
    
    let errorElement = document.getElementById('phase-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'phase-error';
        errorElement.className = 'phase-error';
        errorElement.style.cssText = 'color: #dc2626; font-size: 0.875rem; margin-top: 0.5rem; font-weight: 500;';
        phaseContainer.appendChild(errorElement);
    }
    errorElement.textContent = message;
}

function clearPhaseError() {
    const errorElement = document.getElementById('phase-error');
    if (errorElement) {
        errorElement.remove();
    }
}

function showMapError(message) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    let errorElement = document.getElementById('map-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'map-error';
        errorElement.className = 'map-error';
        errorElement.style.cssText = 'position: absolute; top: 10px; left: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; z-index: 1000; max-width: 300px;';
        mapContainer.appendChild(errorElement);
    }
    errorElement.textContent = message;
}

function clearMapError() {
    const errorElement = document.getElementById('map-error');
    if (errorElement) {
        errorElement.remove();
    }
}

// Update submit button state
function updateSubmitButton(isValid = null) {
    const saveBtn = document.getElementById('saveSpace');
    const isValidForm = isValid !== null ? isValid : validateForm();
    
    if (saveBtn) {
        saveBtn.disabled = !isValidForm;
        
        if (isValidForm) {
            saveBtn.textContent = 'Save Space';
            saveBtn.className = 'btn btn-success';
            saveBtn.title = 'All required fields completed. Click to save your space.';
            saveBtn.classList.remove('btn-disabled');
        } else {
            // Provide specific feedback about what's missing
            const missingFields = getMissingFields();
            if (missingFields.length > 0) {
                saveBtn.textContent = `Complete: ${missingFields.join(', ')}`;
                saveBtn.title = `Missing required fields: ${missingFields.join(', ')}`;
            } else {
                saveBtn.textContent = 'Draw a shape on the map';
                saveBtn.title = 'Please draw a shape on the map before saving';
            }
            saveBtn.className = 'btn btn-secondary';
            saveBtn.classList.add('btn-disabled');
        }
    }
}

// Helper function to get missing fields for button feedback
function getMissingFields() {
    const missing = [];
    
    // Check required fields
    const requiredFields = ['projectSelect', 'spaceCategory', 'companyName'];
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            missing.push(getFieldDisplayName(fieldId));
        }
    });
    
    // Check phase selection
    const selectedPhases = getSelectedPhases();
    if (selectedPhases.length === 0) {
        missing.push('Project Phases');
    }
    
    // Check for shape - check currentShape, crane group, OR any existing shapes
    const hasDrawable = !!currentShape || 
                       (!!currentCraneGroup && isCraneModeActive === false && craneStage === 'idle') ||
                       (drawnItems && drawnItems.getLayers().length > 0);
    if (!hasDrawable) {
        missing.push('Map Shape');
    }
    
    return missing;
}

// Add undo button to Leaflet drawing toolbar
function addUndoButtonToToolbar() {
    // Wait for the toolbar to be created
    setTimeout(() => {
        const toolbar = document.querySelector('.leaflet-draw-toolbar');
        if (toolbar) {
            // Create undo button container
            const undoContainer = document.createElement('div');
            undoContainer.className = 'leaflet-draw-toolbar-section';
            undoContainer.style.cssText = `
                display: inline-block !important;
                margin: 2px !important;
            `;
            
            // Create undo button
            const undoButton = document.createElement('a');
            undoButton.href = '#';
            undoButton.title = 'Undo last action';
            undoButton.className = 'leaflet-draw-edit-undo';
            undoButton.innerHTML = '↶';
            undoButton.style.cssText = `
                background-color: #f8f9fa !important;
                border: 1px solid #ccc !important;
                color: #333 !important;
                width: 30px !important;
                height: 30px !important;
                line-height: 30px !important;
                text-align: center !important;
                text-decoration: none !important;
                display: inline-block !important;
                border-radius: 4px !important;
                font-weight: bold !important;
                font-size: 16px !important;
                opacity: 0.5 !important;
                cursor: not-allowed !important;
                user-select: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
            `;
            
            // Add click event with proper event handling
            undoButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Undo button clicked, stack length:', undoStack.length);
                if (undoStack.length > 0) {
                    undoLastAction();
                }
            });
            
            // Add mouse events for better UX
            undoButton.addEventListener('mouseenter', function() {
                if (undoStack.length > 0) {
                    this.style.backgroundColor = '#e9ecef !important';
                }
            });
            
            undoButton.addEventListener('mouseleave', function() {
                if (undoStack.length > 0) {
                    this.style.backgroundColor = '#f8f9fa !important';
                }
            });
            
            // Add button to container
            undoContainer.appendChild(undoButton);
            
            // Add container to toolbar
            toolbar.appendChild(undoContainer);
            
            // Store reference for updating
            window.undoButton = undoButton;
            
            // Initialize button state
            updateUndoButton();
            
            console.log('Undo button added to toolbar');
        } else {
            console.log('Toolbar not found, retrying...');
            // Retry if toolbar not found
            setTimeout(addUndoButtonToToolbar, 200);
        }
    }, 100);
}

// ✅ MIGRATED: addFenceButtonToToolbar moved to src/tool/fence.js

// ✅ MIGRATED: startFenceDrawing moved to src/tool/fence.js

// ✅ MIGRATED: stopFenceDrawing moved to src/tool/fence.js

// ✅ MIGRATED: All fence functions moved to src/tool/fence.js

// ✅ MIGRATED: Helper functions moved to src/tool/fence.js

// ✅ MIGRATED: All remaining fence functions moved to src/tool/fence.js

function isSamePoint(a, b) {
    if (!a || !b) return false;
    const pa = map.latLngToContainerPoint(a);
    const pb = map.latLngToContainerPoint(b);
    return Math.hypot(pa.x - pb.x, pa.y - pb.y) <= 6; // 6px tolerance
}

// Update undo button state
function updateUndoButton() {
    if (window.undoButton) {
        if (undoStack.length === 0) {
            window.undoButton.style.opacity = '0.5';
            window.undoButton.style.cursor = 'not-allowed';
            window.undoButton.title = 'No actions to undo';
            window.undoButton.style.backgroundColor = '#f8f9fa';
        } else {
            window.undoButton.style.opacity = '1';
            window.undoButton.style.cursor = 'pointer';
            window.undoButton.title = 'Undo last action';
            window.undoButton.style.backgroundColor = '#f8f9fa';
        }
        console.log('Undo button updated, stack length:', undoStack.length);
    }
}

// Map control functions
function clearDrawing() {
    drawnItems.clearLayers();
    currentShape = null;
    
    // Clear real-time drawing elements
    if (drawingPolyline) {
        map.removeLayer(drawingPolyline);
        drawingPolyline = null;
    }
    
    if (mouseMarker) {
        map.removeLayer(mouseMarker);
        if (mouseMarker.distanceMarker) {
            map.removeLayer(mouseMarker.distanceMarker);
        }
        mouseMarker = null;
    }
    
    if (mouseLine) {
        map.removeLayer(mouseLine);
        mouseLine = null;
    }
    
    drawingMarkers.forEach(marker => map.removeLayer(marker));
    drawingMarkers = [];
    // Clear any rectangle measurements (final and realtime)
    try {
        if (window.rectangleMeasurements) {
            window.rectangleMeasurements.forEach(m => { try { map.removeLayer(m); } catch(_){} });
            window.rectangleMeasurements = [];
        }
        if (window.realtimeRectangleMeasurements) {
            window.realtimeRectangleMeasurements.forEach(m => { try { map.removeLayer(m); } catch(_){} });
            window.realtimeRectangleMeasurements = [];
        }
    } catch(_) {}
    
    // Reset drawing state
    isDrawing = false;
    currentDrawingPolygon = null;
    drawingVertices = [];
    
    // Clear undo stack
    undoStack = [];
    updateUndoButton();
    
    // Re-enable drawing controls
    enableDrawingControls();
    
    updateDrawingStatus('Drawing cleared');
    updateSubmitButton();
}

function resetMapView() {
    if (siteLayoutLayer && siteLayoutLayer.getBounds) {
        map.fitBounds(siteLayoutLayer.getBounds());
    } else {
        map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    }
    updateDrawingStatus('View reset');
}

// Update drawing status
function updateDrawingStatus(message, type = 'ready') {
    if (window.ToolStatus && typeof window.ToolStatus.update === 'function') {
        return window.ToolStatus.update(message, type);
    }
    // Fallback in case helper is unavailable
    try {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
        if (statusText) statusText.textContent = message;
        if (!statusDot) return;
    statusDot.classList.remove('drawing', 'error');
        if (type === 'drawing') statusDot.classList.add('drawing');
        else if (type === 'error') statusDot.classList.add('error');
    } catch(_) {}
}

// Update tool state
function updateToolState(tool, stage = 'idle', selection = null, drawing = false) {
    if (window.ToolStatus && typeof window.ToolStatus.updateState === 'function') {
        window.ToolStatus.updateState({ tool, stage, selection, drawing });
    }
}

// ===================== Crane Tool =====================
let isCraneModeActive = false;
let craneStage = 'idle'; // 'pad' | 'radius' | 'sweep'
let cranePadFirstCorner = null;
let cranePadRect = null;
let cranePadCenter = null;
let craneRadiusLine = null;
let craneRadiusMeters = 0;
let craneRadiusFeet = 0;
let craneStartAzimuthRad = 0; // radians
let craneStartDeg = 0;
let craneRadiusPx = 0; // screen-space radius for perfect visual match
let craneSweepAccumDeg = 0; // accumulated sweep degrees (-360..360)
let craneLastAngleDeg = null; // last observed angle during sweep
let craneRadiusLockPx = null; // when Shift held in radius stage, lock length in pixels
let craneSweepSector = null;
let craneRealtimeLabels = [];
let currentCraneGroup = null;

// ✅ MIGRATED: addCraneButtonToToolbar moved to src/tool/crane.js

// ✅ MIGRATED: startCraneDrawing moved to src/tool/crane.js

// ✅ MIGRATED: stopCraneDrawing moved to src/tool/crane.js

// ✅ MIGRATED: onCraneKeyDown moved to src/tool/crane.js

// ✅ MIGRATED: onCraneClick moved to src/tool/crane.js

// ✅ MIGRATED: All crane functions moved to src/tool/crane.js

function injectCautionPattern() {
    try {
        const overlayPane = document.querySelector('.leaflet-overlay-pane');
        if (!overlayPane) return;
        const svgEl = overlayPane.querySelector('svg');
        if (!svgEl) return;
        if (document.getElementById('crane-caution-defs')) return;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.setAttribute('id', 'crane-caution-defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'craneCautionPattern');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '12');
        pattern.setAttribute('height', '12');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
        rect.setAttribute('width', '12'); rect.setAttribute('height', '12');
        rect.setAttribute('fill', getStyleOrDefault('craneCautionBg', '#fef08a'));
        const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path1.setAttribute('d', 'M-3 3 L3 -3');
        path1.setAttribute('stroke', getStyleOrDefault('craneCautionStripe', '#111827'));
        path1.setAttribute('stroke-width', '4');
        const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path2.setAttribute('d', 'M0 12 L12 0');
        path2.setAttribute('stroke', getStyleOrDefault('craneCautionStripe', '#111827'));
        path2.setAttribute('stroke-width', '4');
        const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path3.setAttribute('d', 'M9 15 L15 9');
        path3.setAttribute('stroke', getStyleOrDefault('craneCautionStripe', '#111827'));
        path3.setAttribute('stroke-width', '4');
        pattern.appendChild(rect);
        pattern.appendChild(path1);
        pattern.appendChild(path2);
        pattern.appendChild(path3);
        defs.appendChild(pattern);
        svgEl.insertBefore(defs, svgEl.firstChild);
    } catch(_) {}
}

// Preview request
function previewRequest() {
    if (!validateForm()) {
        alert('Please fill in all required fields and draw a shape on the map.');
        return;
    }
    
    // Check if at least one phase is selected
    const selectedPhases = getSelectedPhases();
    if (selectedPhases.length === 0) {
        alert('Please select at least one project phase.');
        return;
    }
    
    const requestData = collectFormData();
    const previewContent = document.getElementById('previewContent');
    
    previewContent.innerHTML = `
        <div class="preview-item">
            <strong>Company:</strong> ${escapeHtml(requestData.companyName || '')}
        </div>
        <div class="preview-item">
            <strong>Project:</strong> ${escapeHtml(PROJECTS[requestData.project]?.name || '')}
        </div>
        <div class="preview-item">
            <strong>Project Phases:</strong> ${escapeHtml(getSelectedPhaseNames().join(', '))}
        </div>
        <div class="preview-item">
            <strong>Space Category:</strong> ${requestData.spaceCategory}
        </div>
        <div class="preview-item">
            <strong>Requested Area:</strong> ${requestData.requestedArea} sq ft
        </div>
        <div class="preview-item">
            <strong>Description:</strong> ${requestData.description || 'No description provided'}
        </div>
        <div class="preview-item">
            <strong>Shape Coordinates:</strong> <br>
            <small>${JSON.stringify(requestData.geometry, null, 2)}</small>
        </div>
    `;
    
    document.getElementById('previewModal').style.display = 'block';
}

// Collect form data
function collectFormData() {
    
    console.log('🔍 collectFormData - currentProject:', currentProject);
    console.log('🔍 collectFormData - currentProject.id:', currentProject?.id);
    
    return {
        companyName: document.getElementById('companyName').value,
        project: currentProject ? currentProject.id : null,
        projectPhases: getSelectedPhases(), // Add selected phases
        spaceCategory: document.getElementById('spaceCategory').value,
        // requestedArea removed
        description: document.getElementById('description').value,
        geometry: currentShape ? (() => {
            console.log('Collecting form data - currentShape:', currentShape);
            console.log('CurrentShape type:', currentShape.constructor.name);
            console.log('CurrentShape coordinates:', currentShape.getLatLngs());
            
            const geoJSON = currentShape.toGeoJSON();
            console.log('Current shape GeoJSON:', geoJSON);
            
            // Extract just the geometry from the Feature object
            const geometry = geoJSON.geometry;
            console.log('Extracted geometry:', geometry);
            return geometry;
        })() : ((typeof window !== 'undefined' && window.currentCraneGroup) ? (() => {
            // Serialize the crane FeatureGroup with explicit part tagging for styling on reload
            try {
                const features = [];
                window.currentCraneGroup.eachLayer(function(layer) {
                    try {
                        let feat = layer.toGeoJSON();
                        // Ensure Feature wrapper
                        if (feat.type !== 'Feature') {
                            feat = { type: 'Feature', geometry: feat, properties: {} };
                        }
                        feat.properties = feat.properties || {};
                        if (layer === window.cranePadPoly || layer === window.cranePadRect) {
                            feat.properties.part = 'pad';
                        } else if (layer === window.craneSweepSector) {
                            feat.properties.part = 'sweep';
                        } else if (layer === window.craneRadiusLine) {
                            feat.properties.part = 'radius';
                        }
                        features.push(feat);
                    } catch (_) {}
                });
                if (features.length > 0) {
                    return { type: 'FeatureCollection', features };
                }
                return null;
            } catch (_) {
                return null;
            }
        })() : null),
        submittedAt: new Date().toISOString(),
        requestId: generateRequestId()
    };
}

// Save current space to database
async function saveSpace() {
    if (!validateForm()) {
        alert('Please fill in all required fields and draw a shape on the map.');
        return;
    }
    
    // Check if at least one phase is selected
    const selectedPhases = getSelectedPhases();
    if (selectedPhases.length === 0) {
        alert('Please select at least one project phase.');
        return;
    }
    
    if (!hasDrawableSelection()) {
        alert('Please draw a shape on the map first.');
        return;
    }
    
    try {
        // Get form data
        const formData = collectFormData();
        
        // Validate and sanitize form data
        const validation = validateFormData(formData);
        if (!validation.isValid) {
            alert('Invalid input: ' + validation.errors.join(', '));
            logSecurityEvent('INVALID_INPUT', 'Form validation failed', { errors: validation.errors });
            return;
        }
        
        // Use sanitized data
        const sanitizedData = validation.data;
        
        // Validate that we have a project selected
        console.log('🔍 Validation check - formData.project:', formData.project);
        console.log('🔍 Validation check - currentProject:', currentProject);
        console.log('🔍 Validation check - currentProject.id:', currentProject?.id);
        
        if (!formData.project || !currentProject) {
            console.log('❌ Validation failed - no project selected');
            alert('Please select a project before saving the space.');
            return;
        }
        
        // Generate space name if not provided
        const spaceName = document.getElementById('spaceName')?.value || 
                         `${formData.spaceCategory} - ${formData.companyName} - ${new Date().toLocaleDateString()}`;
        
        // Prepare space data for database
        const spaceData = {
            space_id: `SPACE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            project_id: parseInt(formData.project),
            space_name: spaceName,
            category: formData.spaceCategory,
            trade: formData.companyName,
            description: formData.description || '',
            // Use the geometry gathered in collectFormData for both normal shapes and crane FeatureGroup
            geometry: formData.geometry,
            status: 'active'
        };
        
        console.log('💾 Saving space:', spaceData);
        
        // Save to database using the existing database service
        const { data, error } = await supabaseClient
            .from('project_spaces')
            .insert([spaceData])
            .select();
        
        if (error) {
            console.error('❌ Error saving space:', error);
            logSecurityEvent('DATABASE_ERROR', 'Failed to save space', { 
                error: error.message, 
                spaceData: sanitizedData 
            });
            alert('Failed to save space: ' + error.message);
            return;
        }
        
        const savedSpace = data[0];
        console.log('✅ Space saved successfully:', savedSpace);
        
        // Create phase assignments for the saved space
        console.log('🔗 Creating phase assignments for phases:', selectedPhases);
        for (const phaseId of selectedPhases) {
            const assignmentData = {
                project_space_id: savedSpace.id,
                project_phase_id: parseInt(phaseId)
            };
            
            console.log('📝 Creating assignment:', assignmentData);
            
            const { data: assignmentData_result, error: assignmentError } = await supabaseClient
                .from('phase_space_assignments')
                .insert([assignmentData])
                .select();
            
            if (assignmentError) {
                console.error('❌ Error creating phase assignment:', assignmentError);
            } else {
                console.log('✅ Phase assignment created:', assignmentData_result);
            }
        }
        
        // Clear current shape and any transient crane handles after save
        try {
            if (window.craneRotateHandle) { try { window.map.removeLayer(window.craneRotateHandle); } catch(_) {} }
            window.craneRotateHandle = null;
        } catch(_) {}
        clearCurrentShape();
        
        // Show success message
        alert(`Space "${spaceName}" saved successfully!`);
        
        // Load and display all saved spaces for this project
        await loadProjectSpaces();
        
    } catch (error) {
        console.error('❌ Error in saveSpace:', error);
        alert('Failed to save space: ' + error.message);
    }
}

// Clear current shape and reset form
function clearCurrentShape() {
    if (currentShape) {
        // Remove any attached distance labels to the shape
        try {
            if (currentShape.distanceLabels) {
                currentShape.distanceLabels.forEach(label => { try { map.removeLayer(label); } catch(_){} });
                currentShape.distanceLabels = [];
            }
        } catch(_) {}
        drawnItems.removeLayer(currentShape);
        currentShape = null;
    }
    // Clear rectangle measurements
    try {
        if (window.rectangleMeasurements) {
            window.rectangleMeasurements.forEach(m => { try { map.removeLayer(m); } catch(_){} });
            window.rectangleMeasurements = [];
        }
        if (window.realtimeRectangleMeasurements) {
            window.realtimeRectangleMeasurements.forEach(m => { try { map.removeLayer(m); } catch(_){} });
            window.realtimeRectangleMeasurements = [];
        }
    } catch(_) {}
    
    // Clear form fields
    document.getElementById('description').value = '';
    
    // Don't clear phase selections - keep them for filtering saved spaces
    // const phaseCheckboxes = document.querySelectorAll('input[name="projectPhases"]');
    // phaseCheckboxes.forEach(checkbox => checkbox.checked = false);
    
    // Update button states
    updateSubmitButton(false);
    updateSaveButton(false);
    
    // Re-enable drawing controls
    enableDrawingControls();
    
    updateDrawingStatus('Ready to draw');
    updateToolState('none', 'idle', null, false);
}

// Update save button state
function updateSaveButton(enabled) {
    const saveButton = document.getElementById('saveSpace');
    if (saveButton) {
        saveButton.disabled = !enabled;
    }
}

// Global variable to store saved spaces layer
let savedSpacesLayer = null;

// Load and display saved spaces for the current project
async function loadProjectSpaces() {
    if (!selectedProject || !supabaseClient) {
        console.log('⚠️ Cannot load spaces - no project selected or no database connection');
        return;
    }
    // If crane was the active drawable, ensure its state is inactive for validation
    if (currentCraneGroup && isCraneModeActive === false) {
        // keep rendered crane; nothing to clear here
    }
    try {
        console.log('📋 Loading spaces for project:', selectedProject);
        
        // Get currently selected phases
        const selectedPhases = getSelectedPhases();
        console.log('🔍 Selected phases for filtering:', selectedPhases);
        
        // Fetch spaces from database
        const { data: spaces, error } = await supabaseClient
            .from('project_spaces')
            .select(`
                *,
                phase_space_assignments(
                    project_phases!project_phase_id(id, name)
                )
            `)
            .eq('project_id', parseInt(selectedProject))
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error loading spaces:', error);
            return;
        }
        
        console.log('✅ Loaded all spaces:', spaces.length);
        
        // Filter spaces based on selected phases
        let filteredSpaces = spaces;
        if (selectedPhases.length > 0) {
            console.log('🔍 Filtering spaces with selected phases:', selectedPhases);
            filteredSpaces = spaces.filter(space => {
                const spacePhaseIds = space.phase_space_assignments?.map(assignment => 
                    assignment.project_phases?.id
                ) || [];
                
                // Check if any of the space's phases match the selected phases
                const hasMatchingPhase = selectedPhases.some(selectedPhaseId => 
                    spacePhaseIds.includes(parseInt(selectedPhaseId))
                );
                
                return hasMatchingPhase;
            });
        }
        
        console.log('🎯 Filtered spaces for selected phases:', filteredSpaces.length);
        
        // Clear existing saved spaces layer
        if (savedSpacesLayer) {
            map.removeLayer(savedSpacesLayer);
        }
        
        // Clear existing watermarks when filtering
        if (window.watermarkMarkers) {
            window.watermarkMarkers.forEach(marker => marker.remove());
            window.watermarkMarkers = [];
        }
        
        // Create new layer for saved spaces
        savedSpacesLayer = new L.FeatureGroup();
        map.addLayer(savedSpacesLayer);
        
        // Display each filtered space
        filteredSpaces.forEach(space => {
            displaySavedSpace(space);
        });

        // Cleanup any transient crane UI left from drawing (rotate handles, labels)
        try {
            if (window.craneRotateHandle && savedSpacesLayer) {
                try { window.map.removeLayer(window.craneRotateHandle); } catch(_) {}
            }
            window.craneRotateHandle = null;
            window.craneRealtimeLabels = [];
        } catch(_) {}
        
        // Update space count in UI
        updateSpaceCount(filteredSpaces.length);
        
    } catch (error) {
        console.error('❌ Error in loadProjectSpaces:', error);
    }
}

// Display a single saved space on the map
function displaySavedSpace(space) {
    try {
        if (!space.geometry) {
            console.warn('⚠️ Space has no geometry:', space);
            return;
        }
        
        // Get category info first (needed for phase coverage logic)
        const categoryInfo = SPACE_CATEGORIES.find(cat => cat.name === space.category);
        
        // Check if this is a crane shape (has multiple features with 'part' properties)
        const isCraneShape = space.geometry && space.geometry.type === 'FeatureCollection' && 
                            space.geometry.features && space.geometry.features.some(f => f.properties && f.properties.part);
        
        // Special handling for fences (LineString) to match Logistics styling
        if (space.geometry.type === 'LineString') {
            try {
                const coordinates = space.geometry.coordinates;
                const latLngs = coordinates.map(c => L.latLng(c[1], c[0]));
                const fenceLayer = L.polyline(latLngs, {
                    color: '#ffd700', // yellow
                    weight: 3,
                    opacity: 0.9
                });
                // mark as saved-space
                try { if (fenceLayer && fenceLayer._path) fenceLayer._path.classList.add('saved-space-layer'); } catch(_) {}
                
        // Add click handler to make it selectable
        fenceLayer.on('click', function() {
            currentShape = fenceLayer;
            updateSubmitButton();
            clearMapError();
            // Update state tracking
            updateToolState('edit', 'editing', fenceLayer, false);
        });
        
        // Setup custom editing for this shape (with delay to ensure shape is fully initialized)
        setTimeout(() => {
            if (window.CustomEditing && typeof window.CustomEditing.setupShapeClickHandler === 'function') {
                try {
                    window.CustomEditing.setupShapeClickHandler(fenceLayer);
                } catch (error) {
                    console.warn('Error setting up custom editing for fence:', error);
                }
            }
        }, 100);
                
                savedSpacesLayer.addLayer(fenceLayer);
                return;
            } catch (e) {
                console.warn('⚠️ Failed to render LineString fence:', e);
                return;
            }
        }
        
        let shapeColor, fillColor;
        
        if (isCraneShape) {
            // Crane shapes use their own color scheme
            shapeColor = '#1f2937';  // Dark grey for crane pad
            fillColor = '#1f2937';
        } else {
            // Regular shapes use category colors
            shapeColor = categoryInfo?.color || '#3b82f6';  // Use category color or default blue
            fillColor = shapeColor;
        }
        
        // Always show category colors by default
        let fillOpacity = 0.3;
        let weight = 2;
        
        // Only apply phase-based styling if phases are actually selected
        const selectedPhases = getSelectedPhases();
        if (selectedPhases.length > 0) {
            const spacePhaseIds = space.phase_space_assignments?.map(assignment => 
                assignment.project_phases?.id
            ) || [];
            
            // If multiple phases are selected, check if space covers ALL of them
            if (selectedPhases.length > 1) {
                const coversAllPhases = selectedPhases.every(selectedPhaseId => 
                    spacePhaseIds.includes(parseInt(selectedPhaseId))
                );
                
                if (!coversAllPhases) {
                    // Use red border for incomplete coverage, but keep category color for fill
                    shapeColor = '#dc2626';  // Red border for incomplete coverage
                    fillColor = categoryInfo?.color || '#3b82f6';  // Keep category color for fill
                    fillOpacity = 0.2;  // More transparent for incomplete
                    weight = 3;  // Thicker border for incomplete
                }
            }
        }
        
        // Create Leaflet layer from GeoJSON geometry
        let layer;
        
        if (isCraneShape) {
            // Handle crane shapes with different styling for each part and suppress any points/pins
            layer = L.geoJSON(space.geometry, {
                style: function(feature) {
                    const part = feature.properties?.part;
                    if (part === 'pad') {
                        return { color: '#1f2937', fillColor: '#1f2937', fillOpacity: 0.6, weight: 2, opacity: 0.8 };
                    } else if (part === 'sweep' || part === 'sector') {
                        return { color: '#dc2626', fillColor: '#f59e0b', fillOpacity: 0.25, weight: 3, opacity: 0.8, dashArray: '10, 5' };
                    } else if (part === 'radius') {
                        // Hide radius line in saved crane shapes - it's only for drawing
                        return { color: 'transparent', weight: 0, opacity: 0 };
                    }
                    // Hide any point features by default
                    if (feature && feature.geometry && feature.geometry.type === 'Point') {
                        return { color: 'transparent', weight: 0, opacity: 0 };
                    }
                    // Fallback styling
                    return { color: '#1f2937', fillColor: '#1f2937', fillOpacity: 0.3, weight: 2, opacity: 0.8 };
                },
                pointToLayer: function(feature, latlng) {
                    // Suppress pins/handles from saved geometry
                    return L.circleMarker(latlng, { radius: 0, opacity: 0, fillOpacity: 0 });
                }
            });
            try { layer._isCraneShape = true; } catch(_) {}
            try { layer._spaceId = space.id; } catch(_) {}
            try { layer._spaceData = space; } catch(_) {}
            // Ensure sublayers are clickable for selection
            try {
                layer.eachLayer(sub => {
                    sub.on('click', function(e){
                        e.originalEvent?.stopPropagation?.();
                        currentShape = layer; // select the group, not a sub-part
                        updateSubmitButton();
                        clearMapError();
                        updateToolState('edit', 'editing', layer, false);
                    });
                });
            } catch(_) {}
        } else {
            // Regular shapes use standard styling
            layer = L.geoJSON(space.geometry, {
                style: {
                    color: shapeColor,
                    fillColor: fillColor,
                    fillOpacity: fillOpacity,
                    weight: weight,
                    opacity: 0.8
                }
            });
        }
        
        // Apply watermark for company name - BULLETPROOF APPROACH (skip for fences/lines)
        if (space.trade && space.geometry.type !== 'LineString') {
            console.log('🏷️ Applying watermark to saved space for company:', space.trade);
            createShapeWatermark(layer, space.trade);
        }

        // Mark saved space layers for pointer disabling during drawing
        try {
            const each = (l) => {
                if (l && l._path) {
                    l._path.classList.add('saved-space-layer');
                }
            };
            if (layer && layer.eachLayer) {
                layer.eachLayer(each);
            } else if (layer && layer._path) {
                layer._path.classList.add('saved-space-layer');
            }
        } catch(_) {}
        
        // Add space information to popup
        const phaseNames = space.phase_space_assignments?.map(assignment => 
            assignment.project_phases?.name || 'Unknown Phase'
        ).join(', ') || 'No phases assigned';
        
        const area = space.geometry.type === 'Polygon' ? 
            (window.PolygonTool && window.PolygonTool.calculatePolygonArea ? 
                window.PolygonTool.calculatePolygonArea(space.geometry.coordinates[0]) :
                (window.calculatePolygonArea ? window.calculatePolygonArea(space.geometry.coordinates[0]) : 0)) : 0;
        
        // Add phase coverage information
        let phaseCoverageInfo = '';
        if (selectedPhases.length > 1) {
            const spacePhaseIds = space.phase_space_assignments?.map(assignment => 
                assignment.project_phases?.id
            ) || [];
            
            const coversAllPhases = selectedPhases.every(selectedPhaseId => 
                spacePhaseIds.includes(parseInt(selectedPhaseId))
            );
            
            if (coversAllPhases) {
                phaseCoverageInfo = '<p style="color: #059669; font-weight: bold;">✅ Covers all selected phases</p>';
            } else {
                // Get the names of missing phases
                const missingPhaseIds = selectedPhases.filter(selectedPhaseId => 
                    !spacePhaseIds.includes(parseInt(selectedPhaseId))
                );
                
                // Get phase names for missing phases
                const missingPhaseNames = missingPhaseIds.map(phaseId => {
                    const phaseCheckbox = document.querySelector(`input[name="projectPhases"][value="${phaseId}"]`);
                    return phaseCheckbox ? phaseCheckbox.nextElementSibling.textContent.trim() : `Phase ${phaseId}`;
                });
                
                phaseCoverageInfo = `
                    <p style="color: #dc2626; font-weight: bold;">⚠️ Space not present in following selected phases:</p>
                    <ul style="color: #dc2626; margin: 5px 0; padding-left: 20px;">
                        ${missingPhaseNames.map(name => `<li>${name}</li>`).join('')}
                    </ul>
                `;
            }
        }
        
        layer.bindPopup(`
            <div class="space-popup">
                <h4>${escapeHtml(space.space_name || '')}</h4>
                <p><strong>Category:</strong> ${escapeHtml(space.category || '')}</p>
                <p><strong>Trade:</strong> ${escapeHtml(space.trade || '')}</p>
                <p><strong>Assigned Phases:</strong> ${escapeHtml(phaseNames || '')}</p>
                ${phaseCoverageInfo}
                <p><strong>Area:</strong> ${Math.round(area)} sq ft</p>
                <p><strong>Description:</strong> ${escapeHtml(space.description || 'No description')}</p>
                <div class="space-actions">
                    <button onclick="editSavedSpace(${space.id})" class="btn btn-sm btn-primary">Edit</button>
                    <button onclick="deleteSavedSpace(${space.id})" class="btn btn-sm btn-danger">Delete</button>
                </div>
            </div>
        `);
        
        // Add click handler to select this space (support GeoJSON/group)
        const onSelect = function() {
            console.log('📍 Saved space clicked:', space);
            currentShape = layer;
            try { window.lastSelectedSpaceLayer = layer; } catch(_) {}
            try { window.lastSelectedSpaceId = space.id; } catch(_) {}
            updateSubmitButton();
            clearMapError();
            // Update state tracking
            updateToolState('edit', 'editing', layer, false);
        };
        layer.on('click', onSelect);
        try { layer.eachLayer(sl => sl.on('click', e => { e.originalEvent?.stopPropagation?.(); onSelect(); })); } catch(_) {}
        
        // Setup custom editing for this shape (with delay to ensure shape is fully initialized)
        setTimeout(() => {
            if (window.CustomEditing && typeof window.CustomEditing.setupShapeClickHandler === 'function') {
                try {
                    window.CustomEditing.setupShapeClickHandler(layer);
                } catch (error) {
                    console.warn('Error setting up custom editing for saved space:', error);
                }
            }
        }, 100);
        
        // Add to saved spaces layer
        savedSpacesLayer.addLayer(layer);

        // Attach space id to layer for selection/delete
        try { layer._spaceId = space.id; } catch(_) {}
        try { layer._spaceData = space; } catch(_) {}
        try { layer._isCraneShape = !!isCraneShape; } catch(_) {}
        
        console.log('✅ Displayed saved space:', space.space_name);
        
    } catch (error) {
        console.error('❌ Error displaying saved space:', error);
    }
}

// Calculate area from polygon coordinates
// ✅ MIGRATED: calculatePolygonArea moved to src/tool/polygon.js

// Update space count in UI
function updateSpaceCount(count) {
    // Find or create space count display
    let countDisplay = document.getElementById('spaceCount');
    if (!countDisplay) {
        countDisplay = document.createElement('div');
        countDisplay.id = 'spaceCount';
        countDisplay.className = 'space-count';
        countDisplay.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            color: #059669;
            border: 1px solid #10b981;
            z-index: 1000;
            max-width: 250px;
            text-align: center;
        `;
        document.getElementById('map').appendChild(countDisplay);
    }
    
    const selectedPhases = getSelectedPhases();
    let displayText;
    
    if (selectedPhases.length === 0) {
        displayText = `${count} saved space${count !== 1 ? 's' : ''}\n(Select phases to filter)`;
    } else if (selectedPhases.length === 1) {
        displayText = `${count} space${count !== 1 ? 's' : ''} for selected phase`;
    } else {
        displayText = `${count} space${count !== 1 ? 's' : ''} for selected phases\n🟢 Green: covers all phases\n🔴 Red: missing phases`;
    }
    
    countDisplay.textContent = displayText;
}

// Edit a saved space
async function editSavedSpace(spaceId) {
    try {
        console.log('✏️ Editing space:', spaceId);
        
        // Fetch space details
        const { data: space, error } = await supabaseClient
            .from('project_spaces')
            .select(`
                *,
                phase_space_assignments(
                    project_phases!project_phase_id(id, name)
                )
            `)
            .eq('id', spaceId)
            .single();
        
        if (error) {
            console.error('❌ Error fetching space:', error);
            alert('Failed to load space details');
            return;
        }
        
        // Create edit modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.5) !important;
            z-index: 999999 !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
        `;
        
        const currentPhases = space.phase_space_assignments?.map(a => a.project_phases.id) || [];
        
        modal.innerHTML = `
            <div style="
                background: white !important;
                border-radius: 12px !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2) !important;
                max-width: 500px !important;
                width: 90% !important;
                max-height: 90vh !important;
                overflow-y: auto !important;
            ">
                <div style="
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                    padding: 1.5rem !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                ">
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Edit Space</h3>
                    <button onclick="this.closest('.modal-overlay').remove()" style="
                        background: none !important;
                        border: none !important;
                        font-size: 1.5rem !important;
                        color: #64748b !important;
                        cursor: pointer !important;
                        padding: 0 !important;
                        width: 30px !important;
                        height: 30px !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        border-radius: 50% !important;
                    ">&times;</button>
                </div>
                <div style="padding: 1.5rem !important;">
                    <form id="editSpaceForm">
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Space Name *</label>
                            <input type="text" id="editSpaceName" value="${space.space_name}" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Category *</label>
                            <select id="editSpaceCategory" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                                <option value="Office" ${space.category === 'Office' ? 'selected' : ''}>Office</option>
                                <option value="Storage" ${space.category === 'Storage' ? 'selected' : ''}>Storage</option>
                                <option value="Workshop" ${space.category === 'Workshop' ? 'selected' : ''}>Workshop</option>
                                <option value="Parking" ${space.category === 'Parking' ? 'selected' : ''}>Parking</option>
                                <option value="Equipment" ${space.category === 'Equipment' ? 'selected' : ''}>Equipment</option>
                                <option value="Other" ${space.category === 'Other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Trade/Company *</label>
                            <input type="text" id="editSpaceTrade" value="${escapeHtml(space.trade || '')}" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Description</label>
                            <textarea id="editSpaceDescription" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem; min-height: 80px;">${escapeHtml(space.description || '')}</textarea>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Project Phases *</label>
                            <div id="editPhaseCheckboxes" style="border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; max-height: 150px; overflow-y: auto;">
                                <!-- Phases will be populated here -->
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                            <button type="button" onclick="this.closest('.modal-overlay').remove()" style="
                                padding: 0.75rem 1.5rem;
                                border: 1px solid #d1d5db;
                                border-radius: 6px;
                                background: white;
                                color: #374151;
                                cursor: pointer;
                                font-size: 0.9rem;
                            ">Cancel</button>
                            <button type="submit" style="
                                padding: 0.75rem 1.5rem;
                                border: none;
                                border-radius: 6px;
                                background: #0078d4;
                                color: white;
                                cursor: pointer;
                                font-size: 0.9rem;
                            ">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate phase checkboxes
        populateEditPhaseCheckboxes(space.project_id, currentPhases);
        
        // Handle form submission
        document.getElementById('editSpaceForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateSavedSpace(spaceId, modal);
        });
        
    } catch (error) {
        console.error('❌ Error in editSavedSpace:', error);
        alert('Failed to open edit dialog');
    }
}

// Populate phase checkboxes for edit modal
async function populateEditPhaseCheckboxes(projectId, selectedPhases = []) {
    try {
        const { data: phases, error } = await supabaseClient
            .from('project_phases')
            .select('*')
            .eq('project_id', projectId)
            .order('phase_order', { ascending: true });
        
        if (error) {
            console.error('❌ Error loading phases:', error);
            return;
        }
        
        const container = document.getElementById('editPhaseCheckboxes');
        container.innerHTML = '';
        
        phases.forEach(phase => {
            const isSelected = selectedPhases.includes(phase.id);
            const checkbox = document.createElement('div');
            checkbox.style.cssText = 'display: flex; align-items: center; margin-bottom: 0.5rem;';
            checkbox.innerHTML = `
                <input type="checkbox" id="editPhase_${phase.id}" value="${phase.id}" ${isSelected ? 'checked' : ''} style="margin-right: 0.5rem;">
                <label for="editPhase_${phase.id}" style="font-size: 0.9rem; color: #374151;">${phase.name}</label>
            `;
            container.appendChild(checkbox);
        });
        
    } catch (error) {
        console.error('❌ Error populating edit phase checkboxes:', error);
    }
}

// Update saved space
async function updateSavedSpace(spaceId, modal) {
    try {
        const formData = {
            space_name: document.getElementById('editSpaceName').value,
            category: document.getElementById('editSpaceCategory').value,
            trade: document.getElementById('editSpaceTrade').value,
            description: document.getElementById('editSpaceDescription').value
        };
        
        // Update space in database
        const { error: spaceError } = await supabaseClient
            .from('project_spaces')
            .update(formData)
            .eq('id', spaceId);
        
        if (spaceError) {
            console.error('❌ Error updating space:', spaceError);
            alert('Failed to update space');
            return;
        }
        
        // Update phase assignments
        const selectedPhases = Array.from(document.querySelectorAll('#editPhaseCheckboxes input:checked'))
            .map(checkbox => parseInt(checkbox.value));
        
        // Delete existing assignments
        await supabaseClient
            .from('phase_space_assignments')
            .delete()
            .eq('project_space_id', spaceId);
        
        // Create new assignments
        for (const phaseId of selectedPhases) {
            await supabaseClient
                .from('phase_space_assignments')
                .insert([{
                    project_space_id: spaceId,
                    project_phase_id: phaseId
                }]);
        }
        
        // Close modal
        modal.remove();
        
        // Reload spaces
        await loadProjectSpaces();
        
        alert('Space updated successfully!');
        
    } catch (error) {
        console.error('❌ Error updating space:', error);
        alert('Failed to update space');
    }
}

// Delete a saved space
async function deleteSavedSpace(spaceId) {
    if (!confirm('Are you sure you want to delete this space? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log('🗑️ Deleting space:', spaceId);
        
        // Delete phase assignments first
        await supabaseClient
            .from('phase_space_assignments')
            .delete()
            .eq('project_space_id', spaceId);
        
        // Delete the space
        const { error } = await supabaseClient
            .from('project_spaces')
            .delete()
            .eq('id', spaceId);
        
        if (error) {
            console.error('❌ Error deleting space:', error);
            alert('Failed to delete space');
            return;
        }
        
        // Reload spaces
        await loadProjectSpaces();
        
        alert('Space deleted successfully!');
        
    } catch (error) {
        console.error('❌ Error deleting space:', error);
        alert('Failed to delete space');
    }
}

// Load and merge with original construction campus TopoJSON
async function loadConstructionCampusTopoJSON() {
    try {
        const response = await fetch('construction-campusog.json');
        const originalData = await response.json();
        console.log('Original construction campus TopoJSON loaded');
        return originalData;
    } catch (error) {
        console.error('Error loading construction campus TopoJSON:', error);
        return null;
    }
}

/**
 * Export the drawn shape to TopoJSON format
 */
async function exportToTopoJSON(requestData) {
    TopoJSONDebug.log('Starting TopoJSON export', requestData);
    
    try {
        // Get the original TopoJSON for reference
        const originalTopoJSON = window.originalTopoJSON;
        if (!originalTopoJSON) {
            TopoJSONDebug.error('Original TopoJSON not loaded');
            return null;
        }
        
        // Validate geometry data
        if (!requestData.geometry || !requestData.geometry.coordinates) {
            TopoJSONDebug.error('Invalid geometry data', requestData.geometry);
            return null;
        }
        
        TopoJSONDebug.log('Processing geometry', {
            type: requestData.geometry.type,
            coordinatesLength: requestData.geometry.coordinates.length
        });
        
        // Extract coordinates from the drawn shape
        let coordinates = [];
        if (requestData.geometry.type === 'Polygon') {
            coordinates = requestData.geometry.coordinates[0];
        } else if (requestData.geometry.type === 'MultiPolygon') {
            coordinates = requestData.geometry.coordinates[0][0];
        } else {
            TopoJSONDebug.error('Unsupported geometry type', requestData.geometry.type);
            return null;
        }
        
        if (coordinates.length < 3) {
            TopoJSONDebug.error('Invalid coordinates - need at least 3 points', coordinates);
            return null;
        }
        
        TopoJSONDebug.log('Extracted coordinates', {
            count: coordinates.length,
            coordinates: coordinates
        });
        
        // Create a deep copy of the original TopoJSON
        const integratedTopoJSON = JSON.parse(JSON.stringify(originalTopoJSON));
        
        // Get the transform parameters from the original TopoJSON
        const transform = originalTopoJSON.transform;
        const scale = transform.scale;
        const translate = transform.translate;
        
        TopoJSONDebug.log('Using transform parameters', { scale, translate });
        
        // Convert coordinates to TopoJSON format
        const arcPoints = [];
        let previousPoint = null;
        
        for (let i = 0; i < coordinates.length; i++) {
            const coord = coordinates[i];
            const lng = coord[0];
            const lat = coord[1];
            
            // Apply inverse transform: (coord - translate) / scale
            const x = Math.round((lng - translate[0]) / scale[0]);
            const y = Math.round((lat - translate[1]) / scale[1]);
            
            if (previousPoint === null) {
                // First point: absolute coordinates
                arcPoints.push([x, y]);
                TopoJSONDebug.log('First arc point (absolute)', [x, y]);
            } else {
                // Subsequent points: relative differences from the previous absolute point
                const deltaX = x - previousPoint[0];
                const deltaY = y - previousPoint[1];
                arcPoints.push([deltaX, deltaY]);
                TopoJSONDebug.log('Arc point (relative)', [deltaX, deltaY]);
            }
            previousPoint = [x, y];
        }
        
        // Ensure the polygon closes by adding a segment back to the first point
        if (arcPoints.length > 0) {
            const firstPoint = arcPoints[0];
            const lastCoord = coordinates[coordinates.length - 1];
            const lastLng = lastCoord[0];
            const lastLat = lastCoord[1];
            
            const lastX = Math.round((lastLng - translate[0]) / scale[0]);
            const lastY = Math.round((lastLat - translate[1]) / scale[1]);
            
            const closingDeltaX = firstPoint[0] - lastX;
            const closingDeltaY = firstPoint[1] - lastY;
            
            // Only add if it's not already closed
            if (closingDeltaX !== 0 || closingDeltaY !== 0) {
                arcPoints.push([closingDeltaX, closingDeltaY]);
                TopoJSONDebug.log('Added closing arc segment', [closingDeltaX, closingDeltaY]);
            }
        }
        
        // Add the new arc to the arcs array
        const newArcIndex = integratedTopoJSON.arcs.length;
        integratedTopoJSON.arcs.push(arcPoints);
        
        TopoJSONDebug.log('Added new arc', {
            arcIndex: newArcIndex,
            arcPoints: arcPoints.length
        });
        
        // Create properties for the staging request
        const properties = {
            OBJECTID: Date.now(),
            ORBLD_ID: requestData.requestId,
            County: 'Washington',
            CONTRIBUTOR: 'Staging Space Tool',
            SOURCE: 'User Drawing',
            SOURCE_TYPE: 'Interactive',
            SOURCE_DATE: new Date().toISOString().split('T')[0],
            LAG: -9999,
            ROOF_MEAN: -9999,
            ROOF_MAX: -9999,
            YEAR_BUILT: '2024',
            SQ_FT: requestData.requestedArea,
            REVIEW_IMG: 'Not available',
            REVIEW_IMG_YEAR: '-9999',
            REVIEW_DATE: new Date().toISOString().split('T')[0],
            'Building ID': 'SPACE-REQ',
            'Space Category': requestData.spaceCategory,
            'Company Name': requestData.companyName,
            'Contact Name': requestData.contactName,
            'Contact Email': requestData.contactEmail,
            'Project': requestData.project,
            'Request Date': new Date().toISOString()
        };
        
        // Create the new geometry
        const newGeometry = {
            type: "Polygon",
            arcs: [[newArcIndex]],
            properties: properties
        };
        
        // Add the new geometry to the existing "Test Split V2" object
        if (integratedTopoJSON.objects["Test Split V2"] && 
            integratedTopoJSON.objects["Test Split V2"].geometries) {
            
            integratedTopoJSON.objects["Test Split V2"].geometries.push(newGeometry);
            
            TopoJSONDebug.log('Integration completed', {
                totalArcs: integratedTopoJSON.arcs.length,
                totalGeometries: integratedTopoJSON.objects["Test Split V2"].geometries.length,
                newArcIndex: newArcIndex
            });
        } else {
            TopoJSONDebug.error('Could not find "Test Split V2" object or geometries array');
            return null;
        }
        
        TopoJSONDebug.log('TopoJSON export completed successfully', {
            totalArcs: integratedTopoJSON.arcs.length,
            totalGeometries: integratedTopoJSON.objects["Test Split V2"].geometries.length
        });
        
        return integratedTopoJSON;
        
    } catch (error) {
        TopoJSONDebug.error('Error in exportToTopoJSON', error);
        return null;
    }
}

// Generate unique request ID
function generateRequestId() {
    return 'REQ-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Submit request
async function submitRequest() {
    // This function is now used for exporting all saved spaces for the project
    await exportProjectSpaces();
}

// Export all saved spaces for the current project
async function exportProjectSpaces() {
    if (!selectedProject) {
        alert('Please select a project first.');
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('submitRequest');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    
    try {
        console.log('📤 Exporting spaces for project:', selectedProject);
        
        // Fetch all saved spaces for the project
        const { data: spaces, error } = await supabaseClient
            .from('project_spaces')
            .select(`
                *,
                phase_space_assignments(
                    project_phases!project_phase_id(name)
                )
            `)
            .eq('project_id', parseInt(selectedProject))
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Error loading spaces for export:', error);
            alert('Failed to load spaces for export');
            return;
        }
        
        if (spaces.length === 0) {
            alert('No saved spaces found for this project. Save some spaces first!');
            return;
        }
        
        console.log('✅ Found spaces to export:', spaces.length);
        
        // Create GeoJSON export with all spaces
        const geoJSONFeatures = spaces.map(space => {
            const phaseNames = space.phase_space_assignments?.map(assignment => 
                assignment.project_phases?.name || 'Unknown Phase'
            ).join(', ') || 'No phases assigned';
            
            const area = space.geometry.type === 'Polygon' ? 
                (window.PolygonTool && window.PolygonTool.calculatePolygonArea ? 
                    window.PolygonTool.calculatePolygonArea(space.geometry.coordinates[0]) :
                    (window.calculatePolygonArea ? window.calculatePolygonArea(space.geometry.coordinates[0]) : 0)) : 0;
            
            return {
                        "type": "Feature",
                        "properties": {
                    "spaceId": space.id,
                    "spaceName": space.space_name,
                    "spaceCategory": space.category,
                    "trade": space.trade,
                    "description": space.description || '',
                    "phases": phaseNames,
                    "area": Math.round(area),
                    "createdAt": space.created_at,
                    "project": PROJECTS[selectedProject]?.name || 'Unknown Project'
                },
                "geometry": space.geometry
            };
        });
        
        const cleanGeoJSON = {
            "type": "FeatureCollection",
            "features": geoJSONFeatures
        };
        
        console.log('📋 GeoJSON export created:', cleanGeoJSON);
        
        // Create downloadable GeoJSON file
            const geoJSONStr = JSON.stringify(cleanGeoJSON, null, 2);
            const geoJSONBlob = new Blob([geoJSONStr], {type: 'application/json'});
            const geoJSONUrl = URL.createObjectURL(geoJSONBlob);
            const geoJSONLink = document.createElement('a');
            geoJSONLink.href = geoJSONUrl;
        geoJSONLink.download = `project-spaces-${PROJECTS[selectedProject]?.name?.replace(/\s+/g, '-') || 'project'}-${new Date().toISOString().split('T')[0]}.geojson`;
            geoJSONLink.click();
            URL.revokeObjectURL(geoJSONUrl);
            
        // Create TopoJSON export for Power BI compatibility
        const topoJSONData = await exportSpacesToTopoJSON(spaces);
        
        if (topoJSONData) {
            // Create downloadable TopoJSON file
            const topoJSONStr = JSON.stringify(topoJSONData, null, 2);
            const topoJSONBlob = new Blob([topoJSONStr], {type: 'application/json'});
            const topoJSONUrl = URL.createObjectURL(topoJSONBlob);
            const topoJSONLink = document.createElement('a');
            topoJSONLink.href = topoJSONUrl;
            topoJSONLink.download = `project-spaces-topojson-${PROJECTS[selectedProject]?.name?.replace(/\s+/g, '-') || 'project'}-${new Date().toISOString().split('T')[0]}.json`;
            topoJSONLink.click();
            URL.revokeObjectURL(topoJSONUrl);
        }
        
        // Show success message
        alert(`Successfully exported ${spaces.length} space${spaces.length !== 1 ? 's' : ''} for ${PROJECTS[selectedProject]?.name || 'project'}!`);
        
        console.log('✅ Export completed successfully');
        
    } catch (error) {
        console.error('❌ Error in exportProjectSpaces:', error);
        alert('Failed to export spaces: ' + error.message);
    } finally {
        // Reset button state
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

// Export spaces to TopoJSON format for Power BI compatibility
async function exportSpacesToTopoJSON(spaces) {
    try {
        // Load the original construction campus TopoJSON
        const originalTopoJSON = await loadConstructionCampusTopoJSON();
        if (!originalTopoJSON) {
            console.warn('⚠️ Could not load original TopoJSON, creating standalone export');
            return null;
        }
        
        // Create a copy for modification
        const integratedTopoJSON = JSON.parse(JSON.stringify(originalTopoJSON));
        
        // Add each space as a new geometry
        spaces.forEach((space, index) => {
            if (space.geometry && space.geometry.type === 'Polygon') {
                // Convert GeoJSON coordinates to TopoJSON format
                const coordinates = space.geometry.coordinates[0];
                const newArc = coordinates.map(coord => [coord[0], coord[1]]);
                
                // Add the new arc to the arcs array
                const newArcIndex = integratedTopoJSON.arcs.length;
                integratedTopoJSON.arcs.push(newArc);
                
                // Create properties for the space
                const phaseNames = space.phase_space_assignments?.map(assignment => 
                    assignment.project_phases?.name || 'Unknown Phase'
                ).join(', ') || 'No phases assigned';
                
                const area = window.PolygonTool && window.PolygonTool.calculatePolygonArea ? 
                    window.PolygonTool.calculatePolygonArea(space.geometry.coordinates[0]) :
                    (window.calculatePolygonArea ? window.calculatePolygonArea(space.geometry.coordinates[0]) : 0);
                
                const properties = {
                    OBJECTID: Date.now() + index,
                    ORBLD_ID: `SPACE-${space.id}`,
                    County: 'Washington',
                    CONTRIBUTOR: 'Project Space Planning Tool',
                    SOURCE: 'User Planning',
                    SOURCE_TYPE: 'Interactive',
                    SOURCE_DATE: new Date().toISOString().split('T')[0],
                    LAG: -9999,
                    ROOF_MEAN: -9999,
                    ROOF_MAX: -9999,
                    YEAR_BUILT: '2024',
                    SQ_FT: Math.round(area),
                    REVIEW_IMG: 'Not available',
                    REVIEW_IMG_YEAR: '-9999',
                    REVIEW_DATE: new Date().toISOString().split('T')[0],
                    'Building ID': `SPACE-${space.id}`,
                    'Space Name': space.space_name,
                    'Space Category': space.category,
                    'Trade': space.trade,
                    'Phases': phaseNames,
                    'Description': space.description || '',
                    'Project': PROJECTS[selectedProject]?.name || 'Unknown Project',
                    'Export Date': new Date().toISOString()
                };
                
                // Create the new geometry
                const newGeometry = {
                    type: "Polygon",
                    arcs: [[newArcIndex]],
                    properties: properties
                };
                
                // Add the new geometry to the existing "Test Split V2" object
                if (integratedTopoJSON.objects["Test Split V2"] && 
                    integratedTopoJSON.objects["Test Split V2"].geometries) {
                    
                    integratedTopoJSON.objects["Test Split V2"].geometries.push(newGeometry);
                }
            }
        });
        
        console.log('✅ TopoJSON export created with', spaces.length, 'spaces');
        return integratedTopoJSON;
        
    } catch (error) {
        console.error('❌ Error creating TopoJSON export:', error);
        return null;
    }
}

// Confirm submit (from preview modal)
function confirmSubmit() { /* legacy no-op */ }

// Modal functions
function closePreviewModal() { /* legacy no-op */ }

function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

// Reset form for new request
function resetForm() {
    // Clear form fields
    document.querySelectorAll('input, select, textarea').forEach(field => {
        field.value = '';
        field.classList.remove('invalid');
    });
    
    // Clear drawing
    clearDrawing();
    
    // Close success modal
    closeSuccessModal();
    
    // Reset map view
    resetMapView();
    
    updateDrawingStatus('Ready for new request');
}

// Utility function to calculate area in square feet
function calculateArea(latLngs) {
    const area = L.GeometryUtil.geodesicArea(latLngs);
    return Math.round(area * 10.764); // Convert square meters to square feet
}

// Export functions for Power Platform integration
window.StagingSpaceTool = {
    getRequestData: collectFormData,
    validateForm: validateForm,
    resetForm: resetForm,
    submitRequest: submitRequest
};

// --- Rotation helpers for polygons (used for converted rectangles) ---
function clearDistanceLabels(layer) {
    try {
        if (layer && layer.distanceLabels && Array.isArray(layer.distanceLabels)) {
            layer.distanceLabels.forEach(lbl => { try { map.removeLayer(lbl); } catch(_) {} });
            layer.distanceLabels = [];
        }
    } catch(_) {}
}

// ✅ MIGRATED: enablePolygonRotation moved to src/tool/polygon/edit.js

// ✅ MIGRATED: repositionPolygonRotateHandle moved to src/tool/polygon/edit.js

// ✅ MIGRATED: updatePolygonWatermark moved to src/tool/polygon/edit.js

// ✅ MIGRATED: rotatePointAround moved to src/tool/polygon/edit.js

// ✅ MIGRATED: All rect model helpers moved to src/tool/rectangle/edit.js

// ✅ MIGRATED: computeRectModelFromPolygon moved to src/tool/rectangle/edit.js

// ✅ MIGRATED: buildRectLatLngsFromModel moved to src/tool/rectangle/edit.js

// ✅ MIGRATED: enableRectScaleMode, disableRectScaleMode, updateRectScaleHandles moved to src/tool/rectangle/edit.js
