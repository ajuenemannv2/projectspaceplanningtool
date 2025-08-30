// ============================================================================
// STAGING SPACE REQUEST TOOL - MAIN APPLICATION
// ============================================================================

// Global variables
let map;
let drawnItems;
let currentShape = null;
let selectedCampus = 'ronler';

// Campus configuration (will be populated from admin panel)
const CAMPUSES = {
    ronler: {
        name: 'Ronler',
        coordinates: [45.5442515697061, -122.91389689455964],
        zoom: 16
    },
    aloha: {
        name: 'Aloha',
        coordinates: [45.493682619637106, -122.88441018345922],
        zoom: 16
    },
    houston: {
        name: 'Houston',
        coordinates: [37.37607986263847, -121.97491259987373],
        zoom: 16
    }
};

// Company data (will be populated from admin panel)
const COMPANIES = [
    'ABC Construction',
    'XYZ Contractors',
    'BuildRight Inc.',
    'Quality Builders',
    'Elite Construction',
    'Premier Contractors',
    'Reliable Builders',
    'Professional Construction'
];

// Application configuration
const CONFIG = {
    defaultCenter: [45.5442515697061, -122.91389689455964],
    defaultZoom: 16,
    powerAutomateEndpoint: 'https://your-tenant.flow.microsoft.com/webhook/your-webhook-id'
};

// Drawing state management
let drawingVertices = [];
let drawingMarkers = [];
let undoStack = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    initializeMap();
    initializeEventListeners();
    
    // Load admin data and populate UI
    loadAdminData();
    populateCompanyDropdown();
    populateCampusDropdown();
    
    // Set default campus and map view
    setDefaultCampus();
    
    await loadSiteLayout();
    updateDrawingStatus('Ready to draw');
});

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

function initializeMap() {
    map = L.map('map', {
        maxZoom: 22,
        minZoom: 10
    }).setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    
    // Add map layers
    const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google Satellite',
        maxZoom: 22
    });
    
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });
    
    // Add layer control
    const baseMaps = {
        "Satellite": satelliteLayer,
        "Street": streetLayer
    };
    
    satelliteLayer.addTo(map);
    L.control.layers(baseMaps).addTo(map);
    
    // Auto-switch layers based on zoom
    map.on('zoomend', function() {
        const currentZoom = map.getZoom();
        const currentLayer = map.hasLayer(satelliteLayer) ? 'satellite' : 'street';
        
        if (currentLayer === 'street' && currentZoom >= 19) {
            map.removeLayer(streetLayer);
            satelliteLayer.addTo(map);
            updateDrawingStatus('Switched to satellite view for higher zoom');
        } else if (currentLayer === 'satellite' && currentZoom < 19) {
            map.removeLayer(satelliteLayer);
            streetLayer.addTo(map);
            updateDrawingStatus('Switched to street view');
        }
    });
    
    // Initialize drawing layer and controls
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    const drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                drawError: {
                    color: '#e1e100',
                    message: '<strong>Error:</strong> Shape edges cannot cross!'
                },
                shapeOptions: {
                    color: '#0078d4',
                    fillColor: '#0078d4',
                    fillOpacity: 0.3,
                    weight: 2
                },
                showArea: false,
                showLength: false
            },
            rectangle: {
                shapeOptions: {
                    color: '#0078d4',
                    fillColor: '#0078d4',
                    fillOpacity: 0.3,
                    weight: 2
                },
                showArea: false,
                showLength: false
            },
            circle: false,
            circlemarker: false,
            marker: false,
            polyline: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });
    
    map.addControl(drawControl);
    window.drawControl = drawControl;
    
    // Initialize real-time measurements
    addRealTimeMeasurements();
    
    // Add undo button to toolbar
    addUndoButtonToToolbar();
}

// ============================================================================
// ADMIN DATA INTEGRATION
// ============================================================================

function loadAdminData() {
    // Load campuses from admin panel
    const adminCampuses = JSON.parse(localStorage.getItem('admin_campuses'));
    if (adminCampuses) {
        const activeCampuses = adminCampuses.filter(c => c.status === 'active');
        
        // Clear and rebuild CAMPUSES object
        Object.keys(CAMPUSES).forEach(key => {
            delete CAMPUSES[key];
        });
        
        activeCampuses.forEach(adminCampus => {
            CAMPUSES[adminCampus.id] = {
                name: adminCampus.name,
                coordinates: adminCampus.coordinates,
                zoom: adminCampus.zoom
            };
        });
    }

    // Load contractors from admin panel
    const adminContractors = JSON.parse(localStorage.getItem('admin_contractors'));
    if (adminContractors) {
        const activeContractors = adminContractors.filter(c => c.status === 'active');
        COMPANIES.length = 0;
        activeContractors.forEach(contractor => {
            COMPANIES.push(contractor.name);
        });
    }
}

function populateCompanyDropdown() {
    const companySelect = document.getElementById('companyName');
    if (companySelect) {
        companySelect.innerHTML = '<option value="">Select your company</option>';
        COMPANIES.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            companySelect.appendChild(option);
        });
    }
}

function populateCampusDropdown() {
    const campusSelect = document.getElementById('campusSelect');
    if (!campusSelect) return;
    
    campusSelect.innerHTML = '<option value="">Select campus</option>';
    Object.keys(CAMPUSES).forEach(key => {
        const campus = CAMPUSES[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = campus.name;
        campusSelect.appendChild(option);
    });
}

function updateCampusDropdown() {
    populateCampusDropdown();
}

function setDefaultCampus() {
    const campusSelect = document.getElementById('campusSelect');
    if (campusSelect) {
        const campusKeys = Object.keys(CAMPUSES);
        if (campusKeys.length > 0) {
            const defaultCampusKey = campusKeys[0];
            campusSelect.value = defaultCampusKey;
            
            const defaultCampus = CAMPUSES[defaultCampusKey];
            if (defaultCampus && map) {
                map.setView(defaultCampus.coordinates, defaultCampus.zoom);
            }
        }
    }
}

// ============================================================================
// NAVIGATION & UTILITIES
// ============================================================================

function navigateToCampus(campusKey) {
    const campus = CAMPUSES[campusKey];
    if (campus) {
        selectedCampus = campusKey;
        map.setView(campus.coordinates, campus.zoom);
        updateDrawingStatus(`Navigated to ${campus.name} campus`);
        
        const campusSelect = document.getElementById('campusSelect');
        if (campusSelect) {
            campusSelect.value = campusKey;
        }
    }
}

function openAdminPanel(event) {
    event.preventDefault();
    window.location.href = 'admin.html';
}

function logActivityToAdmin(action, details) {
    try {
        let activityLog = JSON.parse(localStorage.getItem('admin_activity_log')) || [];
        
        const activity = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action: action,
            user: details.contactName || 'User',
            details: details,
            status: 'completed'
        };
        
        activityLog.unshift(activity);
        
        if (activityLog.length > 1000) {
            activityLog = activityLog.slice(0, 1000);
        }
        
        localStorage.setItem('admin_activity_log', JSON.stringify(activityLog));
    } catch (error) {
        console.error('Error logging activity to admin panel:', error);
    }
}

// ============================================================================
// DRAWING CONTROLS
// ============================================================================

function disableDrawingControls() {
    if (window.drawControl && window.drawControl._toolbars.draw) {
        if (window.drawControl._toolbars.draw._modes.polygon && window.drawControl._toolbars.draw._modes.polygon.handler) {
            window.drawControl._toolbars.draw._modes.polygon.handler.disable();
        }
        if (window.drawControl._toolbars.draw._modes.rectangle && window.drawControl._toolbars.draw._modes.rectangle.handler) {
            window.drawControl._toolbars.draw._modes.rectangle.handler.disable();
        }
        
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
}

function enableDrawingControls() {
    if (window.drawControl && window.drawControl._toolbars.draw) {
        if (window.drawControl._toolbars.draw._modes.polygon && window.drawControl._toolbars.draw._modes.polygon.handler) {
            window.drawControl._toolbars.draw._modes.polygon.handler.enable();
        }
        if (window.drawControl._toolbars.draw._modes.rectangle && window.drawControl._toolbars.draw._modes.rectangle.handler) {
            window.drawControl._toolbars.draw._modes.rectangle.handler.enable();
        }
        
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
}

// ============================================================================
// SHAPE MANAGEMENT
// ============================================================================

function onShapeCreated(e) {
    if (currentShape) {
        return; // Prevent multiple shapes
    }
    
    const layer = e.layer;
    currentShape = layer;
    
    // Add to undo stack
    undoStack.push({
        type: 'draw',
        layer: layer,
        markers: [...drawingMarkers]
    });
    
    // Add event listeners for editing
    layer.on('click', function() {
        // Enable editing mode
        if (window.drawControl && window.drawControl._toolbars.edit) {
            window.drawControl._toolbars.edit._modes.edit.handler.enable();
            
            // Add delete functionality to vertex markers
            window.drawControl._toolbars.edit._modes.edit.handler._markersGroup.eachLayer(function(marker) {
                marker.on('click', function() {
                    if (confirm('Delete this vertex?')) {
                        marker.remove();
                    }
                });
            });
        }
    });
    
    layer.on('dblclick', function() {
        // Enable editing mode on double click
        if (window.drawControl && window.drawControl._toolbars.edit) {
            window.drawControl._toolbars.edit._modes.edit.handler.enable();
        }
    });
    
    // Disable drawing controls
    disableDrawingControls();
    
    // Update form validation
    validateForm();
    updateUndoButton();
}

function onShapeEdited(e) {
    const layers = e.layers;
    layers.eachLayer(function(layer) {
        if (layer === currentShape) {
            // Update measurements for edited shape
            if (layer.getLatLngs) {
                const latLngs = layer.getLatLngs();
                updateDrawingMeasurements(latLngs);
            }
        }
    });
}

function onShapeDeleted(e) {
    const layers = e.layers;
    layers.eachLayer(function(layer) {
        if (layer === currentShape) {
            currentShape = null;
            enableDrawingControls();
            
            // Clear measurement markers
            drawingMarkers.forEach(marker => marker.remove());
            drawingMarkers = [];
            
            // Clear undo stack
            undoStack = [];
            updateUndoButton();
            
            // Update form validation
            validateForm();
        }
    });
}

// ============================================================================
// REAL-TIME MEASUREMENTS
// ============================================================================

function addRealTimeMeasurements() {
    // Clear previous state
    drawingVertices = [];
    drawingMarkers = [];
    undoStack = [];
    
    // Add drawing event listeners
    map.on(L.Draw.Event.DRAWSTART, onDrawStart);
    map.on(L.Draw.Event.DRAWVERTEX, onDrawVertex);
    map.on(L.Draw.Event.DRAWSTOP, onDrawStop);
    map.on(L.Draw.Event.EDITSTART, onShapeEdited);
    map.on(L.Draw.Event.EDITSTOP, onShapeEdited);
    map.on(L.Draw.Event.DELETESTART, onShapeDeleted);
    map.on(L.Draw.Event.DELETESTOP, onShapeDeleted);
    map.on(L.Draw.Event.CREATED, onShapeCreated);
    
    // Add map click listener for manual vertex placement
    map.on('click', onMapClick);
    map.on('mousemove', onMouseMove);
}

function onDrawStart(e) {
    if (currentShape) {
        return; // Prevent drawing if shape exists
    }
    
    drawingVertices = [];
    drawingMarkers.forEach(marker => marker.remove());
    drawingMarkers = [];
    updateDrawingStatus('Drawing started - click to add points');
}

function onDrawVertex(e) {
    const vertexMarker = e.layers;
    if (vertexMarker && vertexMarker.getLatLng) {
        const vertexLatLng = vertexMarker.getLatLng();
        
        // Check for duplicate vertices
        const isDuplicate = drawingVertices.some(vertex => 
            vertex.lat === vertexLatLng.lat && vertex.lng === vertexLatLng.lng
        );
        
        if (!isDuplicate) {
            drawingVertices.push(vertexLatLng);
            
            // Add measurement if we have at least 2 vertices
            if (drawingVertices.length >= 2) {
                const prevVertex = drawingVertices[drawingVertices.length - 2];
                const distance = calculateDistanceInFeet(prevVertex, vertexLatLng);
                
                // Create measurement label
                const midPoint = L.latLng(
                    (prevVertex.lat + vertexLatLng.lat) / 2,
                    (prevVertex.lng + vertexLatLng.lng) / 2
                );
                
                const marker = L.marker(midPoint, {
                    icon: L.divIcon({
                        className: 'distance-label',
                        html: `<div>${distance.toFixed(2)} ft</div>`,
                        iconSize: [100, 20],
                        iconAnchor: [50, 10]
                    })
                });
                
                marker.addTo(map);
                drawingMarkers.push(marker);
            }
        }
    }
}

function onMapClick(e) {
    if (currentShape) return; // Don't add vertices if shape is complete
    
    const clickLatLng = e.latlng;
    drawingVertices.push(clickLatLng);
    
    // Add measurement if we have at least 2 vertices
    if (drawingVertices.length >= 2) {
        const prevVertex = drawingVertices[drawingVertices.length - 2];
        const distance = calculateDistanceInFeet(prevVertex, clickLatLng);
        
        const midPoint = L.latLng(
            (prevVertex.lat + clickLatLng.lat) / 2,
            (prevVertex.lng + clickLatLng.lng) / 2
        );
        
        const marker = L.marker(midPoint, {
            icon: L.divIcon({
                className: 'distance-label',
                html: `<div>${distance.toFixed(2)} ft</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10]
            })
        });
        
        marker.addTo(map);
        drawingMarkers.push(marker);
    }
}

function onMouseMove(e) {
    if (currentShape || drawingVertices.length === 0) return;
    
    const mouseLatLng = e.latlng;
    const lastVertex = drawingVertices[drawingVertices.length - 1];
    const distance = calculateDistanceInFeet(lastVertex, mouseLatLng);
    
    // Update status with live distance
    updateDrawingStatus(`Distance: ${distance.toFixed(2)} ft`);
}

function onDrawStop(e) {
    if (drawingVertices.length >= 3) {
        // Add final closing measurement for polygon
        const firstVertex = drawingVertices[0];
        const lastVertex = drawingVertices[drawingVertices.length - 1];
        const distance = calculateDistanceInFeet(lastVertex, firstVertex);
        
        const midPoint = L.latLng(
            (lastVertex.lat + firstVertex.lat) / 2,
            (lastVertex.lng + firstVertex.lng) / 2
        );
        
        const marker = L.marker(midPoint, {
            icon: L.divIcon({
                className: 'distance-label',
                html: `<div>${distance.toFixed(2)} ft</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10]
            })
        });
        
        marker.addTo(map);
        drawingMarkers.push(marker);
    }
    
    updateDrawingStatus('Drawing completed');
}

function updateDrawingMeasurements(latLngs) {
    // Clear existing measurement markers
    drawingMarkers.forEach(marker => marker.remove());
    drawingMarkers = [];
    
    // Add new measurements
    for (let i = 0; i < latLngs.length; i++) {
        const current = latLngs[i];
        const next = latLngs[(i + 1) % latLngs.length];
        
        const distance = calculateDistanceInFeet(current, next);
        const midPoint = L.latLng(
            (current.lat + next.lat) / 2,
            (current.lng + next.lng) / 2
        );
        
        const marker = L.marker(midPoint, {
            icon: L.divIcon({
                className: 'distance-label',
                html: `<div>${distance.toFixed(2)} ft</div>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10]
            })
        });
        
        marker.addTo(map);
        drawingMarkers.push(marker);
    }
}

// ============================================================================
// UNDO FUNCTIONALITY
// ============================================================================

function undoLastAction() {
    if (undoStack.length === 0) return;
    
    const lastAction = undoStack.pop();
    
    if (lastAction.type === 'draw' && currentShape) {
        // Remove the shape
        drawnItems.removeLayer(currentShape);
        currentShape = null;
        
        // Remove measurement markers
        lastAction.markers.forEach(marker => marker.remove());
        drawingMarkers = [];
        
        // Enable drawing controls
        enableDrawingControls();
        
        // Update form validation
        validateForm();
    }
    
    updateUndoButton();
}

function addUndoButtonToToolbar() {
    const addUndoButton = () => {
        const toolbar = document.querySelector('.leaflet-draw-toolbar');
        if (!toolbar) {
            setTimeout(addUndoButton, 100);
            return;
        }
        
        const undoButton = document.createElement('a');
        undoButton.className = 'leaflet-draw-edit-remove';
        undoButton.innerHTML = '↶';
        undoButton.title = 'Undo last action';
        undoButton.style.cssText = `
            background-color: #f8f9fa !important;
            border: 1px solid #ccc !important;
            color: #333 !important;
            width: 30px !important;
            height: 30px !important;
            line-height: 30px !important;
            text-align: center !important;
            font-size: 16px !important;
            font-weight: bold !important;
        `;
        
        undoButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            undoLastAction();
        });
        
        undoButton.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#e9ecef !important';
        });
        
        undoButton.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#f8f9fa !important';
        });
        
        toolbar.appendChild(undoButton);
        updateUndoButton();
    };
    
    addUndoButton();
}

function updateUndoButton() {
    const undoButton = document.querySelector('.leaflet-draw-edit-remove[title="Undo last action"]');
    if (undoButton) {
        undoButton.style.opacity = undoStack.length > 0 ? '1' : '0.5';
        undoButton.style.pointerEvents = undoStack.length > 0 ? 'auto' : 'none';
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateDistanceInFeet(latLng1, latLng2) {
    const lat1 = latLng1.lat * Math.PI / 180;
    const lat2 = latLng2.lat * Math.PI / 180;
    const deltaLat = (latLng2.lat - latLng1.lat) * Math.PI / 180;
    const deltaLng = (latLng2.lng - latLng1.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    const distanceInMeters = 6371000 * c; // Earth's radius in meters
    return distanceInMeters * 3.28084; // Convert to feet
}

function clearDrawing() {
    if (currentShape) {
        drawnItems.removeLayer(currentShape);
        currentShape = null;
    }
    
    drawingMarkers.forEach(marker => marker.remove());
    drawingMarkers = [];
    drawingVertices = [];
    undoStack = [];
    
    enableDrawingControls();
    updateUndoButton();
    validateForm();
    updateDrawingStatus('Drawing cleared');
}

function resetMapView() {
    const campusSelect = document.getElementById('campusSelect');
    if (campusSelect && campusSelect.value) {
        navigateToCampus(campusSelect.value);
    }
}

function updateDrawingStatus(message, type = 'ready') {
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    if (statusText) {
        statusText.textContent = message;
    }
    
    if (statusDot) {
        statusDot.className = 'status-dot';
        if (type === 'drawing') {
            statusDot.classList.add('drawing');
        } else if (type === 'error') {
            statusDot.classList.add('error');
        }
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function initializeEventListeners() {
    // Form validation
    const formInputs = document.querySelectorAll('input, select, textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', validateForm);
        input.addEventListener('change', validateForm);
    });
    
    // Button event listeners
    document.getElementById('clearDrawing').addEventListener('click', clearDrawing);
    document.getElementById('resetView').addEventListener('click', resetMapView);
    document.getElementById('previewRequest').addEventListener('click', previewRequest);
    document.getElementById('submitRequest').addEventListener('click', submitRequest);
    
    // Modal event listeners
    document.getElementById('confirmSubmit').addEventListener('click', confirmSubmit);
    document.getElementById('cancelSubmit').addEventListener('click', closePreviewModal);
    document.getElementById('newRequest').addEventListener('click', resetForm);
    document.getElementById('closeSuccess').addEventListener('click', closeSuccessModal);
    
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
    
    // Campus selection event listener
    document.getElementById('campusSelect').addEventListener('change', function() {
        const selectedCampusKey = this.value;
        if (selectedCampusKey) {
            navigateToCampus(selectedCampusKey);
        }
    });
}

// ============================================================================
// FORM VALIDATION
// ============================================================================

function validateForm() {
    const requiredFields = [
        'campusSelect',
        'companyName',
        'contactName', 
        'contactEmail',
        'startDate',
        'endDate'
    ];
    
    let isValid = true;
    
    // Check required fields
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            isValid = false;
            field.classList.add('invalid');
        } else {
            field.classList.remove('invalid');
        }
    });
    
    // Check email format
    const emailField = document.getElementById('contactEmail');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailField.value && !emailRegex.test(emailField.value)) {
        isValid = false;
        emailField.classList.add('invalid');
    }
    
    // Check date range
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
        isValid = false;
        document.getElementById('endDate').classList.add('invalid');
    }
    
    // Check if shape is drawn
    if (!currentShape) {
        isValid = false;
    }
    
    updateSubmitButton(isValid);
    return isValid;
}

function updateSubmitButton(isValid = null) {
    const submitButton = document.getElementById('submitRequest');
    if (submitButton) {
        if (isValid === null) {
            isValid = validateForm();
        }
        submitButton.disabled = !isValid;
    }
}

// ============================================================================
// REQUEST PREVIEW & SUBMISSION
// ============================================================================

function previewRequest() {
    if (!validateForm()) {
        alert('Please fill in all required fields and draw a shape on the map.');
        return;
    }
    
    const formData = collectFormData();
    const previewContent = document.getElementById('previewContent');
    
    previewContent.innerHTML = `
        <div class="preview-item">
            <strong>Campus:</strong> ${formData.campus}
        </div>
        <div class="preview-item">
            <strong>Company:</strong> ${formData.companyName}
        </div>
        <div class="preview-item">
            <strong>Contact:</strong> ${formData.contactName} (${formData.contactEmail})
        </div>
        <div class="preview-item">
            <strong>Requested Area:</strong> ${formData.requestedArea} sq ft
        </div>
        <div class="preview-item">
            <strong>Duration:</strong> ${formData.startDate} to ${formData.endDate}
        </div>
        <div class="preview-item">
            <strong>Description:</strong> ${formData.description || 'No description provided'}
        </div>
    `;
    
    document.getElementById('previewModal').style.display = 'block';
}

function collectFormData() {
    const geoJSON = currentShape.toGeoJSON();
    const geometry = geoJSON.geometry;
    
    return {
        campus: document.getElementById('campusSelect').value,
        companyName: document.getElementById('companyName').value,
        contactName: document.getElementById('contactName').value,
        contactEmail: document.getElementById('contactEmail').value,
        requestedArea: document.getElementById('requestedArea').value || calculateArea(currentShape.getLatLngs()),
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        description: document.getElementById('description').value,
        geometry: geometry
    };
}

// ============================================================================
// TOPOJSON EXPORT
// ============================================================================

async function loadSiteLayout() {
    try {
        // For static deployment, we'll create basic campus layout data
        const siteLayout = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [-122.91389689455964, 45.5442515697061],
                            [-122.91289689455964, 45.5442515697061],
                            [-122.91289689455964, 45.5452515697061],
                            [-122.91389689455964, 45.5452515697061],
                            [-122.91389689455964, 45.5442515697061]
                        ]]
                    },
                    properties: {
                        name: "Intel Ronler Acres Campus",
                        type: "campus"
                    }
                }
            ]
        };
        return siteLayout;
    } catch (error) {
        console.error('Error loading site layout:', error);
        return null;
    }
}

async function loadConstructionCampusTopoJSON() {
    try {
        // For static deployment, we'll create a simplified TopoJSON structure
        // that includes the basic campus layout
        const campusTopoJSON = {
            type: "Topology",
            arcs: [
                // Main campus boundary
                [[-122.91389689455964, 45.5442515697061], [0.001, 0], [0, 0.001], [-0.001, 0], [0, -0.001]],
                // Building outlines (simplified)
                [[-122.91389689455964, 45.5442515697061], [0.0005, 0], [0, 0.0005], [-0.0005, 0], [0, -0.0005]],
                [[-122.91389689455964, 45.5442515697061], [0.0003, 0.0003], [-0.0003, 0.0003], [-0.0003, -0.0003], [0.0003, -0.0003]]
            ],
            transform: {
                scale: [0.000001, 0.000001],
                translate: [-122.91389689455964, 45.5442515697061]
            },
            objects: {
                "Test Split V2": {
                    type: "GeometryCollection",
                    geometries: [
                        {
                            type: "Polygon",
                            arcs: [[0]],
                            properties: {
                                "Building ID": "Campus Boundary",
                                "SQ_FT": 1000000
                            }
                        },
                        {
                            type: "Polygon", 
                            arcs: [[1]],
                            properties: {
                                "Building ID": "Main Building",
                                "SQ_FT": 500000
                            }
                        },
                        {
                            type: "Polygon",
                            arcs: [[2]], 
                            properties: {
                                "Building ID": "Support Building",
                                "SQ_FT": 250000
                            }
                        }
                    ]
                }
            }
        };
        return campusTopoJSON;
    } catch (error) {
        console.error('Error loading construction campus TopoJSON:', error);
        return null;
    }
}

async function exportToTopoJSON(requestData) {
    try {
        // Load original TopoJSON
        const originalTopoJSON = await loadConstructionCampusTopoJSON();
        if (!originalTopoJSON) {
            throw new Error('Failed to load original TopoJSON');
        }
        
        // Extract transform parameters
        const transform = originalTopoJSON.transform;
        const scale = transform.scale;
        const translate = transform.translate;
        
        // Convert drawn coordinates to TopoJSON format
        const coordinates = requestData.geometry.coordinates[0];
        const arcs = [];
        let currentX = 0, currentY = 0;
        
        coordinates.forEach((coord, index) => {
            const [lng, lat] = coord;
            
            // Convert to TopoJSON coordinates
            const x = Math.round((lng - translate[0]) / scale[0]);
            const y = Math.round((lat - translate[1]) / scale[1]);
            
            // Calculate delta encoding
            const deltaX = x - currentX;
            const deltaY = y - currentY;
            
            arcs.push([deltaX, deltaY]);
            currentX = x;
            currentY = y;
        });
        
        // Create new geometry
        const newGeometry = {
            type: 'Polygon',
            properties: {
                OBJECTID: Date.now(),
                ORBLD_ID: `STAGING-REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                County: 'Washington',
                CONTRIBUTOR: 'Staging Space Tool',
                SOURCE: 'User Drawing',
                COMPANY: requestData.companyName,
                CONTACT: requestData.contactName,
                EMAIL: requestData.contactEmail,
                START_DATE: requestData.startDate,
                END_DATE: requestData.endDate,
                AREA_SQFT: requestData.requestedArea,
                DESCRIPTION: requestData.description || '',
                STATUS: 'Pending'
            },
            arcs: [arcs.map((_, index) => originalTopoJSON.arcs.length + index)]
        };
        
        // Merge into original TopoJSON
        const mergedTopoJSON = {
            ...originalTopoJSON,
            arcs: [...originalTopoJSON.arcs, arcs],
            objects: {
                ...originalTopoJSON.objects,
                "Staging Requests": {
                    type: "GeometryCollection",
                    geometries: [newGeometry]
                }
            }
        };
        
        return mergedTopoJSON;
    } catch (error) {
        console.error('Error exporting to TopoJSON:', error);
        throw error;
    }
}

// ============================================================================
// REQUEST SUBMISSION
// ============================================================================

function generateRequestId() {
    return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function submitRequest() {
    if (!validateForm()) {
        alert('Please fill in all required fields and draw a shape on the map.');
        return;
    }
    
    try {
        const requestData = collectFormData();
        const requestId = generateRequestId();
        
        // Export to TopoJSON
        const topoJSONData = await exportToTopoJSON(requestData);
        
        // Create GeoJSON for verification
        const cleanGeoJSON = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {
                    ...requestData,
                    requestId: requestId
                },
                geometry: requestData.geometry
            }]
        };
        
        // Download files
        downloadFile(JSON.stringify(cleanGeoJSON, null, 2), `staging-request-${requestId}.geojson`, 'application/json');
        downloadFile(JSON.stringify(topoJSONData, null, 2), `staging-request-${requestId}.topojson`, 'application/json');
        
        // Log activity to admin panel
        logActivityToAdmin('Staging Request', requestData);
        
        // Show success modal
        document.getElementById('requestId').textContent = requestId;
        document.getElementById('successModal').style.display = 'block';
        
        // Reset form
        resetForm();
        
    } catch (error) {
        console.error('Error submitting request:', error);
        alert('Error submitting request. Please try again.');
    }
}

function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

function confirmSubmit() {
    closePreviewModal();
    submitRequest();
}

function closePreviewModal() {
    document.getElementById('previewModal').style.display = 'none';
}

function closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
}

function resetForm() {
    // Reset form fields
    document.getElementById('campusSelect').value = '';
    document.getElementById('companyName').value = '';
    document.getElementById('contactName').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('requestedArea').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('description').value = '';
    
    // Clear drawing
    clearDrawing();
    
    // Close modals
    closePreviewModal();
    closeSuccessModal();
    
    // Set default campus
    setDefaultCampus();
    
    // Update form validation
    validateForm();
}

// ============================================================================
// AREA CALCULATION
// ============================================================================

function calculateArea(latLngs) {
    if (!latLngs || latLngs.length < 3) return 0;
    
    const area = L.GeometryUtil.geodesicArea(latLngs);
    const areaInSqFt = area * 10.764; // Convert square meters to square feet
    
    return Math.round(areaInSqFt);
}
