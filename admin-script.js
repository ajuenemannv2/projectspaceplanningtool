// Admin Panel with Database Integration
// Supabase is loaded via CDN and available globally

// SECURITY WARNING: Write operations disabled for security
// All database write operations have been disabled to prevent unauthorized access
// Only read operations are allowed in this version

class AdminPanelDatabase {
    constructor() {
        this.projects = [];
        this.projectPhases = [];
        this.projectSpaces = [];
        this.spaceCategories = [];
        this.companies = [];
        this.activityLog = [];
        this.settings = {};
        this.currentProject = null;
        
        
        // Initialize Supabase client
        console.log('🔧 Initializing admin panel...');
        console.log('🔧 Supabase object available:', typeof supabase);
        
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase not loaded!');
            alert('Error: Supabase not loaded. Please refresh the page.');
            return;
        }
        
        this.supabase = supabase.createClient(
            window.SUPABASE_CONFIG.url,
            window.SUPABASE_CONFIG.anonKey
        );
        
        console.log('✅ Supabase client created');
        
        this.init();
    }

    async init() {
        console.log('🔧 Admin panel init starting...');
        
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
            const requireConfig = () => {
                if (!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
                    showError('Configuration error: Supabase settings not found. Ensure config/public-supabase-config.js is included with a valid URL and anon key.', () => window.location.reload());
                    throw new Error('Missing Supabase config');
                }
            };
            requireConfig();
            
            await this.loadData();
            console.log('✅ Data loaded');
            
        this.setupEventListeners();
            console.log('✅ Event listeners setup');
            
            // Update all tables with loaded data
            this.updateProjectsTable();
            console.log('✅ Projects table updated');
            
            this.updateSpacesTable();
            console.log('✅ Spaces table updated');
            
            this.updateCategoriesTable();
            console.log('✅ Categories table updated');
            
            this.updateCompaniesTable();
            console.log('✅ Companies table updated');
            
            await this.updateDashboard();
            console.log('✅ Dashboard updated');
            
        this.loadSettings();
            console.log('✅ Settings loaded');
            
            // Hide loading animation
            this.hideLoadingAnimation();
            
            console.log('🎉 Admin panel initialization complete!');
        } catch (error) {
            console.error('❌ Admin panel init failed:', error);
            this.hideLoadingAnimation();
            alert('Error initializing admin panel: ' + error.message);
        }
    }

    // Data Management
    async loadData() {
        try {
            // Load projects from database
            const { data: projects, error } = await this.supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            this.projects = projects || [];
            console.log('Projects loaded:', this.projects);

            // Load space categories from database
            const { data: categories, error: categoriesError } = await this.supabase
                .from('space_categories')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });
            
            if (categoriesError) throw categoriesError;
            this.spaceCategories = categories || [];

            // Load companies from database
            const { data: companies, error: companiesError } = await this.supabase
                .from('companies')
                .select('*')
                .eq('is_active', true)
                .order('name', { ascending: true });
            
            if (companiesError) throw companiesError;
            this.companies = companies || [];

            // Load activity log from localStorage (for now)
            this.activityLog = JSON.parse(localStorage.getItem('admin_activity_log')) || [];
            
            // Load settings from localStorage
            this.settings = JSON.parse(localStorage.getItem('admin_settings')) || {};
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data from database');
        }
    }

    async loadProjectPhases(projectId) {
        try {
            const { data: phases, error } = await this.supabase
                .from('project_phases')
                .select('*')
                .eq('project_id', projectId)
                .order('phase_order', { ascending: true });
            
            if (error) throw error;
            
            // Store phases for this specific project
            if (!this.projectPhases) {
                this.projectPhases = [];
            }
            
            // Remove existing phases for this project and add new ones
            this.projectPhases = this.projectPhases.filter(p => p.project_id !== projectId);
            this.projectPhases.push(...(phases || []));
            
            console.log('🔧 Total projectPhases array length after load:', this.projectPhases.length);
            console.log('🔧 All phases in array:', this.projectPhases.map(p => ({ id: p.id, project_id: p.project_id, name: p.name })));
            
            console.log('Phases loaded for project', projectId, ':', phases?.length || 0, 'phases');
            
            // Temporarily disable cleanup to test
            // await this.cleanupDuplicateOrders(projectId);
            
            return phases || [];
        } catch (error) {
            console.error('Error loading project phases:', error);
            this.showError('Failed to load project phases');
            return [];
        }
    }

    async cleanupDuplicateOrders(projectId) {
        const projectPhases = this.projectPhases.filter(p => p.project_id === projectId);
        const sortedPhases = [...projectPhases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
        
        // Check for actual duplicate phases (same name, description, order)
        const seenPhases = new Map();
        const duplicatesToRemove = [];
        
        for (const phase of sortedPhases) {
            const key = `${phase.name}-${phase.description}-${phase.phase_order}`;
            if (seenPhases.has(key)) {
                // This is a duplicate, mark for removal
                duplicatesToRemove.push(phase.id);
                console.log('🔧 Found duplicate phase:', phase.name, 'ID:', phase.id);
            } else {
                seenPhases.set(key, phase.id);
            }
        }
        
        // Remove duplicate phases
        for (const duplicateId of duplicatesToRemove) {
            console.log('🔧 Removing duplicate phase ID:', duplicateId);
            await this.deleteProjectPhase(duplicateId);
        }
        
        // Now fix order numbers
        const remainingPhases = this.projectPhases.filter(p => p.project_id === projectId && !duplicatesToRemove.includes(p.id));
        const needsUpdate = [];
        
        for (let i = 0; i < remainingPhases.length; i++) {
            const expectedOrder = i + 1;
            if (remainingPhases[i].phase_order !== expectedOrder) {
                needsUpdate.push({ id: remainingPhases[i].id, newOrder: expectedOrder });
            }
        }
        
        // Update phases that need renumbering
        for (const update of needsUpdate) {
            await this.updateProjectPhase(update.id, { phase_order: update.newOrder });
        }
        
        if (duplicatesToRemove.length > 0 || needsUpdate.length > 0) {
            console.log('🔧 Cleaned up duplicates and orders:', { duplicates: duplicatesToRemove.length, reorders: needsUpdate.length });
            // Reload phases after cleanup
            const { data: phases, error } = await this.supabase
                .from('project_phases')
                .select('*')
                .eq('project_id', projectId)
                .order('phase_order', { ascending: true });
            
            if (!error && phases) {
                this.projectPhases = this.projectPhases.filter(p => p.project_id !== projectId);
                this.projectPhases.push(...phases);
            }
        }
    }

    async loadProjectSpaces(projectId) {
        try {
            const { data: spaces, error } = await this.supabase
                .from('project_spaces')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            this.projectSpaces = spaces || [];
            console.log('Spaces loaded for project', projectId, ':', this.projectSpaces);
        } catch (error) {
            console.error('Error loading project spaces:', error);
            this.showError('Failed to load project spaces');
        }
    }

    // Project Management
    async createProject(projectData) {
        // SECURITY: Write operations disabled
        console.warn('🚫 SECURITY: Write operations disabled for security');
        alert('Write operations have been disabled for security. Contact administrator.');
        return { error: 'Write operations disabled' };
        
        try {
            console.log('🔧 Creating project with data:', projectData);
            
            const { data, error } = await this.supabase
                .from('projects')
                .insert([{
                    name: projectData.name,
                    coordinates: [parseFloat(projectData.latitude), parseFloat(projectData.longitude)],
                    zoom_level: parseInt(projectData.zoom_level) || 16,
                    description: projectData.description || '',
                status: 'active'
                }])
                .select();
            
            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }
            
            console.log('✅ Project created successfully:', data[0]);
            const newProject = data[0];
            this.projects.unshift(newProject);
            this.logActivity('Project Created', { projectName: newProject.name, projectId: newProject.id });
            this.updateProjectsTable();
            this.updateDashboard();
            return newProject;
        } catch (error) {
            console.error('❌ Error creating project:', error);
            this.showError('Failed to create project: ' + error.message);
            throw error;
        }
    }

    async updateProject(projectId, projectData) {
        try {
            const { data, error } = await this.supabase
                .from('projects')
                .update({
                    name: projectData.name,
                    coordinates: [parseFloat(projectData.latitude), parseFloat(projectData.longitude)],
                    zoom_level: parseInt(projectData.zoom_level) || 16,
                    description: projectData.description || '',
                    status: projectData.status || 'active'
                })
                .eq('id', projectId)
                .select();
            
            if (error) throw error;
            
            const updatedProject = data[0];
            const index = this.projects.findIndex(p => p.id === projectId);
            if (index !== -1) {
                this.projects[index] = updatedProject;
            }
            this.logActivity('Project Updated', { projectName: updatedProject.name, projectId: projectId });
            this.updateProjectsTable();
            return updatedProject;
        } catch (error) {
            console.error('Error updating project:', error);
            this.showError('Failed to update project');
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            const { error } = await this.supabase
                .from('projects')
                .delete()
                .eq('id', projectId);
            
            if (error) throw error;
            
            this.projects = this.projects.filter(p => p.id !== projectId);
            this.logActivity('Project Deleted', { projectId: projectId });
            this.updateProjectsTable();
            this.updateDashboard();
        } catch (error) {
            console.error('Error deleting project:', error);
            this.showError('Failed to delete project');
            throw error;
        }
    }

    // Phase Management
    async createProjectPhase(phaseData) {
        try {
            // If no order specified, assign the next available order
            let phaseOrder = parseInt(phaseData.phase_order) || 1;
            if (!phaseData.phase_order) {
                const projectPhases = this.projectPhases.filter(p => p.project_id === phaseData.project_id);
                const maxOrder = Math.max(0, ...projectPhases.map(p => p.phase_order || 0));
                phaseOrder = maxOrder + 1;
                console.log('🔧 Auto-assigned phase order:', phaseOrder);
            }
            
            const { data, error } = await this.supabase
                .from('project_phases')
                .insert([{
                    project_id: phaseData.project_id,
                    name: phaseData.name,
                    phase_order: phaseOrder,
                    description: phaseData.description || '',
                status: 'active'
                }])
                .select();
            
            if (error) throw error;
            
            const newPhase = data[0];
            this.projectPhases.push(newPhase);
            this.logActivity('Phase Created', { phaseName: newPhase.name, projectId: phaseData.project_id });
            this.updatePhasesTable();
            return newPhase;
        } catch (error) {
            console.error('Error creating phase:', error);
            this.showError('Failed to create phase');
            throw error;
        }
    }

    async updateProjectPhase(phaseId, phaseData) {
        try {
            const { data, error } = await this.supabase
                .from('project_phases')
                .update({
                    name: phaseData.name,
                    phase_order: parseInt(phaseData.phase_order) || 1,
                    description: phaseData.description || '',
                    status: phaseData.status || 'active'
                })
                .eq('id', phaseId)
                .select();
            
            if (error) throw error;
            const updatedPhase = data[0];
            const index = this.projectPhases.findIndex(p => p.id === phaseId);
            if (index !== -1) {
                this.projectPhases[index] = updatedPhase;
            }
            this.logActivity('Phase Updated', { phaseName: updatedPhase.name, phaseId: phaseId });
            this.updatePhasesTable();
            return updatedPhase;
        } catch (error) {
            console.error('Error updating phase:', error);
            this.showError('Failed to update phase');
            throw error;
        }
    }

    async deleteProjectPhase(phaseId) {
        try {
            const { error } = await this.supabase
                .from('project_phases')
                .delete()
                .eq('id', phaseId);
            
            if (error) throw error;
            this.projectPhases = this.projectPhases.filter(p => p.id !== phaseId);
            this.logActivity('Phase Deleted', { phaseId: phaseId });
            this.updatePhasesTable();
        } catch (error) {
            console.error('Error deleting phase:', error);
            this.showError('Failed to delete phase');
            throw error;
        }
    }

    // Phase UI Functions
    editProjectPhase(phaseId) {
        console.log('🔧 Editing phase:', phaseId, 'type:', typeof phaseId);
        console.log('🔧 Available phases:', this.projectPhases);
        
        // Convert phaseId to number for comparison
        const numericPhaseId = parseInt(phaseId);
        const phase = this.projectPhases.find(p => p.id === numericPhaseId);
        console.log('🔧 Found phase:', phase);
        
        if (!phase) {
            this.showError('Phase not found');
            return;
        }

        const project = this.projects.find(p => p.id === phase.project_id);
        console.log('🔧 Found project:', project);
        this.showEditPhaseModal(project, phase);
    }

    confirmDeleteProjectPhase(phaseId) {
        const numericPhaseId = parseInt(phaseId);
        const phase = this.projectPhases.find(p => p.id === numericPhaseId);
        if (!phase) {
            this.showError('Phase not found');
            return;
        }

        if (confirm(`Are you sure you want to delete the phase "${phase.name}"?`)) {
            this.deleteProjectPhase(numericPhaseId).then(() => {
                this.showSuccess('Phase deleted successfully');
                // Refresh the phase management modal if it's open
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    modal.remove();
                }
            }).catch(error => {
                this.showError('Failed to delete phase');
            });
        }
    }

    // Drag and Drop Functions
    handleDragStart(event, phaseId) {
        console.log('🔧 Drag started for phase:', phaseId);
        this.draggedPhaseId = phaseId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', phaseId.toString());
        
        // Add visual feedback without causing layout shifts
        event.target.style.opacity = '0.6';
        event.target.style.transform = 'scale(0.98)';
        event.target.style.zIndex = '1000';
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(event) {
        event.preventDefault();
        if (event.target.classList.contains('phase-item') && event.target.dataset.phaseId != this.draggedPhaseId) {
            event.target.style.borderColor = '#10b981';
            event.target.style.backgroundColor = '#ecfdf5';
        }
    }

    handleDragLeave(event) {
        if (event.target.classList.contains('phase-item')) {
            event.target.style.borderColor = '#e2e8f0';
            event.target.style.backgroundColor = 'white';
        }
    }

    async handleDrop(event, targetPhaseId) {
        event.preventDefault();
        console.log('🔧 Drop on phase:', targetPhaseId, 'dragged phase:', this.draggedPhaseId);
        
        if (this.draggedPhaseId == targetPhaseId) {
            this.resetDragStyles();
            return;
        }

        // Prevent multiple simultaneous operations
        if (this.isDragOperationInProgress) {
            console.log('🔧 Drag operation already in progress, ignoring');
            this.resetDragStyles();
            return;
        }

        this.isDragOperationInProgress = true;

        try {
            // Get all phases for this project
            const projectId = this.getCurrentProjectId();
            if (!projectId) {
                this.showError('Project not found');
                this.resetDragStyles();
                this.isDragOperationInProgress = false;
                return;
            }

            // Reload phases to ensure we have current data
            await this.loadProjectPhases(projectId);
            const projectPhases = this.projectPhases.filter(p => p.project_id == projectId);
            
            // Find the dragged and target phases
            const draggedPhase = projectPhases.find(p => p.id == this.draggedPhaseId);
            const targetPhase = projectPhases.find(p => p.id == targetPhaseId);
            
            if (!draggedPhase || !targetPhase) {
                console.error('❌ Phase not found - dragged:', draggedPhase, 'target:', targetPhase);
                this.showError('Phase not found');
                this.resetDragStyles();
                this.isDragOperationInProgress = false;
                return;
            }

            // Simple swap: just swap the order numbers
            const tempOrder = draggedPhase.phase_order;
            await this.updateProjectPhase(this.draggedPhaseId, { phase_order: targetPhase.phase_order });
            await this.updateProjectPhase(targetPhaseId, { phase_order: tempOrder });
            
            // Reload and refresh
            console.log('🔧 About to reload phases after drag operation');
            await this.loadProjectPhases(projectId);
            console.log('🔧 About to refresh modal after drag operation');
            await this.refreshPhaseManagementModal(projectId);
            
            this.showSuccess('Phase order updated successfully!');
            
        } catch (error) {
            console.error('❌ Error reordering phases:', error);
            this.showError('Failed to reorder phases');
        } finally {
            this.resetDragStyles();
            this.isDragOperationInProgress = false;
        }
    }

    getCurrentProjectId() {
        // Get the current project ID from the modal title or context
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            const title = modal.querySelector('h3');
            if (title && title.textContent.includes('Manage Phases')) {
                // Extract project ID from the modal context
                // This is a bit hacky, but we can store it in a data attribute
                return modal.dataset.projectId;
            }
        }
        return null;
    }


    resetDragStyles() {
        // Reset all phase item styles
        const phaseItems = document.querySelectorAll('.phase-item');
        phaseItems.forEach(item => {
            item.style.opacity = '1';
            item.style.transform = 'none';
            item.style.zIndex = 'auto';
            item.style.borderColor = '#e2e8f0';
            item.style.backgroundColor = 'white';
        });
        this.draggedPhaseId = null;
    }

    async refreshPhaseManagementModal(projectId) {
        console.log('🔧 Refreshing phase management modal for project:', projectId);
        
        const modal = document.querySelector('.modal-overlay');
        if (modal && modal.dataset.projectId == projectId) {
            // Find the phases list container
            const phasesList = modal.querySelector('#phasesList');
            if (phasesList) {
                // Get fresh data directly from database to avoid cached array issues
                try {
                    const { data: freshPhases, error } = await this.supabase
                        .from('project_phases')
                        .select('*')
                        .eq('project_id', projectId)
                        .order('phase_order', { ascending: true });
                    
                    if (error) throw error;
                    
                    const project = this.projects.find(p => p.id == projectId);
                    console.log('🔧 Fresh phases from database:', freshPhases?.length || 0, 'phases');
                    console.log('🔧 Fresh phase data:', freshPhases?.map(p => ({ id: p.id, name: p.name, order: p.phase_order })));
                    
                    // Update just the phases list content
                    phasesList.innerHTML = this.generatePhaseItemsHTML(freshPhases || [], project);
                    console.log('🔧 Phases list refreshed in place with fresh data');
                } catch (error) {
                    console.error('❌ Error getting fresh phases:', error);
                    // Fallback: close and reopen
                    modal.remove();
                    this.manageProjectPhases(projectId);
                }
            } else {
                console.log('🔧 Phases list not found, falling back to full refresh');
                // Fallback: close and reopen
                modal.remove();
                this.manageProjectPhases(projectId);
            }
        }
    }

    // Phase Modal Functions
    showEditPhaseModal(project, phase) {
        console.log('🔧 Creating EDIT phase modal for project:', project.name, 'phase:', phase.name);
        
        const container = document.getElementById('modalContainer');
        container.innerHTML = '';
        
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Edit Phase</h3>
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
                    ${this.getEditPhaseFormHTML(project, phase)}
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        this.setupEditPhaseFormHandlers(phase.id);
    }

    showAddPhaseModal(projectId = null, phase = null) {
        console.log('🔧 Creating phase modal for project:', projectId, 'phase:', phase);
        console.log('🔧 Phase parameter type:', typeof phase, 'is null?', phase === null);
        
        const container = document.getElementById('modalContainer');
        container.innerHTML = '';
        
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
        
        const isEdit = phase !== null;
        const title = isEdit ? 'Edit Phase' : 'Add New Phase';
        console.log('🔧 isEdit:', isEdit, 'title:', title);
        
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">${title}</h3>
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
                    ${(() => {
                        console.log('🔧 About to call getPhaseFormHTML with phase:', phase, 'projectId:', projectId);
                        return this.getPhaseFormHTML(phase, projectId);
                    })()}
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        this.setupPhaseFormHandlers(phase ? phase.id : null);
    }

    // Space Management
    async createProjectSpace(spaceData) {
        try {
            const { data, error } = await this.supabase
                .from('project_spaces')
                .insert([{
                    project_id: spaceData.project_id,
                    space_name: spaceData.space_name,
                    space_category: spaceData.space_category,
                    trade: spaceData.trade || '',
                    description: spaceData.description || '',
                    geometry: spaceData.geometry,
                status: 'active'
                }])
                .select();
            
            if (error) throw error;
            const newSpace = data[0];
            this.projectSpaces.push(newSpace);
            this.logActivity('Space Created', { spaceName: newSpace.space_name, projectId: spaceData.project_id });
            this.updateSpacesTable();
            return newSpace;
        } catch (error) {
            console.error('Error creating space:', error);
            this.showError('Failed to create space');
            throw error;
        }
    }

    async updateProjectSpace(spaceId, spaceData) {
        try {
            const { data, error } = await this.supabase
                .from('project_spaces')
                .update({
                    space_name: spaceData.space_name,
                    space_category: spaceData.space_category,
                    trade: spaceData.trade || '',
                    description: spaceData.description || '',
                    geometry: spaceData.geometry,
                    status: spaceData.status || 'active'
                })
                .eq('id', spaceId)
                .select();
            
            if (error) throw error;
            const updatedSpace = data[0];
            const index = this.projectSpaces.findIndex(s => s.id === spaceId);
            if (index !== -1) {
                this.projectSpaces[index] = updatedSpace;
            }
            this.logActivity('Space Updated', { spaceName: updatedSpace.space_name, spaceId: spaceId });
            this.updateSpacesTable();
            return updatedSpace;
        } catch (error) {
            console.error('Error updating space:', error);
            this.showError('Failed to update space');
            throw error;
        }
    }

    async deleteProjectSpace(spaceId) {
        try {
            const { error } = await this.supabase
                .from('project_spaces')
                .delete()
                .eq('id', spaceId);
            
            if (error) throw error;
            this.projectSpaces = this.projectSpaces.filter(s => s.id !== spaceId);
            this.logActivity('Space Deleted', { spaceId: spaceId });
            this.updateSpacesTable();
        } catch (error) {
            console.error('Error deleting space:', error);
            this.showError('Failed to delete space');
            throw error;
        }
    }

    // Activity Logging
    logActivity(action, details, user = 'Admin') {
        const activity = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action: action,
            user: user,
            details: details,
            status: 'completed'
        };
        this.activityLog.unshift(activity);
        
        // Keep only last 1000 activities
        if (this.activityLog.length > 1000) {
            this.activityLog = this.activityLog.slice(0, 1000);
        }
        
        localStorage.setItem('admin_activity_log', JSON.stringify(this.activityLog));
        this.updateActivityTable();
    }

    // Dashboard
    async updateDashboard() {
        try {
            // If dashboard UI is not present, exit safely
            const totalProjectsEl = document.getElementById('totalProjects');
            const activeProjectsEl = document.getElementById('activeProjects');
            const totalPhasesEl = document.getElementById('totalPhases');
            const totalSpacesEl = document.getElementById('totalSpaces');
            if (!totalProjectsEl || !activeProjectsEl || !totalPhasesEl || !totalSpacesEl) {
                return;
            }

            // Update project count
            const totalProjects = this.projects.length;
            const activeProjects = this.projects.filter(p => p.status === 'active').length;
            
            totalProjectsEl.textContent = totalProjects;
            activeProjectsEl.textContent = activeProjects;
            
            // Update total phases count
            let totalPhases = 0;
            for (const project of this.projects) {
                const { data: phases } = await this.supabase
                    .from('project_phases')
                    .select('id')
                    .eq('project_id', project.id);
                totalPhases += phases ? phases.length : 0;
            }
            totalPhasesEl.textContent = totalPhases;
            
            // Update total spaces count
            let totalSpaces = 0;
            for (const project of this.projects) {
                const { data: spaces } = await this.supabase
                    .from('project_spaces')
                    .select('id')
                    .eq('project_id', project.id);
                totalSpaces += spaces ? spaces.length : 0;
            }
            totalSpacesEl.textContent = totalSpaces;
            
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }

    // UI Updates
    updateProjectsTable() {
        const tbody = document.querySelector('#projectsTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.projects.forEach(project => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${project.name}</td>
                <td>${project.coordinates ? `${project.coordinates[0]}, ${project.coordinates[1]}` : 'N/A'}</td>
                <td>${project.zoom_level}</td>
                <td><span class="status-badge ${project.status}">${project.status}</span></td>
                <td>${new Date(project.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="adminPanel.selectProject(${project.id})">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="adminPanel.editProject(${project.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-info" onclick="adminPanel.manageProjectPhases(${project.id})">
                        <i class="fas fa-list"></i> Phases
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.confirmDeleteProject(${project.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updatePhasesTable() {
        const tbody = document.querySelector('#phasesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.projectPhases.forEach(phase => {
            const project = this.projects.find(p => p.id === phase.project_id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${phase.name}</td>
                <td>${project ? project.name : 'Unknown Project'}</td>
                <td>${phase.phase_order}</td>
                <td>${phase.description || 'N/A'}</td>
                <td><span class="status-badge ${phase.status}">${phase.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="adminPanel.editPhase(${phase.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.deletePhase(${phase.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updateSpacesTable() {
        const tbody = document.querySelector('#spacesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.projectSpaces.forEach(space => {
            const project = this.projects.find(p => p.id === space.project_id);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${space.space_name}</td>
                <td>${project ? project.name : 'Unknown Project'}</td>
                <td>${space.space_category}</td>
                <td>${space.trade || 'N/A'}</td>
                <td>${space.description || 'N/A'}</td>
                <td><span class="status-badge ${space.status}">${space.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="adminPanel.editSpace(${space.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.deleteSpace(${space.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Project Phase Management
    async manageProjectPhases(projectId) {
        console.log('🔧 Managing phases for project:', projectId);
        
        const project = this.projects.find(p => p.id === projectId);
        if (!project) {
            this.showError('Project not found');
            return;
        }

        // Load phases for this specific project
        await this.loadProjectPhases(projectId);
        console.log('🔧 projectPhases after loading:', this.projectPhases);
        
        const projectPhases = this.projectPhases.filter(phase => phase.project_id === projectId);
        console.log('🔧 Filtered project phases:', projectPhases);
        
        const container = document.getElementById('modalContainer');
        container.innerHTML = '';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.dataset.projectId = projectId; // Store project ID for drag and drop
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
        
        modal.innerHTML = `
            <div style="
                background: white !important;
                border-radius: 12px !important;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2) !important;
                max-width: 800px !important;
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">
                        Manage Phases - ${project.name}
                    </h3>
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
                    <div style="margin-bottom: 1.5rem !important;">
                        <button onclick="adminPanel.showAddPhaseModal(${projectId})" style="
                            padding: 0.75rem 1.5rem !important;
                            background: #3b82f6 !important;
                            color: white !important;
                            border: none !important;
                            border-radius: 6px !important;
                            font-weight: 500 !important;
                            cursor: pointer !important;
                        ">
                            <i class="fas fa-plus"></i> Add New Phase
                        </button>
                    </div>
                    <div id="projectPhasesList">
                        ${this.generateProjectPhasesHTML(projectPhases, project)}
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(modal);
    }

    generateProjectPhasesHTML(phases, project = null) {
        if (!phases || phases.length === 0) {
            return `
                <div style="
                    text-align: center !important;
                    padding: 2rem !important;
                    color: #64748b !important;
                    background: #f8fafc !important;
                    border-radius: 8px !important;
                    border: 2px dashed #cbd5e1 !important;
                ">
                    <i class="fas fa-list" style="font-size: 2rem !important; margin-bottom: 1rem !important; display: block !important;"></i>
                    <p style="margin: 0 !important;">No phases created yet</p>
                    <p style="margin: 0.5rem 0 0 0 !important; font-size: 0.9rem !important;">Click "Add New Phase" to get started</p>
                </div>
            `;
        }

        // Sort phases by order and ensure clean numbering
        const sortedPhases = [...phases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
        console.log('🔧 Sorted phases for display:', sortedPhases.map(p => ({ id: p.id, name: p.name, order: p.phase_order })));

        return `
            <div id="phasesList" style="display: grid !important; gap: 1rem !important;">
                ${this.generatePhaseItemsHTML(phases, project)}
            </div>
        `;
    }

    generatePhaseItemsHTML(phases, project = null) {
        console.log('🔧 generatePhaseItemsHTML called with:', phases?.length || 0, 'phases');
        console.log('🔧 Phase data:', phases?.map(p => ({ id: p.id, name: p.name, order: p.phase_order })));
        
        if (!phases || phases.length === 0) {
            return `
                <div style="
                    text-align: center !important;
                    padding: 2rem !important;
                    color: #64748b !important;
                    background: #f8fafc !important;
                    border-radius: 8px !important;
                    border: 2px dashed #cbd5e1 !important;
                ">
                    <i class="fas fa-list" style="font-size: 2rem !important; margin-bottom: 1rem !important; display: block !important;"></i>
                    <p style="margin: 0 !important;">No phases created yet</p>
                    <p style="margin: 0.5rem 0 0 0 !important; font-size: 0.9rem !important;">Click "Add New Phase" to get started</p>
                </div>
            `;
        }

        // Sort phases by order and ensure clean numbering
        const sortedPhases = [...phases].sort((a, b) => (a.phase_order || 0) - (b.phase_order || 0));
        console.log('🔧 Sorted phases for display:', sortedPhases.map(p => ({ id: p.id, name: p.name, order: p.phase_order })));

        return sortedPhases.map((phase, index) => `
                    <div 
                        class="phase-item" 
                        data-phase-id="${phase.id}" 
                        data-phase-order="${phase.phase_order || index + 1}"
                        draggable="true"
                        style="
                            border: 1px solid #e2e8f0 !important;
                            border-radius: 8px !important;
                            padding: 1rem !important;
                            background: white !important;
                            cursor: move !important;
                            transition: all 0.2s ease !important;
                            position: relative !important;
                        "
                        onmouseover="this.style.borderColor='#3b82f6'"
                        onmouseout="this.style.borderColor='#e2e8f0'"
                        ondragstart="adminPanel.handleDragStart(event, ${phase.id})"
                        ondragover="adminPanel.handleDragOver(event)"
                        ondrop="adminPanel.handleDrop(event, ${phase.id})"
                        ondragenter="adminPanel.handleDragEnter(event)"
                        ondragleave="adminPanel.handleDragLeave(event)"
                    >
                        <!-- Drag Handle -->
                        <div style="
                            position: absolute !important;
                            top: 0.5rem !important;
                            left: 0.5rem !important;
                            color: #94a3b8 !important;
                            font-size: 1.2rem !important;
                            cursor: move !important;
                        ">
                            <i class="fas fa-grip-vertical"></i>
                        </div>
                        
                        <div style="display: flex !important; justify-content: space-between !important; align-items: flex-start !important; margin-left: 2rem !important;">
                            <div style="flex: 1 !important;">
                                <h4 style="margin: 0 0 0.5rem 0 !important; color: #1e293b !important; font-size: 1.1rem !important;">
                                    ${phase.name}
                                </h4>
                                <p style="margin: 0 0 0.5rem 0 !important; color: #64748b !important; font-size: 0.9rem !important;">
                                    ${phase.description || 'No description'}
                                </p>
                                <p style="margin: 0 0 0.5rem 0 !important; color: #059669 !important; font-size: 0.8rem !important; font-weight: 500 !important;">
                                    <i class="fas fa-project-diagram"></i> Project: ${project ? project.name : `ID ${phase.project_id}`}
                                </p>
                                <div style="display: flex !important; gap: 1rem !important; align-items: center !important;">
                                    <span style="
                                        background: #e0f2fe !important;
                                        color: #0369a1 !important;
                                        padding: 0.25rem 0.5rem !important;
                                        border-radius: 4px !important;
                                        font-size: 0.8rem !important;
                                        font-weight: 500 !important;
                                    ">Order: ${phase.phase_order}</span>
                                    <span class="status-badge ${phase.status}" style="
                                        padding: 0.25rem 0.5rem !important;
                                        border-radius: 4px !important;
                                        font-size: 0.8rem !important;
                                        font-weight: 500 !important;
                                    ">${phase.status}</span>
                                </div>
                            </div>
                            <div style="display: flex !important; gap: 0.5rem !important;">
                                <button onclick="adminPanel.editProjectPhase(${phase.id})" style="
                                    padding: 0.5rem !important;
                                    background: #f1f5f9 !important;
                                    color: #475569 !important;
                                    border: none !important;
                                    border-radius: 4px !important;
                                    cursor: pointer !important;
                                    font-size: 0.9rem !important;
                                ">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="adminPanel.confirmDeleteProjectPhase(${phase.id})" style="
                                    padding: 0.5rem !important;
                                    background: #fef2f2 !important;
                                    color: #dc2626 !important;
                                    border: none !important;
                                    border-radius: 4px !important;
                                    cursor: pointer !important;
                                    font-size: 0.9rem !important;
                                ">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
    }

    updateActivityTable() {
        const tbody = document.querySelector('#activityTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.activityLog.slice(0, 50).forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(activity.timestamp).toLocaleString()}</td>
                <td>${activity.user}</td>
                <td>${activity.action}</td>
                <td>${JSON.stringify(activity.details)}</td>
                <td><span class="status-badge ${activity.status}">${activity.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    // Project Selection
    async selectProject(projectId) {
        this.currentProject = this.projects.find(p => p.id === projectId);
        if (this.currentProject) {
            await this.loadProjectPhases(projectId);
            await this.loadProjectSpaces(projectId);
            this.updatePhasesTable();
            this.updateSpacesTable();
            this.updateDashboard();
            
            // Switch to phases tab
            this.switchTab('phases');
        }
    }

    // Tab Management
    switchTab(tabName) {
        // Remove active class from all tabs and buttons
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        
        // Add active class to selected tab and button
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    }

    // Error Handling
    showError(message) {
        console.error(message);
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        console.log(message);
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Event Listeners
    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Tab switching
        const navBtns = document.querySelectorAll('.nav-btn');
        console.log('🔧 Found nav buttons:', navBtns.length);
        
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('🔧 Nav button clicked:', e.target.dataset.tab);
                if (e.target.dataset.tab) {
                    this.switchTab(e.target.dataset.tab);
                }
            });
        });

        // Add project button
        const addProjectBtn = document.getElementById('addProjectBtn');
        console.log('🔧 Add project button found:', !!addProjectBtn);
        if (addProjectBtn) {
            addProjectBtn.addEventListener('click', () => {
                console.log('🔧 Add project button clicked!');
                this.showAddProjectModal();
            });
        } else {
            console.error('❌ Add project button not found!');
        }

        // Add category button
        const addCategoryBtn = document.getElementById('addCategoryBtn');
        console.log('🔧 Add category button found:', !!addCategoryBtn);
        if (addCategoryBtn) {
            addCategoryBtn.addEventListener('click', () => {
                console.log('🔧 Add category button clicked!');
                this.showAddCategoryModal();
            });
        } else {
            console.error('❌ Add category button not found!');
        }

        // Add company button
        const addCompanyBtn = document.getElementById('addCompanyBtn');
        console.log('🔧 Add company button found:', !!addCompanyBtn);
        if (addCompanyBtn) {
            addCompanyBtn.addEventListener('click', () => {
                console.log('🔧 Add company button clicked!');
                this.showAddCompanyModal();
            });
        } else {
            console.error('❌ Add company button not found!');
        }



        // Add space button
        const addSpaceBtn = document.getElementById('addSpaceBtn');
        if (addSpaceBtn) {
            addSpaceBtn.addEventListener('click', () => this.showAddSpaceModal());
        }
    }

    // Modal Functions
    showAddProjectModal() {
        console.log('🔧 Creating project modal...');
        
        const container = document.getElementById('modalContainer');
        console.log('🔧 Modal container found:', container);
        
        // Clear any existing modals
        container.innerHTML = '';
        
        // Create the real modal with the same working structure as the test
        const modal = document.createElement('div');
        modal.className = 'modal-overlay'; // Add the class for form handlers
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Add New Project</h3>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
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
                    ${this.getProjectFormHTML()}
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        console.log('🔧 Project modal added');
        
        // Setup form handlers
        this.setupProjectFormHandlers();
        console.log('🔧 Form handlers setup complete');
    }

    showAddPhaseModal(projectId = null, phase = null) {
        console.log('🔧 Creating phase modal for project:', projectId, 'phase:', phase);
        
        const container = document.getElementById('modalContainer');
        container.innerHTML = '';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay'; // Add the class for form handlers
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Add New Phase</h3>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
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
                    ${this.getPhaseFormHTML(null, projectId)}
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        this.setupPhaseFormHandlers(phase ? phase.id : null);
    }

    showAddSpaceModal() {
        console.log('🔧 Creating space modal...');
        
        const container = document.getElementById('modalContainer');
        container.innerHTML = '';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay'; // Add the class for form handlers
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Add New Space</h3>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
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
                    ${this.getSpaceFormHTML()}
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        this.setupSpaceFormHandlers();
    }

    createModal(title, content) {
        console.log('🔧 Creating modal with title:', title);
        console.log('🔧 Modal content length:', content.length);
        console.log('🔧 Modal content preview:', content.substring(0, 100) + '...');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        // Add inline styles to ensure modal is visible
        modal.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.5) !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            z-index: 999999 !important;
        `;
        
        modal.innerHTML = `
            <div class="modal" style="
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
            ">
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                ">
                    <h3 style="margin: 0; color: #1e293b; font-size: 1.25rem;">${title}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        color: #64748b;
                        cursor: pointer;
                        padding: 0;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        transition: all 0.2s;
                    ">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem;">
                    ${content}
                </div>
            </div>
        `;
        
        console.log('🔧 Modal HTML created, length:', modal.innerHTML.length);
        console.log('🔧 Modal element:', modal);
        console.log('🔧 Modal styles applied:', modal.style.cssText);
        
        return modal;
    }

    getProjectFormHTML(project = null) {
        const isEdit = project !== null;
        return `
            <form id="projectForm">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="projectName" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Project Name *</label>
                    <input type="text" id="projectName" name="name" value="${project ? project.name : ''}" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                </div>

                <div class="form-group" style="margin-bottom: 0.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Find Location</label>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <input type="text" id="projectSearchQuery" placeholder="Search address or place" style="flex: 1; padding: 0.6rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                        <button type="button" class="btn btn-secondary" id="projectSearchBtn"><i class="fas fa-search"></i> Find</button>
                        <button type="button" class="btn btn-secondary" id="projectUseCenterBtn" title="Use map center"><i class="fas fa-crosshairs"></i></button>
                    </div>
                    <div id="projectSearchResults" style="display:none; background: white; border: 1px solid #e5e7eb; border-radius: 6px; margin-top: 0.5rem; max-height: 220px; overflow-y: auto; box-shadow: 0 6px 16px rgba(0,0,0,0.08);"></div>
                    <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.25rem; display: block;">Search or click the map to set coordinates</small>
                </div>

                <div id="projectMap" style="height: 320px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 1rem;"></div>

                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="projectCoordinates" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Coordinates (lat, lng) *</label>
                    <input type="text" id="projectCoordinates" placeholder="45.55892367527075, -122.93169330055501" value="${project ? (project.coordinates ? `${project.coordinates[0]}, ${project.coordinates[1]}` : '') : ''}" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                    <small style="color: #64748b; font-size: 0.8rem; margin-top: 0.25rem; display: block;">Paste or set via map/search</small>
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="projectLatitude" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Latitude (auto-filled)</label>
                    <input type="number" id="projectLatitude" name="latitude" step="0.0000001" value="${project ? (project.coordinates ? project.coordinates[0] : '') : ''}" readonly style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem; background: #f8fafc; color: #64748b;">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="projectLongitude" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Longitude (auto-filled)</label>
                    <input type="number" id="projectLongitude" name="longitude" step="0.0000001" value="${project ? (project.coordinates ? project.coordinates[1] : '') : ''}" readonly style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem; background: #f8fafc; color: #64748b;">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="projectZoom" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Zoom Level</label>
                    <input type="number" id="projectZoom" name="zoom_level" value="${project ? project.zoom_level : 16}" min="1" max="22" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="projectDescription" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Description</label>
                    <textarea id="projectDescription" name="description" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">${project ? project.description || '' : ''}</textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; background: #f1f5f9; color: #64748b;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; background: #3b82f6; color: white;">${isEdit ? 'Update Project' : 'Add Project'}</button>
                </div>
            </form>
        `;
    }

    getEditPhaseFormHTML(project, phase) {
        console.log('🔧 getEditPhaseFormHTML called with project:', project.name, 'phase:', phase.name);
        
        return `
            <form id="editPhaseForm">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Project</label>
                    <div style="
                        padding: 0.75rem; 
                        background: #f8fafc; 
                        border: 1px solid #e2e8f0; 
                        border-radius: 6px; 
                        font-size: 0.9rem;
                        color: #64748b;
                    ">${project.name}</div>
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="editPhaseName" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Phase Name *</label>
                    <input type="text" id="editPhaseName" name="name" value="${phase.name}" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="editPhaseDescription" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Description</label>
                    <textarea id="editPhaseDescription" name="description" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">${phase.description || ''}</textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; background: #f1f5f9; color: #64748b;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; background: #3b82f6; color: white;">Update Phase</button>
                </div>
            </form>
        `;
    }

    getPhaseFormHTML(phase = null, projectId = null) {
        console.log('🔧 getPhaseFormHTML called with phase:', phase, 'projectId:', projectId);
        const isEdit = phase !== null;
        const selectedProjectId = projectId || (phase ? phase.project_id : null);
        console.log('🔧 isEdit:', isEdit, 'selectedProjectId:', selectedProjectId);
        
        return `
            <form id="phaseForm">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="phaseProject" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Project *</label>
                    <select id="phaseProject" name="project_id" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                        <option value="">Select a project</option>
                        ${this.projects.map(p => `<option value="${p.id}" ${selectedProjectId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="phaseName" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Phase Name *</label>
                    <input type="text" id="phaseName" name="name" value="${phase ? phase.name : ''}" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="phaseOrder" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Phase Order</label>
                    <input type="number" id="phaseOrder" name="phase_order" value="${phase ? phase.phase_order : 1}" min="1" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="phaseDescription" style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151;">Description</label>
                    <textarea id="phaseDescription" name="description" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem;">${phase ? phase.description || '' : ''}</textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; background: #f1f5f9; color: #64748b;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; background: #3b82f6; color: white;">${isEdit ? 'Update Phase' : 'Add Phase'}</button>
                </div>
            </form>
        `;
    }

    setupEditPhaseFormHandlers(phaseId) {
        console.log('🔧 Setting up edit phase form handlers for phase:', phaseId);
        
        const form = document.getElementById('editPhaseForm');
        if (!form) {
            console.error('❌ Edit phase form not found');
            return;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔧 Edit phase form submitted');

            const submitButton = form.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            
            // Disable button and show loading state
            submitButton.disabled = true;
            submitButton.textContent = 'Updating...';

            try {
                const formData = new FormData(form);
                const phaseData = {
                    name: formData.get('name'),
                    description: formData.get('description') || ''
                };

                console.log('🔧 Updating phase with data:', phaseData);

                await this.updateProjectPhase(phaseId, phaseData);
                
                this.showSuccess('Phase updated successfully!');
                
                // Close modal
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    modal.remove();
                }
                
                // Refresh the phase management modal if it's open
                // This will be handled by the parent modal refresh
                
            } catch (error) {
                console.error('❌ Error updating phase:', error);
                this.showError('Failed to update phase. Please try again.');
            } finally {
                // Re-enable button
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            }
        });
    }

    setupPhaseFormHandlers(phaseId = null) {
        const form = document.getElementById('phaseForm');
        if (form) {
            // Remove any existing event listeners to prevent duplicates
            form.removeEventListener('submit', this.handlePhaseSubmit);
            
            // Create a bound handler
            this.handlePhaseSubmit = async (e) => {
            e.preventDefault();
                
                // Prevent multiple submissions
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn.disabled) return;
                
                submitBtn.disabled = true;
                submitBtn.textContent = phaseId ? 'Updating...' : 'Creating...';
                
                try {
                    const formData = new FormData(form);
                    const phaseData = Object.fromEntries(formData.entries());
                    
                    console.log('🔧 Submitting phase data:', phaseData);
                    
                    if (phaseId) {
                        await this.updateProjectPhase(phaseId, phaseData);
                        this.showSuccess('Phase updated successfully!');
                    } else {
                        await this.createProjectPhase(phaseData);
                        this.showSuccess('Phase created successfully!');
                    }
                    
                    // Close modal
                    const modal = form.closest('.modal-overlay');
                    if (modal) {
                        modal.remove();
                    }
                } catch (error) {
                    console.error('❌ Phase submission error:', error);
                    this.showError(`Failed to ${phaseId ? 'update' : 'create'} phase: ` + error.message);
                } finally {
                    // Re-enable button
                    submitBtn.disabled = false;
                    submitBtn.textContent = phaseId ? 'Update Phase' : 'Add Phase';
                }
            };
            
            form.addEventListener('submit', this.handlePhaseSubmit);
        }
    }

    getSpaceFormHTML(space = null) {
        const isEdit = space !== null;
        const categories = ['office', 'storage', 'meeting', 'workshop', 'parking', 'other'];
        return `
            <form id="spaceForm">
                <div class="form-group">
                    <label for="spaceProject">Project *</label>
                    <select id="spaceProject" name="project_id" required>
                        <option value="">Select a project</option>
                        ${this.projects.map(p => `<option value="${p.id}" ${space && space.project_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="spaceName">Space Name *</label>
                    <input type="text" id="spaceName" name="space_name" value="${space ? space.space_name : ''}" required>
                </div>
                <div class="form-group">
                    <label for="spaceCategory">Category *</label>
                    <select id="spaceCategory" name="space_category" required>
                        <option value="">Select category</option>
                        ${categories.map(cat => `<option value="${cat}" ${space && space.space_category === cat ? 'selected' : ''}>${cat.charAt(0).toUpperCase() + cat.slice(1)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="spaceTrade">Trade</label>
                    <input type="text" id="spaceTrade" name="trade" value="${space ? space.trade || '' : ''}" placeholder="e.g., Electrical, Plumbing, etc.">
                </div>
                <div class="form-group">
                    <label for="spaceDescription">Description</label>
                    <textarea id="spaceDescription" name="description" rows="3">${space ? space.description || '' : ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="spaceGeometry">Geometry (GeoJSON)</label>
                    <textarea id="spaceGeometry" name="geometry" rows="4" placeholder='{"type": "Polygon", "coordinates": [[[lng, lat], [lng, lat], ...]]}'>${space && space.geometry ? JSON.stringify(space.geometry, null, 2) : ''}</textarea>
                    <small>Enter the GeoJSON geometry for this space</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update Space' : 'Add Space'}</button>
                </div>
            </form>
        `;
    }

    setupProjectFormHandlers(projectId = null) {
        const form = document.getElementById('projectForm');
        if (form) {
            // Remove any existing event listeners to prevent duplicates
            form.removeEventListener('submit', this.handleProjectSubmit);
            
            // Create a bound handler
            this.handleProjectSubmit = async (e) => {
                e.preventDefault();
                
                // Prevent multiple submissions
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn.disabled) return;
                
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating...';
                
                try {
                    const formData = new FormData(form);
                    const projectData = Object.fromEntries(formData.entries());
                    
                    console.log('🔧 Submitting project data:', projectData);
                    
                    if (projectId) {
                        await this.updateProject(projectId, projectData);
                        this.showSuccess('Project updated successfully!');
        } else {
                        await this.createProject(projectData);
                        this.showSuccess('Project created successfully!');
                    }
                    
                    // Close modal
                    const modal = form.closest('.modal-overlay');
                    if (modal) {
                        modal.remove();
                    }
                } catch (error) {
                    console.error('❌ Project submission error:', error);
                    this.showError(`Failed to ${projectId ? 'update' : 'create'} project: ` + error.message);
                } finally {
                    // Re-enable button
                    submitBtn.disabled = false;
                    submitBtn.textContent = projectId ? 'Update Project' : 'Add Project';
                }
            };
            
            form.addEventListener('submit', this.handleProjectSubmit);
            
            // Add coordinate parsing functionality
            const coordinatesInput = document.getElementById('projectCoordinates');
            const latitudeInput = document.getElementById('projectLatitude');
            const longitudeInput = document.getElementById('projectLongitude');
            const zoomInput = document.getElementById('projectZoom');
            const mapEl = document.getElementById('projectMap');
            const searchInput = document.getElementById('projectSearchQuery');
            const searchBtn = document.getElementById('projectSearchBtn');
            const useCenterBtn = document.getElementById('projectUseCenterBtn');
            const resultsEl = document.getElementById('projectSearchResults');
            
            if (coordinatesInput && latitudeInput && longitudeInput) {
                coordinatesInput.addEventListener('input', (e) => {
                    this.parseCoordinates(e.target.value, latitudeInput, longitudeInput, coordinatesInput);
                    if (latitudeInput.value && longitudeInput.value) {
                        this._updateProjectMarker(parseFloat(latitudeInput.value), parseFloat(longitudeInput.value));
                        if (this._projectMap) this._projectMap.setView([parseFloat(latitudeInput.value), parseFloat(longitudeInput.value)], this._projectMap.getZoom());
                    }
                });
                
                coordinatesInput.addEventListener('paste', (e) => {
                    setTimeout(() => {
                        this.parseCoordinates(e.target.value, latitudeInput, longitudeInput, coordinatesInput);
                        if (latitudeInput.value && longitudeInput.value) {
                            this._updateProjectMarker(parseFloat(latitudeInput.value), parseFloat(longitudeInput.value));
                            if (this._projectMap) this._projectMap.setView([parseFloat(latitudeInput.value), parseFloat(longitudeInput.value)], this._projectMap.getZoom());
                        }
                    }, 10);
                });
            }

            // Initialize map picker
            if (mapEl) {
                this._initProjectMap(mapEl, latitudeInput, longitudeInput, coordinatesInput, zoomInput);
                if (searchBtn) {
                    searchBtn.addEventListener('click', () => {
                        if (searchInput && searchInput.value.trim()) {
                            this._geocodeProjectSearch(searchInput.value.trim(), latitudeInput, longitudeInput, coordinatesInput, zoomInput);
                        }
                    });
                }
                if (searchInput) {
                    // Debounced live suggestions with loading and caching
                    let debounceTimer = null;
                    let activeIdx = -1;
                    this._projectSearchResults = [];
                    this._projectSearchCache = this._projectSearchCache || new Map();

                    const performSuggest = async (q) => {
                        if (!resultsEl) return;
                        // Loading indicator
                        resultsEl.style.display = 'block';
                        resultsEl.innerHTML = '<div style="padding: 0.5rem 0.75rem; color:#6b7280; font-size:0.9rem;">Searching…</div>';

                        const bounds = this._projectMap ? this._projectMap.getBounds() : null;
                        const cacheKey = bounds ? `${q}|${bounds.getWest().toFixed(2)},${bounds.getNorth().toFixed(2)},${bounds.getEast().toFixed(2)},${bounds.getSouth().toFixed(2)}` : q;
                        if (this._projectSearchCache.has(cacheKey)) {
                            this._projectSearchResults = this._projectSearchCache.get(cacheKey);
                            activeIdx = -1;
                            this._renderProjectSearchResults(resultsEl, this._projectSearchResults, q, activeIdx, (item) => {
                                const lat = parseFloat(item.lat);
                                const lng = parseFloat(item.lon);
                                const zoom = 17;
                                if (this._projectMap) this._projectMap.setView([lat, lng], zoom);
                                if (latitudeInput) latitudeInput.value = lat.toFixed(7);
                                if (longitudeInput) longitudeInput.value = lng.toFixed(7);
                                if (coordinatesInput) coordinatesInput.value = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
                                if (zoomInput) zoomInput.value = zoom;
                                this._updateProjectMarker(lat, lng);
                                this._clearProjectSearchResults(resultsEl);
                            });
                            return;
                        }

                        const results = await this._searchProjectSuggestions(q, bounds);
                        this._projectSearchCache.set(cacheKey, results);
                        this._projectSearchResults = results;
                        activeIdx = -1;
                        this._renderProjectSearchResults(resultsEl, results, q, activeIdx, (item) => {
                            const lat = parseFloat(item.lat);
                            const lng = parseFloat(item.lon);
                            const zoom = 17;
                            if (this._projectMap) this._projectMap.setView([lat, lng], zoom);
                            if (latitudeInput) latitudeInput.value = lat.toFixed(7);
                            if (longitudeInput) longitudeInput.value = lng.toFixed(7);
                            if (coordinatesInput) coordinatesInput.value = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
                            if (zoomInput) zoomInput.value = zoom;
                            this._updateProjectMarker(lat, lng);
                            this._clearProjectSearchResults(resultsEl);
                        });
                    };

                    searchInput.addEventListener('input', () => {
                        if (!resultsEl) return;
                        const q = searchInput.value.trim();
                        if (debounceTimer) clearTimeout(debounceTimer);
                        if (q.length < 3) {
                            this._clearProjectSearchResults(resultsEl);
                            return;
                        }
                        debounceTimer = setTimeout(() => performSuggest(q), 200);
                    });

                    searchInput.addEventListener('keydown', (ev) => {
                        const results = this._projectSearchResults || [];
                        if (!resultsEl || results.length === 0 || resultsEl.style.display === 'none') return;
                        if (ev.key === 'ArrowDown') {
                            ev.preventDefault();
                            activeIdx = (activeIdx + 1) % results.length;
                            this._renderProjectSearchResults(resultsEl, results, searchInput.value.trim(), activeIdx, null);
                        } else if (ev.key === 'ArrowUp') {
                            ev.preventDefault();
                            activeIdx = activeIdx <= 0 ? results.length - 1 : activeIdx - 1;
                            this._renderProjectSearchResults(resultsEl, results, searchInput.value.trim(), activeIdx, null);
                        } else if (ev.key === 'Enter') {
                            if (activeIdx >= 0 && results[activeIdx]) {
                                ev.preventDefault();
                                const item = results[activeIdx];
                                const lat = parseFloat(item.lat);
                                const lng = parseFloat(item.lon);
                                const zoom = 17;
                                if (this._projectMap) this._projectMap.setView([lat, lng], zoom);
                                if (latitudeInput) latitudeInput.value = lat.toFixed(7);
                                if (longitudeInput) longitudeInput.value = lng.toFixed(7);
                                if (coordinatesInput) coordinatesInput.value = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
                                if (zoomInput) zoomInput.value = zoom;
                                this._updateProjectMarker(lat, lng);
                                this._clearProjectSearchResults(resultsEl);
                            }
                        } else if (ev.key === 'Escape') {
                            this._clearProjectSearchResults(resultsEl);
                        }
                    });
                }
                if (useCenterBtn) {
                    useCenterBtn.addEventListener('click', () => {
                        if (!this._projectMap) return;
                        const center = this._projectMap.getCenter();
                        const zoom = this._projectMap.getZoom();
                        latitudeInput.value = center.lat.toFixed(7);
                        longitudeInput.value = center.lng.toFixed(7);
                        if (coordinatesInput) coordinatesInput.value = `${center.lat.toFixed(7)}, ${center.lng.toFixed(7)}`;
                        if (zoomInput) zoomInput.value = zoom;
                        this._updateProjectMarker(center.lat, center.lng);
                    });
                }

                // Hide results when clicking outside
                document.addEventListener('click', (ev) => {
                    if (!resultsEl) return;
                    if (ev.target === resultsEl || (resultsEl.contains(ev.target))) return;
                    if (ev.target === searchInput) return;
                    this._clearProjectSearchResults(resultsEl);
                }, { capture: true });
            }
        }
    }

    parseCoordinates(coordinateString, latitudeInput, longitudeInput, coordinatesInput) {
        if (!coordinateString || !latitudeInput || !longitudeInput) return;
        
        // Remove extra whitespace and normalize the string
        const cleanString = coordinateString.trim();
        
        // Try to parse different coordinate formats
        let lat, lng;
        
        // Format 1: "45.55892367527075, -122.93169330055501" (comma separated)
        const commaMatch = cleanString.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
        if (commaMatch) {
            lat = parseFloat(commaMatch[1]);
            lng = parseFloat(commaMatch[2]);
        }
        
        // Format 2: "45.55892367527075 -122.93169330055501" (space separated)
        else {
            const spaceMatch = cleanString.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/);
            if (spaceMatch) {
                lat = parseFloat(spaceMatch[1]);
                lng = parseFloat(spaceMatch[2]);
            }
        }
        
        // Validate coordinates
        if (lat !== undefined && lng !== undefined && 
            !isNaN(lat) && !isNaN(lng) &&
            lat >= -90 && lat <= 90 && 
            lng >= -180 && lng <= 180) {
            
            // Update the individual fields
            latitudeInput.value = lat;
            longitudeInput.value = lng;
            
            // Visual feedback
            if (coordinatesInput) {
                coordinatesInput.style.borderColor = '#10b981'; // Green
                setTimeout(() => {
                    coordinatesInput.style.borderColor = '#d1d5db'; // Reset to default
                }, 1000);
            }
            
            console.log('✅ Coordinates parsed successfully:', { lat, lng });
        } else {
            // Invalid coordinates
            if (coordinatesInput) {
                coordinatesInput.style.borderColor = '#ef4444'; // Red
                setTimeout(() => {
                    coordinatesInput.style.borderColor = '#d1d5db'; // Reset to default
                }, 1000);
            }
            
            console.log('❌ Invalid coordinates format:', coordinateString);
        }
    }

    setupPhaseFormHandlers(phaseId = null) {
        const form = document.getElementById('phaseForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
            e.preventDefault();
                const formData = new FormData(form);
                const phaseData = Object.fromEntries(formData.entries());
                
                try {
                    if (phaseId) {
                        await this.updateProjectPhase(phaseId, phaseData);
                        this.showSuccess('Phase updated successfully!');
                    } else {
                        await this.createProjectPhase(phaseData);
                        this.showSuccess('Phase created successfully!');
                    }
                    form.closest('.modal-overlay').remove();
                } catch (error) {
                    this.showError(`Failed to ${phaseId ? 'update' : 'create'} phase: ` + error.message);
                }
            });
        }
    }

    setupSpaceFormHandlers(spaceId = null) {
        const form = document.getElementById('spaceForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
            e.preventDefault();
                const formData = new FormData(form);
                const spaceData = Object.fromEntries(formData.entries());
                
                // Parse geometry if provided
                if (spaceData.geometry) {
                    try {
                        spaceData.geometry = JSON.parse(spaceData.geometry);
                    } catch (error) {
                        this.showError('Invalid GeoJSON geometry format');
                        return;
                    }
                }
                
                try {
                    if (spaceId) {
                        await this.updateProjectSpace(spaceId, spaceData);
                        this.showSuccess('Space updated successfully!');
                    } else {
                        await this.createProjectSpace(spaceData);
                        this.showSuccess('Space created successfully!');
                    }
                    form.closest('.modal-overlay').remove();
                } catch (error) {
                    this.showError(`Failed to ${spaceId ? 'update' : 'create'} space: ` + error.message);
                }
            });
        }
    }

    // Project Selection
    selectProject(id) {
        const project = this.projects.find(p => p.id === id);
        if (project) {
            this.currentProject = project;
            this.loadProjectPhases(id);
            this.loadProjectSpaces(id);
            this.updatePhasesTable();
            this.updateSpacesTable();
            this.updateDashboard();
            this.showSuccess(`Selected project: ${project.name}`);
        }
    }

    // Edit/Delete Functions
    editProject(id) {
        console.log('🔧 Edit project called with ID:', id);
        const project = this.projects.find(p => p.id === id);
        console.log('🔧 Found project:', project);
        if (!project) {
            console.error('❌ Project not found for ID:', id);
            return;
        }
        
        console.log('🔧 Creating edit project modal using direct approach');
        
        const container = document.getElementById('modalContainer');
        console.log('🔧 Modal container found:', container);
        
        // Clear any existing modals first
        container.innerHTML = '';
        console.log('🔧 Modal container cleared');
        
        // Create modal directly like the working phase modals
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Edit Project</h3>
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
                    ${this.getProjectFormHTML(project)}
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        console.log('🔧 Modal appended to container');
        
        // Debug: Check if modal is visible
        console.log('🔧 Modal display style:', modal.style.display);
        console.log('🔧 Modal visibility:', window.getComputedStyle(modal).visibility);
        console.log('🔧 Modal opacity:', window.getComputedStyle(modal).opacity);
        console.log('🔧 Modal z-index:', window.getComputedStyle(modal).zIndex);
        console.log('🔧 Modal position:', window.getComputedStyle(modal).position);
        
        this.setupProjectFormHandlers(id);
        console.log('🔧 Form handlers setup complete');
    }

    confirmDeleteProject(id) {
        if (confirm('Are you sure you want to delete this project?')) {
            this.deleteProject(id);
        }
    }

    editPhase(id) {
        const phase = this.projectPhases.find(p => p.id === id);
        if (!phase) return;
        
        const modal = this.createModal('Edit Phase', this.getPhaseFormHTML(phase));
        document.getElementById('modalContainer').appendChild(modal);
        this.setupPhaseFormHandlers(id);
    }

    deletePhase(id) {
        if (confirm('Are you sure you want to delete this phase?')) {
            this.deleteProjectPhase(id);
        }
    }

    editSpace(id) {
        const space = this.projectSpaces.find(s => s.id === id);
        if (!space) return;
        
        const modal = this.createModal('Edit Space', this.getSpaceFormHTML(space));
        document.getElementById('modalContainer').appendChild(modal);
        this.setupSpaceFormHandlers(id);
    }

    deleteSpace(id) {
        if (confirm('Are you sure you want to delete this space?')) {
            this.deleteProjectSpace(id);
        }
    }

    // Settings
    loadSettings() {
        // Load settings from localStorage
        this.settings = JSON.parse(localStorage.getItem('admin_settings')) || {};
    }

    saveSettings() {
        localStorage.setItem('admin_settings', JSON.stringify(this.settings));
    }

    // Categories Management
    async updateCategoriesTable() {
        const tbody = document.querySelector('#categoriesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        for (const category of this.spaceCategories) {
            // Get usage count for this category
            const usageCount = await this.getCategoryUsageCount(category.id);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="
                            width: 20px; 
                            height: 20px; 
                            background-color: ${category.color || '#3b82f6'}; 
                            border: 1px solid #e5e7eb; 
                            border-radius: 4px;
                        "></div>
                        ${category.name}
                    </div>
                </td>
                <td>${category.description || 'No description'}</td>
                <td><span class="usage-count ${usageCount === 0 ? 'zero' : usageCount > 5 ? 'high' : ''}">${usageCount}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="adminPanel.editCategory(${category.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.deleteCategory(${category.id})" ${usageCount > 0 ? 'disabled title="Cannot delete category in use"' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        }
    }

    async updateCompaniesTable() {
        const tbody = document.querySelector('#companiesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        for (const company of this.companies) {
            // Get usage count for this company
            const usageCount = await this.getCompanyUsageCount(company.id);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${company.name}</td>
                <td>${company.contact_person ? `${company.contact_person}<br><small>${company.contact_email || ''}</small>` : 'No contact info'}</td>
                <td><span class="usage-count ${usageCount === 0 ? 'zero' : usageCount > 5 ? 'high' : ''}">${usageCount}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="adminPanel.editCompany(${company.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminPanel.deleteCompany(${company.id})" ${usageCount > 0 ? 'disabled title="Cannot delete company in use"' : ''}>
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        }
    }

    async getCategoryUsageCount(categoryId) {
        try {
            const { data, error } = await this.supabase
                .from('project_spaces')
                .select('id', { count: 'exact' })
                .eq('category', categoryId)
                .eq('status', 'active');
            
            if (error) throw error;
            return data?.length || 0;
        } catch (error) {
            console.error('Error getting category usage count:', error);
            return 0;
        }
    }

    async getCompanyUsageCount(companyId) {
        try {
            const { data, error } = await this.supabase
                .from('project_spaces')
                .select('id', { count: 'exact' })
                .eq('trade', companyId)
                .eq('status', 'active');
            
            if (error) throw error;
            return data?.length || 0;
        } catch (error) {
            console.error('Error getting company usage count:', error);
            return 0;
        }
    }

    showAddCategoryModal() {
        console.log('🔧 Creating add category modal');
        
        const container = document.getElementById('modalContainer');
        console.log('🔧 Modal container found:', container);
        
        // Clear any existing modals
        container.innerHTML = '';
        
        // Create the modal using the same working pattern as project modal
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Add Space Category</h3>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
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
                    ">&times;</button>
                </div>
                <div style="padding: 1.5rem !important;">
                    ${this.getCategoryFormHTML()}
                </div>
            </div>
        `;
        
        // Append to container
        container.appendChild(modal);
        console.log('🔧 Modal appended to container');
        
        // Set up form submission
        const form = modal.querySelector('#categoryForm');
        if (form) {
            console.log('🔧 Form found, setting up event listener');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('🔧 Form submitted');
                await this.addCategory(modal);
            });
        } else {
            console.error('❌ Form not found in modal!');
        }
    }

    showAddCompanyModal() {
        console.log('🔧 Creating add company modal');
        
        const container = document.getElementById('modalContainer');
        console.log('🔧 Modal container found:', container);
        
        // Clear any existing modals
        container.innerHTML = '';
        
        // Create the modal using the same working pattern as project modal
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Add Company/Contractor</h3>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
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
                    ">&times;</button>
                </div>
                <div style="padding: 1.5rem !important;">
                    ${this.getCompanyFormHTML()}
                </div>
            </div>
        `;
        
        // Append to container
        container.appendChild(modal);
        console.log('🔧 Modal appended to container');
        
        // Set up form submission
        const form = modal.querySelector('#companyForm');
        if (form) {
            console.log('🔧 Form found, setting up event listener');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('🔧 Form submitted');
                await this.addCompany(modal);
            });
        } else {
            console.error('❌ Form not found in modal!');
        }
    }

    getCategoryFormHTML(category = null) {
        const isEdit = category !== null;
        const defaultColor = category?.color || '#3b82f6'; // Default blue color
        return `
            <form id="categoryForm">
                <div class="form-group">
                    <label for="categoryName">Category Name *</label>
                    <input type="text" id="categoryName" name="name" value="${category?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="categoryDescription">Description</label>
                    <textarea id="categoryDescription" name="description" rows="3">${category?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="categoryColor">Display Color *</label>
                    <div class="color-picker-container">
                        <input type="color" id="categoryColor" name="color" value="${defaultColor}" 
                               style="width: 60px; height: 40px; border: none; border-radius: 4px; cursor: pointer;">
                        <input type="text" id="categoryColorText" value="${defaultColor}" 
                               placeholder="#3b82f6" style="margin-left: 10px; width: 100px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                        <div class="color-preview" style="
                            display: inline-block; 
                            width: 30px; 
                            height: 30px; 
                            background-color: ${defaultColor}; 
                            border: 2px solid #e5e7eb; 
                            border-radius: 4px; 
                            margin-left: 10px; 
                            vertical-align: middle;
                        "></div>
                    </div>
                    <small class="form-help">Choose a color to represent this category on the map</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Category</button>
                </div>
            </form>
        `;
    }

    getCompanyFormHTML(company = null) {
        const isEdit = company !== null;
        return `
            <form id="companyForm">
                <div class="form-group">
                    <label for="companyName">Company Name *</label>
                    <input type="text" id="companyName" name="name" value="${company?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label for="contactPerson">Contact Person</label>
                    <input type="text" id="contactPerson" name="contact_person" value="${company?.contact_person || ''}">
                </div>
                <div class="form-group">
                    <label for="contactEmail">Contact Email</label>
                    <input type="email" id="contactEmail" name="contact_email" value="${company?.contact_email || ''}">
                </div>
                <div class="form-group">
                    <label for="contactPhone">Contact Phone</label>
                    <input type="tel" id="contactPhone" name="contact_phone" value="${company?.contact_phone || ''}">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Company</button>
                </div>
            </form>
        `;
    }

    async editCategory(categoryId) {
        const category = this.spaceCategories.find(c => c.id === categoryId);
        if (!category) return;

        console.log('🔧 Creating edit category modal for:', category);
        
        const container = document.getElementById('modalContainer');
        console.log('🔧 Modal container found:', container);
        
        // Clear any existing modals first
        container.innerHTML = '';
        console.log('🔧 Modal container cleared');
        
        // Create modal directly like the working project modals
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
                    <h3 style="margin: 0 !important; color: #1e293b !important; font-size: 1.25rem !important;">Edit Space Category</h3>
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
                    ${this.getCategoryFormHTML(category)}
                </div>
            </div>
        `;
        
        container.appendChild(modal);
        console.log('🔧 Modal appended to container');
        
        // Set up form handlers after modal creation
        this.setupCategoryFormHandlers(categoryId);
        console.log('🔧 Form handlers setup complete');
    }

    setupCategoryFormHandlers(categoryId = null) {
        const form = document.getElementById('categoryForm');
        if (form) {
            // Remove any existing event listeners to prevent duplicates
            form.removeEventListener('submit', this.handleCategorySubmit);
            
            // Set up color picker synchronization
            this.setupColorPickerSync();
            
            // Create a bound handler
            this.handleCategorySubmit = async (e) => {
                e.preventDefault();
                
                // Prevent multiple submissions
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn.disabled) return;
                
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
                
                try {
                    const formData = new FormData(form);
                    const categoryData = Object.fromEntries(formData.entries());
                    
                    console.log('🔧 Submitting category data:', categoryData);
                    
                    if (categoryId) {
                        await this.updateCategory(categoryId, form.closest('.modal-overlay'));
                        this.showSuccess('Category updated successfully!');
                    } else {
                        await this.addCategory(categoryData);
                        this.showSuccess('Category created successfully!');
                    }
                    
                    // Close modal
                    const modal = form.closest('.modal-overlay');
                    if (modal) {
                        modal.remove();
                    }
                    
                    // Refresh the categories table
                    await this.updateCategoriesTable();
                } catch (error) {
                    console.error('❌ Category submission error:', error);
                    this.showError(`Failed to ${categoryId ? 'update' : 'create'} category: ` + error.message);
                } finally {
                    // Re-enable button
                    submitBtn.disabled = false;
                    submitBtn.textContent = categoryId ? 'Update Category' : 'Add Category';
                }
            };
            
            form.addEventListener('submit', this.handleCategorySubmit);
        }
    }

    setupColorPickerSync() {
        const colorPicker = document.getElementById('categoryColor');
        const colorText = document.getElementById('categoryColorText');
        const colorPreview = document.querySelector('.color-preview');
        
        if (colorPicker && colorText && colorPreview) {
            // Sync color picker to text input and preview
            colorPicker.addEventListener('input', (e) => {
                const color = e.target.value;
                colorText.value = color;
                colorPreview.style.backgroundColor = color;
            });
            
            // Sync text input to color picker and preview
            colorText.addEventListener('input', (e) => {
                const color = e.target.value;
                if (this.isValidHexColor(color)) {
                    colorPicker.value = color;
                    colorPreview.style.backgroundColor = color;
                }
            });
            
            // Validate hex color format
            colorText.addEventListener('blur', (e) => {
                const color = e.target.value;
                if (color && !this.isValidHexColor(color)) {
                    e.target.value = '#3b82f6'; // Reset to default
                    colorPicker.value = '#3b82f6';
                    colorPreview.style.backgroundColor = '#3b82f6';
                }
            });
        }
    }

    isValidHexColor(hex) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
    }

    async editCompany(companyId) {
        const company = this.companies.find(c => c.id === companyId);
        if (!company) return;

        console.log('🔧 Creating edit company modal for:', company);
        
        // Create modal HTML directly with inline styles
        const modalHTML = `
            <div class="modal-overlay" style="position: fixed !important; top: 0px !important; left: 0px !important; width: 100% !important; height: 100% !important; background: rgba(0, 0, 0, 0.5) !important; display: flex !important; justify-content: center !important; align-items: center !important; z-index: 999999 !important;">
                <div class="modal" style="background: white !important; border-radius: 12px !important; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2) !important; max-width: 500px !important; width: 90% !important; max-height: 90vh !important; overflow-y: auto !important;">
                    <div class="modal-header" style="display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 1.5rem !important; border-bottom: 1px solid #e2e8f0 !important;">
                        <h3 style="margin: 0 !important; font-size: 1.25rem !important; font-weight: 600 !important; color: #1f2937 !important;">Edit Company/Contractor</h3>
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" style="background: none !important; border: none !important; font-size: 1.5rem !important; cursor: pointer !important; color: #6b7280 !important; padding: 0 !important; width: 30px !important; height: 30px !important; display: flex !important; align-items: center !important; justify-content: center !important;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem !important;">
                        ${this.getCompanyFormHTML(company)}
                    </div>
                </div>
            </div>
        `;
        
        // Clear modal container and add new modal
        const modalContainer = document.getElementById('modalContainer');
        modalContainer.innerHTML = modalHTML;
        
        // Set up form submission
        const form = modalContainer.querySelector('#companyForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateCompany(companyId, modalContainer.querySelector('.modal-overlay'));
        });
    }

    async addCategory(modal) {
        try {
            const formData = new FormData(modal.querySelector('#categoryForm'));
            const categoryData = {
                name: formData.get('name'),
                description: formData.get('description') || null,
                color: formData.get('color') || '#3b82f6'
            };

            const { data, error } = await this.supabase
                .from('space_categories')
                .insert([categoryData])
                .select();

            if (error) throw error;

            this.spaceCategories.push(data[0]);
            this.updateCategoriesTable();
            modal.remove();
            this.showSuccess('Category added successfully!');
        } catch (error) {
            console.error('Error adding category:', error);
            this.showError('Failed to add category: ' + error.message);
        }
    }

    async addCompany(modal) {
        try {
            const formData = new FormData(modal.querySelector('#companyForm'));
            const companyData = {
                name: formData.get('name'),
                contact_person: formData.get('contact_person') || null,
                contact_email: formData.get('contact_email') || null,
                contact_phone: formData.get('contact_phone') || null
            };

            const { data, error } = await this.supabase
                .from('companies')
                .insert([companyData])
                .select();

            if (error) throw error;

            this.companies.push(data[0]);
            this.updateCompaniesTable();
            modal.remove();
            this.showSuccess('Company added successfully!');
        } catch (error) {
            console.error('Error adding company:', error);
            this.showError('Failed to add company: ' + error.message);
        }
    }

    async updateCategory(categoryId, modal) {
        try {
            const formData = new FormData(modal.querySelector('#categoryForm'));
            const categoryData = {
                name: formData.get('name'),
                description: formData.get('description') || null,
                color: formData.get('color') || '#3b82f6'
            };

            const { data, error } = await this.supabase
                .from('space_categories')
                .update(categoryData)
                .eq('id', categoryId)
                .select();

            if (error) throw error;

            const index = this.spaceCategories.findIndex(c => c.id === categoryId);
            if (index !== -1) {
                this.spaceCategories[index] = data[0];
            }
            this.updateCategoriesTable();
            modal.remove();
            this.showSuccess('Category updated successfully!');
        } catch (error) {
            console.error('Error updating category:', error);
            this.showError('Failed to update category: ' + error.message);
        }
    }

    async updateCompany(companyId, modal) {
        try {
            const formData = new FormData(modal.querySelector('#companyForm'));
            const companyData = {
                name: formData.get('name'),
                contact_person: formData.get('contact_person') || null,
                contact_email: formData.get('contact_email') || null,
                contact_phone: formData.get('contact_phone') || null
            };

            const { data, error } = await this.supabase
                .from('companies')
                .update(companyData)
                .eq('id', companyId)
                .select();

            if (error) throw error;

            const index = this.companies.findIndex(c => c.id === companyId);
            if (index !== -1) {
                this.companies[index] = data[0];
            }
            this.updateCompaniesTable();
            modal.remove();
            this.showSuccess('Company updated successfully!');
        } catch (error) {
            console.error('Error updating company:', error);
            this.showError('Failed to update company: ' + error.message);
        }
    }

    async deleteCategory(categoryId) {
        const category = this.spaceCategories.find(c => c.id === categoryId);
        if (!category) return;

        if (!confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
            return;
        }

        try {
            const { error } = await this.supabase
                .from('space_categories')
                .update({ is_active: false })
                .eq('id', categoryId);

            if (error) throw error;

            this.spaceCategories = this.spaceCategories.filter(c => c.id !== categoryId);
            this.updateCategoriesTable();
            this.showSuccess('Category deleted successfully!');
        } catch (error) {
            console.error('Error deleting category:', error);
            this.showError('Failed to delete category: ' + error.message);
        }
    }

    async deleteCompany(companyId) {
        const company = this.companies.find(c => c.id === companyId);
        if (!company) return;

        if (!confirm(`Are you sure you want to delete the company "${company.name}"?`)) {
            return;
        }

        try {
            const { error } = await this.supabase
                .from('companies')
                .update({ is_active: false })
                .eq('id', companyId);

            if (error) throw error;

            this.companies = this.companies.filter(c => c.id !== companyId);
            this.updateCompaniesTable();
            this.showSuccess('Company deleted successfully!');
        } catch (error) {
            console.error('Error deleting company:', error);
            this.showError('Failed to delete company: ' + error.message);
        }
    }

    // Loading Animation Functions
    showLoadingAnimation() {
        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(255, 255, 255, 0.95) !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            z-index: 10000 !important;
        `;
        
        loadingOverlay.innerHTML = `
            <div class="loading-container">
                <div class="brick-wall" id="brickWall"></div>
                <div class="loading-text">
                    Building your admin panel<span class="loading-dots"></span>
                </div>
            </div>
        `;
        
        document.body.appendChild(loadingOverlay);
        
        // Start brick stacking animation
        this.startBrickAnimation();
    }

    hideLoadingAnimation() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }

    startBrickAnimation() {
        const brickWall = document.getElementById('brickWall');
        if (!brickWall) return;

        // Canvas-based, rAF-driven brick animation with drop & pop
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

        const rows = 5, perRow = 4, bw = 40, bh = 20, rowOffset = bw/2, total = rows*perRow;
        const stepMs = 100;      // time between bricks starting
        const dropMs = 240;      // drop duration per brick
        const popMs = 120;       // small pop settle
        const resetDelay = 700;  // pause before restarting
        const easeOutCubic = t => (--t)*t*t + 1;

        let start = performance.now();
        function draw(now){
            const t = now - start;
            ctx.clearRect(0,0,canvas.width,canvas.height);
            for (let i=0;i<total;i++){
                const row = Math.floor(i/perRow), col = i%perRow;
                const x = col*bw + (row%2)*rowOffset;
                const y = row*bh;
                const begin = i*stepMs;
                const local = t - begin;
                if (local < 0) continue;

                let yy = y - 24;  // start higher for drop
                let scale = 1;
                if (local <= dropMs){
                    const p = easeOutCubic(local/dropMs);
                    yy = y - (1-p)*24;
                } else if (local <= dropMs + popMs){
                    const p = 1 - (local - dropMs)/popMs; // quick settle scale
                    scale = 1 + 0.06*p;
                }

                ctx.save();
                ctx.translate(Math.round(x)+bw/2, Math.round(yy)+bh/2);
                ctx.scale(scale, scale);
                ctx.translate(-bw/2, -bh/2);
                const grad = ctx.createLinearGradient(0,0,bw,bh);
                grad.addColorStop(0, '#1e40af');
                grad.addColorStop(1, '#3b82f6');
                ctx.fillStyle = grad;
                ctx.strokeStyle = '#172554';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.rect(1,1,bw-2,bh-2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fillRect(3,4,bw-6,3);
                ctx.restore();
            }
            if (t > total*stepMs + dropMs + resetDelay) start = now;
            requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
    }

    _initProjectMap(mapEl, latitudeInput, longitudeInput, coordinatesInput, zoomInput) {
        try {
            const defaultCenter = [
                latitudeInput && latitudeInput.value ? parseFloat(latitudeInput.value) : 45.5442515697061,
                longitudeInput && longitudeInput.value ? parseFloat(longitudeInput.value) : -122.91389689455964
            ];
            const initialZoom = (zoomInput && parseInt(zoomInput.value)) || 16;

            this._projectMap = L.map(mapEl, {
                maxZoom: 22,
                minZoom: 3,
                renderer: L.canvas({ padding: 0.5 })
            }).setView(defaultCenter, initialZoom);

            // Base layers
            const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 22
            });
            const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '© Google Satellite',
                maxZoom: 22
            });
            const hybridLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                attribution: '© Google Hybrid',
                maxZoom: 22
            });

            // Add default base
            streetLayer.addTo(this._projectMap);

            // Layer control
            const baseLayers = {
                'Street': streetLayer,
                'Hybrid': hybridLayer,
                'Satellite': satelliteLayer
            };
            this._projectLayerControl = L.control.layers(baseLayers, null, { position: 'topright', collapsed: true });
            this._projectLayerControl.addTo(this._projectMap);

            if (latitudeInput && longitudeInput) {
                this._updateProjectMarker(parseFloat(latitudeInput.value) || defaultCenter[0], parseFloat(longitudeInput.value) || defaultCenter[1]);
            }

            this._projectMap.on('click', (e) => {
                const lat = e.latlng.lat;
                const lng = e.latlng.lng;
                if (latitudeInput) latitudeInput.value = lat.toFixed(7);
                if (longitudeInput) longitudeInput.value = lng.toFixed(7);
                if (coordinatesInput) coordinatesInput.value = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
                this._updateProjectMarker(lat, lng);
            });

            this._projectMap.on('zoomend', () => {
                if (zoomInput) {
                    zoomInput.value = this._projectMap.getZoom();
                }
            });

            setTimeout(() => { try { this._projectMap.invalidateSize(); } catch(_){} }, 50);
        } catch (err) {
            console.error('❌ Failed to initialize project map:', err);
        }
    }

    _updateProjectMarker(lat, lng) {
        if (!this._projectMap || !lat || !lng) return;
        try {
            if (this._projectMarker) {
                this._projectMarker.setLatLng([lat, lng]);
            } else {
                this._projectMarker = L.marker([lat, lng]);
                this._projectMarker.addTo(this._projectMap);
            }
        } catch (err) {
            console.warn('⚠️ Could not update project marker:', err);
        }
    }

    async _geocodeProjectSearch(query, latitudeInput, longitudeInput, coordinatesInput, zoomInput) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
            const response = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            const results = await response.json();
            if (!Array.isArray(results) || results.length === 0) {
                this.showError('No results found for that search');
                return;
            }
            const best = results[0];
            const lat = parseFloat(best.lat);
            const lng = parseFloat(best.lon);
            const zoom = 17;
            if (this._projectMap) this._projectMap.setView([lat, lng], zoom);
            if (latitudeInput) latitudeInput.value = lat.toFixed(7);
            if (longitudeInput) longitudeInput.value = lng.toFixed(7);
            if (coordinatesInput) coordinatesInput.value = `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
            if (zoomInput) zoomInput.value = zoom;
            this._updateProjectMarker(lat, lng);
        } catch (err) {
            console.error('❌ Geocoding failed:', err);
            this.showError('Search failed. Try a different address or click the map.');
        }
    }

    async _searchProjectSuggestions(query, bounds) {
        try {
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`;
            if (bounds) {
                // Bias by current map view
                const west = bounds.getWest();
                const north = bounds.getNorth();
                const east = bounds.getEast();
                const south = bounds.getSouth();
                url += `&viewbox=${west},${north},${east},${south}`;
            }
            const response = await fetch(url, { headers: { 'Accept-Language': 'en' } });
            if (!response.ok) return [];
            const results = await response.json();
            if (!Array.isArray(results)) return [];
            return results;
        } catch (err) {
            console.warn('⚠️ Suggestion search failed:', err);
            return [];
        }
    }

    _renderProjectSearchResults(containerEl, results, query, activeIdx, onSelect) {
        if (!containerEl) return;
        if (!results || results.length === 0) {
            this._clearProjectSearchResults(containerEl);
            return;
        }
        const safeQuery = (query || '').trim();
        containerEl.innerHTML = results.map((r, idx) => {
            const title = this._escapeHtml(r.display_name || 'Result');
            const highlighted = safeQuery ? this._highlightMatch(title, safeQuery) : title;
            return `
            <div data-idx="${idx}" style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; ${activeIdx === idx ? 'background:#f9fafb;' : ''}">
                <div style="font-size: 0.9rem; color: #111827;">${highlighted}</div>
                ${r.address ? `<div style=\"font-size: 0.75rem; color: #6b7280; margin-top: 2px;\">${this._escapeHtml(Object.values(r.address).slice(0,3).join(', '))}</div>` : ''}
            </div>`;
        }).join('');
        containerEl.style.display = 'block';
        Array.from(containerEl.children).forEach((child, i) => {
            child.addEventListener('mouseover', () => { child.style.background = '#f9fafb'; });
            child.addEventListener('mouseout', () => { if (i !== activeIdx) child.style.background = 'white'; });
            child.addEventListener('click', () => {
                const item = results[i];
                if (item && onSelect) onSelect(item);
            });
        });
    }

    _clearProjectSearchResults(containerEl) {
        if (!containerEl) return;
        containerEl.innerHTML = '';
        containerEl.style.display = 'none';
        this._projectSearchResults = [];
    }

    _escapeHtml(str) {
        try {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\"/g, '&quot;')
                .replace(/'/g, '&#039;');
        } catch(_) { return ''; }
    }

    _highlightMatch(text, query) {
        try {
            const q = query.trim();
            if (!q) return text;
            const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
            return text.replace(pattern, (m) => `<mark style="background:#fff3c4; color:#1f2937; padding:0 2px; border-radius:2px;">${m}</mark>`);
        } catch(_) {
            return text;
        }
    }

}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanelDatabase();
});