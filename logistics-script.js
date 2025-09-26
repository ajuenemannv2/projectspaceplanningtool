// Logistics Map Script
class LogisticsMap {
    constructor() {
        this.map = null;
        this.mapLayers = {
            savedSpaces: null,
            measurements: null
        };
        this.currentProject = null;
        this.currentPhases = [];
        this.currentSpaces = [];
        this.spaceCategories = [];
        this.supabase = null;
        this.phaseChangeTimeout = null;
        this.watermarkMarkers = [];
        this.currentTileLayer = null;
        
        this.init();
    }

    async init() {
        console.log('🔧 Initializing Logistics Map...');
        
        // Show loading animation
        this.showLoadingAnimation();
        
        try {
            // Global error banner helpers
            const errorBanner = document.getElementById('globalErrorBanner');
            const errorText = document.getElementById('globalErrorText');
            const errorRetry = document.getElementById('globalErrorRetry');
            const errorDismiss = document.getElementById('globalErrorDismiss');
            const showError = (message, retryFn) => {
                if (errorText) errorText.textContent = message || 'An error occurred.';
                if (errorBanner) errorBanner.style.display = 'block';
                if (errorRetry) errorRetry.onclick = () => { if (retryFn) retryFn(); if (errorBanner) errorBanner.style.display = 'none'; };
                if (errorDismiss) errorDismiss.onclick = () => { if (errorBanner) errorBanner.style.display = 'none'; };
            };
            if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
                showError('Configuration error: Supabase settings not found. Ensure config/public-supabase-config.js is included with a valid URL and anon key.', () => window.location.reload());
                throw new Error('Missing Supabase config');
            }
            
            // Initialize Supabase
            if (typeof supabase === 'undefined') {
                console.error('❌ Supabase not loaded!');
                return;
            }

            this.supabase = supabase.createClient(
                window.SUPABASE_CONFIG.url,
                window.SUPABASE_CONFIG.anonKey
            );

            // Initialize map
            this.initializeMap();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load projects first
            await this.loadProjects();

            // Apply deep-linked or saved project selection and zoom
            try {
                const params = new URLSearchParams(window.location.search);
                const fromQuery = params.get('project');
                const fromStorage = localStorage.getItem('selected_project_id');
                const projectToSelect = fromQuery || fromStorage;
                const requestedZoom = params.get('zoom') || localStorage.getItem('selected_project_zoom');
                const select = document.getElementById('projectSelect');
                if (projectToSelect && select) {
                    select.value = projectToSelect;
                    await this.onProjectChange(projectToSelect);
                    // If a zoom was provided, apply it after project change setView
                    if (requestedZoom && this.map) {
                        try {
                            const z = parseInt(requestedZoom, 10);
                            if (!isNaN(z)) {
                                this.map.setZoom(z);
                            }
                        } catch(_) {}
                    }
                }
            } catch(_) {}
            
            // Load space categories
            await this.loadSpaceCategories();
            
            console.log('✅ Logistics Map initialized');
        } catch (error) {
            console.error('❌ Error initializing Logistics Map:', error);
        } finally {
            // Hide loading animation
            this.hideLoadingAnimation();
        }
    }

    initializeMap() {
        const mapContainer = document.getElementById('logisticsMap');
        if (!mapContainer) return;

        // Initialize map with higher max zoom (matching main tool)
        this.map = L.map('logisticsMap', {
            zoomControl: true,
            attributionControl: true,
            maxZoom: 22,
            minZoom: 10
        }).setView([45.5442515697061, -122.91389689455964], 16);

        // Add default tile layer (satellite view)
        this.setMapType('satellite');

        // Initialize layers
        this.mapLayers.savedSpaces = L.layerGroup().addTo(this.map);
        this.mapLayers.measurements = L.layerGroup().addTo(this.map);

        console.log('🔧 Map initialized');

        // Persist zoom selection to keep parity when navigating back
        this.map.on('zoomend', () => {
            try {
                const z = this.map.getZoom();
                localStorage.setItem('selected_project_zoom', String(z));
            } catch(_) {}
        });
    }

    setupEventListeners() {
        // Project selector
        const projectSelect = document.getElementById('projectSelect');
        if (projectSelect) {
            projectSelect.addEventListener('change', (e) => {
                this.onProjectChange(e.target.value);
            });
        }

        // Phase checkboxes
        const phaseContainer = document.getElementById('phaseCheckboxes');
        if (phaseContainer) {
            phaseContainer.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox') {
                    this.onPhaseChange();
                    // Persist selected phases for cross-page continuity
                    try {
                        const ids = Array.from(document.querySelectorAll('input[name="phases"]:checked')).map(cb => parseInt(cb.value));
                        localStorage.setItem('selected_phase_ids', JSON.stringify(ids));
                        if (this.currentProject?.id) {
                            localStorage.setItem('selected_project_id', String(this.currentProject.id));
                        }
                    } catch(_) {}
                }
            });
        }


        // Map type selector
        const mapTypeSelect = document.getElementById('mapTypeSelect');
        if (mapTypeSelect) {
            mapTypeSelect.addEventListener('change', (e) => {
                this.setMapType(e.target.value);
            });
        }

        // Export buttons
        const exportDataBtn = document.getElementById('exportDataBtn');
        if (exportDataBtn) {
            exportDataBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        const exportHDImageBtn = document.getElementById('exportHDImageBtn');
        if (exportHDImageBtn) {
            exportHDImageBtn.addEventListener('click', () => {
                this.exportHDImage();
            });
        }
    }

    async loadSpaceCategories() {
        try {
            const { data: categories, error } = await this.supabase
                .from('space_categories')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;

            this.spaceCategories = categories || [];
            console.log('✅ Space categories loaded:', this.spaceCategories.length);
        } catch (error) {
            console.error('❌ Error loading space categories:', error);
            this.spaceCategories = [];
        }
    }

    // Watermark system for logistics map
    createWatermarkPattern(companyName, color = '#3b82f6') {
        const patternId = `watermark-${companyName.replace(/\s+/g, '-').toLowerCase()}`;
        
        // Check if pattern already exists
        if (document.getElementById(patternId)) {
            return patternId;
        }
        
        // Create SVG pattern
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '200');
        svg.setAttribute('height', '200');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', patternId);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '200');
        pattern.setAttribute('height', '200');
        pattern.setAttribute('patternTransform', 'rotate(45)');
        
        // Create diagonal text elements
        const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text1.setAttribute('x', '20');
        text1.setAttribute('y', '40');
        text1.setAttribute('font-family', 'Arial, sans-serif');
        text1.setAttribute('font-size', '14');
        text1.setAttribute('font-weight', 'bold');
        text1.setAttribute('fill', color);
        text1.setAttribute('fill-opacity', '0.3');
        text1.setAttribute('text-anchor', 'start');
        text1.textContent = companyName;
        
        const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text2.setAttribute('x', '120');
        text2.setAttribute('y', '140');
        text2.setAttribute('font-family', 'Arial, sans-serif');
        text2.setAttribute('font-size', '14');
        text2.setAttribute('font-weight', 'bold');
        text2.setAttribute('fill', color);
        text2.setAttribute('fill-opacity', '0.3');
        text2.setAttribute('text-anchor', 'start');
        text2.textContent = companyName;
        
        const text3 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text3.setAttribute('x', '70');
        text3.setAttribute('y', '90');
        text3.setAttribute('font-family', 'Arial, sans-serif');
        text3.setAttribute('font-size', '14');
        text3.setAttribute('font-weight', 'bold');
        text3.setAttribute('fill', color);
        text3.setAttribute('fill-opacity', '0.3');
        text3.setAttribute('text-anchor', 'start');
        text3.textContent = companyName;
        
        pattern.appendChild(text1);
        pattern.appendChild(text2);
        pattern.appendChild(text3);
        defs.appendChild(pattern);
        svg.appendChild(defs);
        
        // Add to document
        let svgContainer = document.getElementById('watermark-svg-container');
        if (!svgContainer) {
            svgContainer = document.createElement('div');
            svgContainer.id = 'watermark-svg-container';
            svgContainer.style.position = 'absolute';
            svgContainer.style.left = '-9999px';
            svgContainer.style.top = '-9999px';
            svgContainer.style.width = '0';
            svgContainer.style.height = '0';
            svgContainer.style.overflow = 'hidden';
            document.body.appendChild(svgContainer);
        }
        
        svgContainer.appendChild(svg);
        return patternId;
    }

    applyWatermarkToLayer(layer, companyName) {
        if (!layer || !companyName) return;
        
        // Use the same watermark system as the main tool
        this.createShapeWatermark(layer, companyName);
    }
    
    // Create a watermark that's bound to a specific shape (same as main tool)
    createShapeWatermark(shape, companyName) {
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
        watermarkMarker.addTo(this.map);
        
        // Store reference for cleanup
        if (!this.watermarkMarkers) {
            this.watermarkMarkers = [];
        }
        this.watermarkMarkers.push(watermarkMarker);
        
        // Store the watermark marker on the shape for easy removal
        shape._watermarkMarker = watermarkMarker;
        
        console.log('✅ Watermark applied to logistics layer:', companyName);
    }

    async loadProjects() {
        try {
            const { data: projects, error } = await this.supabase
                .from('projects')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;

            const select = document.getElementById('projectSelect');
            if (!select) return;

            select.innerHTML = '<option value="">Select Project</option>';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                select.appendChild(option);
            });

            console.log('🔧 Projects loaded:', projects.length);
        } catch (error) {
            console.error('❌ Error loading projects:', error);
        }
    }

    async onProjectChange(projectId) {
        if (!projectId) {
            this.currentProject = null;
            this.clearMap();
            return;
        }

        try {
            const { data: project, error } = await this.supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (error) throw error;

            this.currentProject = project;

            // Persist selection for cross-page continuity
            try {
                localStorage.setItem('selected_project_id', String(projectId));
                const z = this.map ? this.map.getZoom() : (project.zoom || 16);
                if (z) localStorage.setItem('selected_project_zoom', String(z));
            } catch(_) {}

            // Zoom to project
            if (project.coordinates && project.coordinates.length === 2) {
                this.map.setView(project.coordinates, project.zoom || 16);
            }

            // Load phases for this project
            await this.loadPhases(projectId);
            
            // Load spaces for this project
            await this.loadSpaces(projectId);

            console.log('🔧 Project changed to:', project.name);
        } catch (error) {
            console.error('❌ Error changing project:', error);
        }
    }

    // Navigate back to main tool carrying selection and zoom
    goToMainTool() {
        try {
            const projectId = (this.currentProject && this.currentProject.id) || document.getElementById('projectSelect')?.value;
            if (projectId) localStorage.setItem('selected_project_id', String(projectId));
            const z = this.map ? this.map.getZoom() : (this.currentProject?.zoom || 16);
            if (z) localStorage.setItem('selected_project_zoom', String(z));
            const url = projectId ? `index.html?project=${encodeURIComponent(projectId)}${z ? `&zoom=${encodeURIComponent(z)}` : ''}` : 'index.html';
            window.location.href = url;
        } catch(_) {
            window.location.href = 'index.html';
        }
    }

    async loadPhases(projectId) {
        try {
            const { data: phases, error } = await this.supabase
                .from('project_phases')
                .select('*')
                .eq('project_id', projectId)
                .order('phase_order', { ascending: true });

            if (error) throw error;

            const container = document.getElementById('phaseCheckboxes');
            if (!container) return;

            container.innerHTML = '';
            phases.forEach((phase) => {
                const label = document.createElement('label');
                label.innerHTML = `
                    <input type="checkbox" value="${phase.id}" name="phases">
                    ${phase.name}
                `;
                container.appendChild(label);
            });

            // Restore previously selected phases if saved
            try {
                const savedProjectId = localStorage.getItem('selected_project_id');
                const savedPhaseIds = JSON.parse(localStorage.getItem('selected_phase_ids') || '[]');
                if (String(savedProjectId) === String(projectId) && Array.isArray(savedPhaseIds) && savedPhaseIds.length > 0) {
                    this.currentPhases = savedPhaseIds.map(id => parseInt(id)).filter(id => !isNaN(id));
                    const checkboxes = container.querySelectorAll('input[name="phases"]');
                    checkboxes.forEach(cb => {
                        if (this.currentPhases.includes(parseInt(cb.value))) {
                            cb.checked = true;
                        }
                    });
                    // Load spaces with restored filters
                    this.onPhaseChange();
                } else {
                    // No saved selection: leave all unchecked
                    this.currentPhases = [];
                    this.filterSpaces();
                }
            } catch(_) {
                this.currentPhases = [];
                this.filterSpaces();
            }

            console.log('🔧 Phases loaded:', phases.length);
        } catch (error) {
            console.error('❌ Error loading phases:', error);
        }
    }

    async loadSpaces(projectId) {
        try {
            const { data: spaces, error } = await this.supabase
                .from('project_spaces')
                .select(`
                    *,
                    phase_space_assignments (
                        project_phases (id, name)
                    )
                `)
                .eq('project_id', projectId);

            if (error) throw error;

            // Store spaces for measurements
            this.currentSpaces = spaces || [];
            
            this.displaySpaces(this.currentSpaces);
            this.updateSpaceCount(this.currentSpaces.length);

            console.log('🔧 Spaces loaded:', this.currentSpaces.length);
        } catch (error) {
            console.error('❌ Error loading spaces:', error);
        }
    }

    onPhaseChange() {
        if (!this.currentProject) return;

        // Clear any existing timeout
        if (this.phaseChangeTimeout) {
            clearTimeout(this.phaseChangeTimeout);
        }

        // Debounce phase changes to prevent rapid API calls
        this.phaseChangeTimeout = setTimeout(() => {
            const checkboxes = document.querySelectorAll('input[name="phases"]:checked');
            this.currentPhases = Array.from(checkboxes).map(cb => parseInt(cb.value));

            // Filter and display spaces based on selected phases
            this.filterSpaces();
        }, 300); // 300ms delay
    }

    filterSpaces() {
        if (!this.mapLayers.savedSpaces || !this.currentProject) return;

        // Clear existing layers first
        this.mapLayers.savedSpaces.clearLayers();

        // If no phases selected, show all spaces
        if (this.currentPhases.length === 0) {
            this.loadSpaces(this.currentProject.id);
            return;
        }

        // Load spaces and filter by selected phases
        this.loadSpacesWithPhaseFilter(this.currentProject.id, this.currentPhases);
    }

    async loadSpacesWithPhaseFilter(projectId, selectedPhaseIds) {
        try {
            const { data: spaces, error } = await this.supabase
                .from('project_spaces')
                .select(`
                    *,
                    phase_space_assignments (
                        project_phases (id, name)
                    )
                `)
                .eq('project_id', projectId);

            if (error) throw error;

            // Filter spaces that are assigned to at least one of the selected phases
            const filteredSpaces = spaces.filter(space => {
                if (!space.phase_space_assignments || space.phase_space_assignments.length === 0) {
                    return false; // Skip spaces with no phase assignments
                }
                
                const spacePhaseIds = space.phase_space_assignments.map(assignment => 
                    assignment.project_phases?.id
                ).filter(id => id !== undefined);
                
                // Check if space is assigned to any of the selected phases
                return selectedPhaseIds.some(selectedId => spacePhaseIds.includes(selectedId));
            });

            // Store filtered spaces for measurements
            this.currentSpaces = filteredSpaces;
            this.displaySpaces(this.currentSpaces);
            this.updateSpaceCount(this.currentSpaces.length);

            console.log('🔧 Filtered spaces loaded:', this.currentSpaces.length);
        } catch (error) {
            console.error('❌ Error loading filtered spaces:', error);
        }
    }

    displaySpaces(spaces) {
        if (!this.mapLayers.savedSpaces || !Array.isArray(spaces)) return;

        // Clear existing layers safely
        try {
            this.mapLayers.savedSpaces.clearLayers();
        } catch (error) {
            console.warn('Warning clearing layers:', error);
        }
        
        // Clear existing watermarks
        if (this.watermarkMarkers) {
            this.watermarkMarkers.forEach(marker => marker.remove());
            this.watermarkMarkers = [];
        }

        spaces.forEach((space, index) => {
            if (space && space.geometry) {
                try {
                    // Get category info first (needed for phase coverage logic)
                    const categoryInfo = this.spaceCategories?.find(cat => cat.name === space.category);
                    
                    // Check if this is a crane shape (has multiple features with 'part' properties)
                    const isCraneShape = space.geometry && space.geometry.type === 'FeatureCollection' && 
                                        space.geometry.features && space.geometry.features.some(f => f.properties && f.properties.part);
                    
                    let color, fillColor;
                    
                    if (isCraneShape) {
                        // Crane shapes use their own color scheme
                        color = '#1f2937';  // Dark grey for crane pad
                        fillColor = '#1f2937';
                    } else {
                        // Regular shapes use category colors
                        color = categoryInfo?.color || '#3b82f6';  // Use category color or default blue
                        fillColor = color;
                    }
                    
                    // Determine opacity and border style based on phase coverage
                    const spacePhaseIds = space.phase_space_assignments?.map(assignment => 
                        assignment.project_phases?.id
                    ).filter(id => id !== undefined) || [];

                    let fillOpacity = 0.3;
                    let weight = 2;
                    let missingPhases = [];

                    // If multiple phases are selected, check if space exists in ALL of them
                    if (this.currentPhases.length > 1) {
                        const missingPhaseIds = this.currentPhases.filter(selectedId => 
                            !spacePhaseIds.includes(selectedId)
                        );
                        
                        if (missingPhaseIds.length > 0) {
                            color = '#dc2626'; // Red border for missing phases
                            fillColor = categoryInfo?.color || '#3b82f6';  // Keep category color for fill
                            fillOpacity = 0.2;  // More transparent for incomplete
                            weight = 3;  // Thicker border for incomplete
                            
                            // Get names of missing phases (with error handling)
                            try {
                                const allPhases = this.getAllPhasesForProject();
                                missingPhases = missingPhaseIds.map(id => {
                                    const phase = allPhases.find(p => p.id === id);
                                    return phase ? phase.name : `Phase ${id}`;
                                });
                            } catch (error) {
                                console.warn('⚠️ Error getting phase names:', error);
                                missingPhases = missingPhaseIds.map(id => `Phase ${id}`);
                            }
                        }
                    }

                    // Render geometry: polygons with phase color, fences (LineString) in yellow
                    let layer;
                    const isLineString = space.geometry && space.geometry.type === 'LineString';
                    if (isLineString) {
                        const coords = space.geometry.coordinates || [];
                        const latLngs = coords.map(c => L.latLng(c[1], c[0]));
                        layer = L.polyline(latLngs, {
                            color: '#ffd700',
                            weight: 3,
                            opacity: 0.9
                        });
                    } else {
                        // Create layer with appropriate styling
                        if (isCraneShape) {
                            // Handle crane shapes with different styling for each part
                            layer = L.geoJSON(space.geometry, {
                                style: function(feature) {
                                    const part = feature.properties?.part;
                                    if (part === 'pad') {
                                        return {
                                            color: '#1f2937',  // Dark grey for crane pad
                                            fillColor: '#1f2937',
                                            fillOpacity: 0.6,
                                            weight: 2,
                                            opacity: 0.8
                                        };
                                    } else if (part === 'sweep') {
                                        return {
                                            color: '#dc2626',  // Red outline for sweep sector
                                            fillColor: '#f59e0b',  // Orange fill
                                            fillOpacity: 0.25,
                                            weight: 3,
                                            opacity: 0.8,
                                            dashArray: '10, 5'  // Red dashed outline
                                        };
                                    } else if (part === 'radius') {
                                        // Hide radius line in saved crane shapes - it's only for drawing
                                        return {
                                            color: 'transparent',
                                            weight: 0,
                                            opacity: 0
                                        };
                                    }
                                    // Default fallback
                                    return {
                                        color: '#1f2937',
                                        fillColor: '#1f2937',
                                        fillOpacity: 0.3,
                                        weight: 2,
                                        opacity: 0.8
                                    };
                                }
                            });
                        } else {
                            // Regular shapes use standard styling
                            layer = L.geoJSON(space.geometry, {
                                style: {
                                    color: color,
                                    fillColor: fillColor,
                                    fillOpacity: fillOpacity,
                                    weight: weight,
                                    opacity: 0.8
                                }
                            });
                        }
                        
                        // Apply watermark for company name
                        if (space.trade) {
                            console.log('🏷️ Applying watermark to logistics space for company:', space.trade);
                            this.applyWatermarkToLayer(layer, space.trade);
                        }
                    }

                    const phaseNames = space.phase_space_assignments?.map(assignment =>
                        assignment.project_phases?.name || 'Unknown Phase'
                    ).join(', ') || 'No phases assigned';

                    // Add phase coverage information (matching main tool logic)
                    let phaseCoverageInfo = '';
                    if (this.currentPhases.length > 1) {
                        const spacePhaseIds = space.phase_space_assignments?.map(assignment => 
                            assignment.project_phases?.id
                        ) || [];
                        
                        const coversAllPhases = this.currentPhases.every(selectedPhaseId => 
                            spacePhaseIds.includes(selectedPhaseId)
                        );
                        
                        if (coversAllPhases) {
                            phaseCoverageInfo = '<p style="color: #059669; font-weight: bold;">✅ Covers all selected phases</p>';
                        } else {
                            // Get the names of missing phases
                            const missingPhaseIds = this.currentPhases.filter(selectedPhaseId => 
                                !spacePhaseIds.includes(selectedPhaseId)
                            );
                            
                            // Get phase names for missing phases
                            const missingPhaseNames = missingPhaseIds.map(phaseId => {
                                try {
                                    const allPhases = this.getAllPhasesForProject();
                                    const phase = allPhases.find(p => p.id === phaseId);
                                    return phase ? phase.name : `Phase ${phaseId}`;
                                } catch (error) {
                                    console.warn('⚠️ Error getting phase name:', error);
                                    return `Phase ${phaseId}`;
                                }
                            });
                            
                            phaseCoverageInfo = `<p style="color: #dc2626; font-weight: bold;">⚠️ Missing from phases: ${missingPhaseNames.join(', ')}</p>`;
                        }
                    }

                    // Create popup content with phase coverage info
                    let popupContent = `
                        <div class="space-popup">
                            <h4>${space.space_name || 'Unnamed Space'}</h4>
                            <p><strong>Category:</strong> ${space.category || 'Not specified'}</p>
                            <p><strong>Trade:</strong> ${space.trade || 'Not specified'}</p>
                            <p><strong>Assigned Phases:</strong> ${phaseNames}</p>
                            ${phaseCoverageInfo}
                    `;

                    // Legacy missing phases warning (keeping for compatibility)
                    if (missingPhases.length > 0) {
                        popupContent += `
                            <p><strong style="color: #dc2626;">⚠️ Missing from phases:</strong> ${missingPhases.join(', ')}</p>
                        `;
                    }

                    popupContent += `
                            <p><strong>Description:</strong> ${space.description || 'No description'}</p>
                            ${isLineString ? '' : `
                            <div style="margin-top: 10px; text-align: center;">
                                <button class="btn btn-primary btn-sm" onclick="window.logisticsMap.toggleSpaceMeasurements(${index})" style="
                                    background: #0078d4;
                                    color: white;
                                    border: none;
                                    padding: 6px 12px;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    cursor: pointer;
                                    font-weight: 500;
                                ">Toggle Measurements</button>
                            </div>`}
                        </div>
                    `;

                    layer.bindPopup(popupContent);
                    this.mapLayers.savedSpaces.addLayer(layer);
                } catch (error) {
                    console.warn(`Error creating layer for space ${index}:`, error);
                }
            }
        });
    }

    // Helper method to get all phases for the current project
    getAllPhasesForProject() {
        try {
            if (!this.currentProject) return [];
            
            // Get phases from the checkboxes (they should be loaded when project changes)
            const phaseCheckboxes = document.querySelectorAll('input[name="phases"]');
            const phases = [];
            
            phaseCheckboxes.forEach(checkbox => {
                try {
                    const label = checkbox.closest('label');
                    if (label) {
                        phases.push({
                            id: parseInt(checkbox.value),
                            name: label.textContent.trim()
                        });
                    }
                } catch (error) {
                    console.warn('⚠️ Error processing phase checkbox:', error);
                }
            });
            
            return phases;
        } catch (error) {
            console.warn('⚠️ Error in getAllPhasesForProject:', error);
            return [];
        }
    }

    // Toggle measurements for a specific space
    toggleSpaceMeasurements(spaceIndex) {
        console.log('🔧 Toggle measurements clicked for space index:', spaceIndex);
        
        if (!this.currentSpaces || !this.currentSpaces[spaceIndex]) {
            console.warn('❌ No space data for index:', spaceIndex);
            return;
        }

        const space = this.currentSpaces[spaceIndex];
        const geometry = space.geometry;
        
        if (!geometry || geometry.type !== 'Polygon') {
            console.warn('❌ Invalid geometry for space:', spaceIndex);
            return;
        }

        // Check if measurements are already visible for this space
        const existingMeasurements = this.mapLayers.measurements.getLayers();
        const hasMeasurements = existingMeasurements.some(layer => 
            layer.spaceIndex === spaceIndex
        );

        if (hasMeasurements) {
            // Hide measurements for this space
            console.log('🔧 Hiding measurements for space');
            existingMeasurements.forEach(layer => {
                if (layer.spaceIndex === spaceIndex) {
                    this.mapLayers.measurements.removeLayer(layer);
                }
            });
        } else {
            // Show measurements for this space
            console.log('🔧 Showing measurements for space');
            this.addSimpleMeasurementsToSpace(space, spaceIndex);
        }
    }

    showMeasurementsForSpaces() {
        // This method is no longer used since we switched to per-space toggles
        // Keeping it for compatibility but it's not called anymore
        console.log('🔧 Per-space measurement toggle is now used instead');
    }

    addSimpleMeasurementsToSpace(space, spaceIndex) {
        const geometry = space.geometry;
        if (!geometry || geometry.type !== 'Polygon') return;

        const coordinates = geometry.coordinates[0];
        const latLngs = coordinates.map(coord => L.latLng(coord[1], coord[0]));

        // Add measurement labels for each line segment
        for (let i = 0; i < latLngs.length - 1; i++) {
            const currentPoint = latLngs[i];
            const nextPoint = latLngs[i + 1];
            const distance = this.calculateDistanceInFeet(currentPoint, nextPoint);
            
            // Calculate midpoint
            const midPoint = L.latLng(
                (currentPoint.lat + nextPoint.lat) / 2,
                (currentPoint.lng + nextPoint.lng) / 2
            );

            // Create measurement label
            const label = L.divIcon({
                className: 'logistics-distance-label',
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
                ">${distance.toFixed(1)} ft</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });

            const marker = L.marker(midPoint, { icon: label });
            marker.spaceIndex = spaceIndex; // Store reference for cleanup
            this.mapLayers.measurements.addLayer(marker);
        }
    }



    createMeasurementLabel(measurement, isPinned) {
        // Calculate position outside the shape
        const midPoint = measurement.midPoint;
        const offsetDistance = 0.0001; // Small offset to position outside
        
        // Calculate perpendicular direction to move label outside
        const dx = measurement.endPoint.lng - measurement.startPoint.lng;
        const dy = measurement.endPoint.lat - measurement.startPoint.lat;
        const length = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / length;
        const perpY = dx / length;
        
        const labelPosition = L.latLng(
            midPoint.lat + perpY * offsetDistance,
            midPoint.lng + perpX * offsetDistance
        );

        // Create connection line from midpoint to label
        const connectionLine = L.polyline([midPoint, labelPosition], {
            color: isPinned ? '#dc2626' : '#0078d4',
            weight: 1,
            opacity: 0.6,
            dashArray: isPinned ? '0' : '5, 5'
        });

        // Create measurement label
        const label = L.divIcon({
            className: 'logistics-distance-label',
            html: `<div style="
                background: rgba(255, 255, 255, 0.95);
                border: 2px solid ${isPinned ? '#dc2626' : '#0078d4'};
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 11px;
                font-weight: bold;
                color: ${isPinned ? '#dc2626' : '#0078d4'};
                white-space: nowrap;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                pointer-events: none;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center;
                min-width: 50px;
            ">${measurement.distance.toFixed(1)} ft</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });

        const labelMarker = L.marker(labelPosition, { icon: label });

        // Add to map
        this.mapLayers.measurements.addLayer(connectionLine);
        this.mapLayers.measurements.addLayer(labelMarker);

        // Store references for cleanup
        measurement.label = labelMarker;
        measurement.connectionLine = connectionLine;
    }

    removeMeasurementLabel(measurement) {
        if (measurement.label) {
            this.mapLayers.measurements.removeLayer(measurement.label);
            measurement.label = null;
        }
        if (measurement.connectionLine) {
            this.mapLayers.measurements.removeLayer(measurement.connectionLine);
            measurement.connectionLine = null;
        }
    }

    // Map type switching
    setMapType(mapType) {
        if (!this.map) return;

        // Remove current tile layer
        if (this.currentTileLayer) {
            this.map.removeLayer(this.currentTileLayer);
        }

        // Add new tile layer based on selection (matching main tool settings)
        switch (mapType) {
            case 'satellite':
                // Use Google Satellite for high zoom levels (same as main tool)
                this.currentTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    attribution: '© Google Satellite',
                    maxZoom: 22
                });
                break;
            case 'hybrid':
                // Use Google Satellite with labels for hybrid view
                this.currentTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                    attribution: '© Google Hybrid',
                    maxZoom: 22
                });
                break;
            case 'street':
            default:
                this.currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                });
                break;
        }

        // Add the new tile layer to the map
        this.currentTileLayer.addTo(this.map);
    }

    // Distance calculation in feet (same as main tool)
    calculateDistanceInFeet(latLng1, latLng2) {
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

    updateSpaceCount(count) {
        const countElement = document.getElementById('spaceCount');
        if (countElement) {
            let countText = `${count} spaces`;
            
            // Add color legend when multiple phases are selected
            if (this.currentPhases.length > 1) {
                countText += `
                    <div style="font-size: 0.7rem; margin-top: 2px; color: #6b7280;">
                        <span style="color: #059669;">●</span> All phases 
                        <span style="color: #dc2626; margin-left: 8px;">●</span> Missing phases
                    </div>
                `;
            }
            
            countElement.innerHTML = countText;
        }
    }

    clearMap() {
        try {
            if (this.mapLayers.savedSpaces) {
                this.mapLayers.savedSpaces.clearLayers();
            }
            if (this.mapLayers.measurements) {
                this.mapLayers.measurements.clearLayers();
            }
            // Clear measurement data
            this.measurementData = [];
            this.updateSpaceCount(0);
        } catch (error) {
            console.warn('Warning clearing map:', error);
        }
    }

    // Cleanup method to prevent memory leaks
    destroy() {
        if (this.phaseChangeTimeout) {
            clearTimeout(this.phaseChangeTimeout);
        }
        this.clearMap();
        if (this.map) {
            this.map.remove();
        }
    }

    async exportData() {
        if (!this.currentProject) {
            alert('Please select a project first');
            return;
        }

        try {
            const { data: spaces, error } = await this.supabase
                .from('project_spaces')
                .select(`
                    *,
                    phase_space_assignments (
                        project_phases (id, name)
                    )
                `)
                .eq('project_id', this.currentProject.id);

            if (error) throw error;

            // Convert to exportable format
            const exportData = spaces.map(space => ({
                space_name: space.space_name,
                category: space.category,
                trade: space.trade,
                description: space.description,
                phases: space.phase_space_assignments?.map(assignment => 
                    assignment.project_phases?.name
                ).join(', ') || 'No phases',
                geometry: space.geometry
            }));

            // Download as JSON
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentProject.name}_spaces_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('🔧 Data exported');
        } catch (error) {
            console.error('❌ Error exporting data:', error);
            alert('Error exporting data: ' + error.message);
        }
    }

    async exportHDImage() {
        if (!this.map) {
            alert('Map not initialized');
            return;
        }

        try {
            // Show loading message
            const loadingMsg = document.createElement('div');
            loadingMsg.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 10000;
                font-family: Arial, sans-serif;
            `;
            loadingMsg.textContent = 'Exporting image...';
            document.body.appendChild(loadingMsg);

            // Wait for map to be fully rendered
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get map container
            const mapContainer = this.map.getContainer();
            if (!mapContainer) {
                throw new Error('Map container not found');
            }

            console.log('🔧 BULLETPROOF APPROACH: Manual coordinate conversion');

            // Step 1: Temporarily hide ALL shape layers to capture clean map
            const originalShapes = [];
            
            // Hide all possible shape layers
            const layersToHide = [
                this.mapLayers.savedSpaces,
                this.mapLayers.measurements,
                this.mapLayers.drawnItems
            ];
            
            layersToHide.forEach(layerGroup => {
                if (layerGroup) {
                    layerGroup.eachLayer(layer => {
                        if (layer.getElement) {
                            const element = layer.getElement();
                            if (element) {
                                originalShapes.push({ layer, element, originalDisplay: element.style.display });
                                element.style.display = 'none';
                            }
                        }
                    });
                }
            });
            
            // Also hide any SVG elements that might be shapes
            const svgElements = mapContainer.querySelectorAll('svg');
            svgElements.forEach(svg => {
                originalShapes.push({ element: svg, originalDisplay: svg.style.display });
                svg.style.display = 'none';
            });

            // Step 2: Capture the map without shapes
            const mapCanvas = await html2canvas(mapContainer, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                width: mapContainer.offsetWidth,
                height: mapContainer.offsetHeight
            });

            // Step 3: Restore original shapes
            originalShapes.forEach(({ element, originalDisplay }) => {
                element.style.display = originalDisplay;
            });

            console.log('🔧 Map captured, size:', mapCanvas.width, 'x', mapCanvas.height);
            console.log('🔧 Hidden', originalShapes.length, 'elements during capture');

            // Step 4: Create a new canvas for the final image
            const finalCanvas = document.createElement('canvas');
            const finalCtx = finalCanvas.getContext('2d');
            finalCanvas.width = mapCanvas.width;
            finalCanvas.height = mapCanvas.height;

            // Step 5: Draw the map as background
            finalCtx.drawImage(mapCanvas, 0, 0);

            // Step 6: Manually draw each shape at exact coordinates
            if (this.currentSpaces && this.currentSpaces.length > 0) {
                console.log('🔧 Drawing', this.currentSpaces.length, 'shapes manually...');
                console.log('🔧 Current spaces:', this.currentSpaces.map(s => ({ id: s.id, name: s.space_name || 'Unnamed' })));
                
                const drawPolygon = (coords, fillColor, strokeColor, lineDash = null, fillOpacity = 0.3, strokeWidth = 4) => {
                    const pixel = coords.map(coord => this.map.latLngToContainerPoint(L.latLng(coord[1], coord[0])));
                    const scaled = pixel.map(p => ({ x: p.x * 2, y: p.y * 2 }));
                    if (scaled.length < 2) return;
                    finalCtx.beginPath();
                    finalCtx.moveTo(scaled[0].x, scaled[0].y);
                    for (let i = 1; i < scaled.length; i++) finalCtx.lineTo(scaled[i].x, scaled[i].y);
                    finalCtx.closePath();
                    const alpha = Math.max(0, Math.min(1, fillOpacity));
                    // append alpha to hex if provided in hex, fallback to rgba
                    try {
                        if (fillColor.startsWith('#') && (fillColor.length === 7 || fillColor.length === 4)) {
                            finalCtx.fillStyle = fillColor + Math.floor(alpha * 255).toString(16).padStart(2, '0');
                        } else {
                            finalCtx.fillStyle = fillColor;
                            finalCtx.globalAlpha = alpha;
                        }
                        finalCtx.fill();
                        finalCtx.globalAlpha = 1;
                    } catch(_) { finalCtx.fillStyle = fillColor; finalCtx.fill(); }
                    if (lineDash && finalCtx.setLineDash) finalCtx.setLineDash(lineDash);
                    finalCtx.strokeStyle = strokeColor;
                    finalCtx.lineWidth = strokeWidth;
                    finalCtx.stroke();
                    if (finalCtx.setLineDash) finalCtx.setLineDash([]);
                };

                this.currentSpaces.forEach((space, index) => {
                    if (!space.geometry) return;

                    // Determine category color for regular shapes
                    const categoryInfo = this.spaceCategories?.find(cat => cat.name === space.category);
                    const defaultFill = categoryInfo?.color || '#3b82f6';
                    const spacePhaseIds = space.phase_space_assignments?.map(a => a.project_phases?.id).filter(id => id !== undefined) || [];
                    const missingWhenMulti = this.currentPhases.length > 1 && this.currentPhases.some(sel => !spacePhaseIds.includes(sel));
                    const strokeColor = missingWhenMulti ? '#dc2626' : defaultFill;
                    const fillOpacity = missingWhenMulti ? 0.2 : 0.3;

                    if (space.geometry.type === 'Polygon') {
                        drawPolygon(space.geometry.coordinates[0], defaultFill, strokeColor, null, fillOpacity);
                        console.log(`🔧 Drew polygon ${index} at exact coordinates`);
                    } else if (space.geometry.type === 'LineString') {
                        // Fences
                        const coords = space.geometry.coordinates;
                        const pixel = coords.map(coord => this.map.latLngToContainerPoint(L.latLng(coord[1], coord[0])));
                        const scaled = pixel.map(p => ({ x: p.x * 2, y: p.y * 2 }));
                        if (scaled.length > 1) {
                            finalCtx.beginPath();
                            finalCtx.moveTo(scaled[0].x, scaled[0].y);
                            for (let i = 1; i < scaled.length; i++) finalCtx.lineTo(scaled[i].x, scaled[i].y);
                            finalCtx.strokeStyle = '#ffd700';
                            finalCtx.lineWidth = 4;
                            finalCtx.stroke();
                            console.log(`🔧 Drew fence ${index} at exact coordinates`);
                        }
                    } else if (space.geometry.type === 'FeatureCollection') {
                        // Crane shapes composed of multiple parts
                        try {
                            space.geometry.features.forEach(feat => {
                                if (!feat || !feat.geometry) return;
                                const part = feat.properties?.part;
                                if (feat.geometry.type === 'Polygon') {
                                    if (part === 'pad') {
                                        drawPolygon(feat.geometry.coordinates[0], '#1f2937', '#1f2937', null, 0.6, 2);
                                    } else if (part === 'sweep') {
                                        drawPolygon(feat.geometry.coordinates[0], '#f59e0b', '#dc2626', [10, 5], 0.25, 3);
                                    } else {
                                        // default polygon style
                                        drawPolygon(feat.geometry.coordinates[0], defaultFill, strokeColor, null, fillOpacity);
                                    }
                                } else if (feat.geometry.type === 'LineString') {
                                    // Radius line (optional: make subtle)
                                    const coords = feat.geometry.coordinates;
                                    const pixel = coords.map(coord => this.map.latLngToContainerPoint(L.latLng(coord[1], coord[0])));
                                    const scaled = pixel.map(p => ({ x: p.x * 2, y: p.y * 2 }));
                                    if (scaled.length > 1) {
                                        finalCtx.beginPath();
                                        finalCtx.moveTo(scaled[0].x, scaled[0].y);
                                        for (let i = 1; i < scaled.length; i++) finalCtx.lineTo(scaled[i].x, scaled[i].y);
                                        finalCtx.strokeStyle = part === 'radius' ? 'rgba(0,0,0,0.2)' : strokeColor;
                                        finalCtx.lineWidth = 2;
                                        finalCtx.stroke();
                                    }
                                }
                            });
                            console.log(`🔧 Drew crane shape ${index}`);
                        } catch (e) {
                            console.warn('⚠️ Error drawing crane shape', e);
                        }
                    }
                });
            }

            // Remove loading message
            document.body.removeChild(loadingMsg);

            // Step 7: Download the final image
            finalCanvas.toBlob((blob) => {
                if (!blob) {
                    throw new Error('Failed to create blob from final canvas');
                }
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `logistics_map_${this.currentProject?.name || 'map'}_${new Date().toISOString().split('T')[0]}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                console.log('🔧 BULLETPROOF export completed successfully');
            }, 'image/png');

        } catch (error) {
            console.error('❌ Error in bulletproof export:', error);
            alert('Error exporting image: ' + error.message);
            
            // Remove loading message if it exists
            const existingMsg = document.querySelector('[style*="position: fixed"]');
            if (existingMsg) {
                document.body.removeChild(existingMsg);
            }
        }
    }


    // Loading Animation Methods
    showLoadingAnimation() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.id = 'loadingOverlay';
        overlay.innerHTML = `
            <div class="loading-container">
                <div class="loading-text">Loading Logistics Map</div>
                <div class="brick-wall" id="brickWall"></div>
                <div class="loading-dots"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        this.startBrickAnimation();
    }

    hideLoadingAnimation() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    startBrickAnimation() {
        const brickWall = document.getElementById('brickWall');
        if (!brickWall) return;

        let brickCount = 0;
        let currentRow = 0;
        const maxRows = 5;
        const bricksPerRow = 4;
        const brickWidth = 40;
        const brickHeight = 20;
        const rowOffset = brickWidth / 2;

        const addBrick = () => {
            if (brickCount >= bricksPerRow * maxRows) {
                // Reset animation
                brickCount = 0;
                currentRow = 0;
                brickWall.innerHTML = '';
                setTimeout(addBrick, 500);
                return;
            }

            const row = Math.floor(brickCount / bricksPerRow);
            const positionInRow = brickCount % bricksPerRow;

            const brick = document.createElement('div');
            brick.className = 'brick';

            const x = positionInRow * brickWidth + (row % 2) * rowOffset;
            const y = row * brickHeight;

            brick.style.left = x + 'px';
            brick.style.top = y + 'px';
            brick.style.animationDelay = (brickCount * 0.1) + 's';

            brickWall.appendChild(brick);

            brickCount++;

            if (brickCount % bricksPerRow === 0 && brickCount > 0) {
                currentRow++;
                if (currentRow >= maxRows) {
                    setTimeout(() => {
                        brickWall.classList.add('dropping');
                        setTimeout(() => {
                            brickWall.classList.remove('dropping');
                            const bricks = brickWall.querySelectorAll('.brick');
                            for (let i = 0; i < bricksPerRow; i++) {
                                if (bricks[i]) {
                                    bricks[i].remove();
                                }
                            }
                            const remainingBricks = brickWall.querySelectorAll('.brick');
                            remainingBricks.forEach((brick, index) => {
                                const row = Math.floor(index / bricksPerRow);
                                const positionInRow = index % bricksPerRow;
                                const x = positionInRow * brickWidth + (row % 2) * rowOffset;
                                const y = row * brickHeight;
                                brick.style.left = x + 'px';
                                brick.style.top = y + 'px';
                            });
                            currentRow = maxRows - 1;
                        }, 200);
                    }, 300);
                }
            }
            
            // Continue adding bricks
            setTimeout(addBrick, 150);
        };
        addBrick();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.logisticsMap = new LogisticsMap();
});
