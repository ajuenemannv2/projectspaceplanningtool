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
        this.supabase = null;
        this.phaseChangeTimeout = null;
        this.currentTileLayer = null;
        
        this.init();
    }

    async init() {
        console.log('🔧 Initializing Logistics Map...');
        
        // Show loading animation
        this.showLoadingAnimation();
        
        try {
            // Initialize Supabase
            if (typeof supabase === 'undefined') {
                console.error('❌ Supabase not loaded!');
                return;
            }

            this.supabase = supabase.createClient(
                'https://yfewnhiugwmtdenxvrme.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZXduaGl1Z3dtdGRlbnh2cm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc3MDI2MzEsImV4cCI6MjA3MzI3ODYzMX0.aawp6SPxxPNSGmOVQ4zfPM258mo48SZmtelTko7JkGg'
            );

            // Initialize map
            this.initializeMap();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load projects
            await this.loadProjects();
            
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
            phases.forEach((phase, index) => {
                const label = document.createElement('label');
                // Auto-select the first phase
                const checked = index === 0 ? 'checked' : '';
                label.innerHTML = `
                    <input type="checkbox" value="${phase.id}" name="phases" ${checked}>
                    ${phase.name}
                `;
                container.appendChild(label);
            });

            // Auto-select first phase and load spaces
            if (phases.length > 0) {
                this.currentPhases = [phases[0].id];
                this.onPhaseChange();
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

        spaces.forEach((space, index) => {
            if (space && space.geometry) {
                try {
                    // Determine color based on phase coverage (same logic as main tool)
                    const spacePhaseIds = space.phase_space_assignments?.map(assignment => 
                        assignment.project_phases?.id
                    ).filter(id => id !== undefined) || [];

                    let color = '#059669'; // Green - default
                    let fillColor = '#10b981';
                    let missingPhases = [];

                    // If multiple phases are selected, check if space exists in ALL of them
                    if (this.currentPhases.length > 1) {
                        const missingPhaseIds = this.currentPhases.filter(selectedId => 
                            !spacePhaseIds.includes(selectedId)
                        );
                        
                        if (missingPhaseIds.length > 0) {
                            color = '#dc2626'; // Red - missing phases
                            fillColor = '#ef4444';
                            
                            // Get names of missing phases
                            const allPhases = this.getAllPhasesForProject();
                            missingPhases = missingPhaseIds.map(id => {
                                const phase = allPhases.find(p => p.id === id);
                                return phase ? phase.name : `Phase ${id}`;
                            });
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
                        layer = L.geoJSON(space.geometry, {
                            style: {
                                color: color,
                                fillColor: fillColor,
                                fillOpacity: 0.3,
                                weight: 2,
                                opacity: 0.8
                            }
                        });
                    }

                    const phaseNames = space.phase_space_assignments?.map(assignment =>
                        assignment.project_phases?.name || 'Unknown Phase'
                    ).join(', ') || 'No phases assigned';

                    // Create popup content with phase coverage info
                    let popupContent = `
                        <div class="space-popup">
                            <h4>${space.space_name || 'Unnamed Space'}</h4>
                            <p><strong>Category:</strong> ${space.category || 'Not specified'}</p>
                            <p><strong>Trade:</strong> ${space.trade || 'Not specified'}</p>
                            <p><strong>Assigned Phases:</strong> ${phaseNames}</p>
                    `;

                    // Add missing phases warning if applicable
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
        if (!this.currentProject) return [];
        
        // Get phases from the checkboxes (they should be loaded when project changes)
        const phaseCheckboxes = document.querySelectorAll('input[name="phases"]');
        const phases = [];
        
        phaseCheckboxes.forEach(checkbox => {
            const label = checkbox.closest('label');
            if (label) {
                phases.push({
                    id: parseInt(checkbox.value),
                    name: label.textContent.trim()
                });
            }
        });
        
        return phases;
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
                
                this.currentSpaces.forEach((space, index) => {
                    if (!space.geometry) return;

                    if (space.geometry.type === 'Polygon') {
                        const coordinates = space.geometry.coordinates[0];

                        const pixelCoords = coordinates.map(coord => {
                            const latLng = L.latLng(coord[1], coord[0]);
                            return this.map.latLngToContainerPoint(latLng);
                        });

                        const scaledCoords = pixelCoords.map(point => ({
                            x: point.x * 2,
                            y: point.y * 2
                        }));

                        const spacePhaseIds = space.phase_space_assignments?.map(assignment => 
                            assignment.project_phases?.id
                        ).filter(id => id !== undefined) || [];

                        let color = '#10b981';
                        if (this.currentPhases.length > 1) {
                            const missingPhaseIds = this.currentPhases.filter(selectedId => 
                                !spacePhaseIds.includes(selectedId)
                            );
                            if (missingPhaseIds.length > 0) {
                                color = '#ef4444';
                            }
                        }

                        finalCtx.beginPath();
                        finalCtx.moveTo(scaledCoords[0].x, scaledCoords[0].y);
                        for (let i = 1; i < scaledCoords.length; i++) {
                            finalCtx.lineTo(scaledCoords[i].x, scaledCoords[i].y);
                        }
                        finalCtx.closePath();

                        finalCtx.fillStyle = color + '4D';
                        finalCtx.fill();
                        finalCtx.strokeStyle = color;
                        finalCtx.lineWidth = 4;
                        finalCtx.stroke();

                        console.log(`🔧 Drew polygon ${index} at exact coordinates`);
                    } else if (space.geometry.type === 'LineString') {
                        // Draw fences as yellow polylines
                        const coordinates = space.geometry.coordinates;

                        const pixelCoords = coordinates.map(coord => {
                            const latLng = L.latLng(coord[1], coord[0]);
                            return this.map.latLngToContainerPoint(latLng);
                        });

                        const scaledCoords = pixelCoords.map(point => ({
                            x: point.x * 2,
                            y: point.y * 2
                        }));

                        if (scaledCoords.length > 1) {
                            finalCtx.beginPath();
                            finalCtx.moveTo(scaledCoords[0].x, scaledCoords[0].y);
                            for (let i = 1; i < scaledCoords.length; i++) {
                                finalCtx.lineTo(scaledCoords[i].x, scaledCoords[i].y);
                            }
                            finalCtx.strokeStyle = '#ffd700'; // Yellow to match on-map style
                            finalCtx.lineWidth = 4; // 2px * scale factor
                            finalCtx.stroke();

                            console.log(`🔧 Drew fence ${index} at exact coordinates`);
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
