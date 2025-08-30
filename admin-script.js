// Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.campuses = [];
        this.contractors = [];
        this.activityLog = [];
        this.settings = {};
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.updateDashboard();
        this.loadSettings();
    }

    // Data Management
    loadData() {
        // Load campuses from localStorage or default data
        this.campuses = JSON.parse(localStorage.getItem('admin_campuses')) || [
            {
                id: 'ronler',
                name: 'Ronler Acres',
                coordinates: [45.5442515697061, -122.91389689455964],
                zoom: 16,
                status: 'active'
            },
            {
                id: 'aloha',
                name: 'Aloha',
                coordinates: [45.493682619637106, -122.88441018345922],
                zoom: 16,
                status: 'active'
            },
            {
                id: 'houston',
                name: 'Houston',
                coordinates: [37.37607986263847, -121.97491259987373],
                zoom: 16,
                status: 'active'
            }
        ];

        // Load contractors from localStorage or default data
        this.contractors = JSON.parse(localStorage.getItem('admin_contractors')) || [
            {
                id: 1,
                name: 'BuildRight Inc.',
                contactPerson: 'John Smith',
                email: 'john@buildright.com',
                phone: '(555) 123-4567',
                status: 'active'
            },
            {
                id: 2,
                name: 'Quality Builders',
                contactPerson: 'Sarah Johnson',
                email: 'sarah@qualitybuilders.com',
                phone: '(555) 234-5678',
                status: 'active'
            },
            {
                id: 3,
                name: 'XYZ Contractors',
                contactPerson: 'Mike Davis',
                email: 'mike@xyzcontractors.com',
                phone: '(555) 345-6789',
                status: 'active'
            }
        ];

        // Load activity log
        this.activityLog = JSON.parse(localStorage.getItem('admin_activity_log')) || [];
    }

    saveData() {
        localStorage.setItem('admin_campuses', JSON.stringify(this.campuses));
        localStorage.setItem('admin_contractors', JSON.stringify(this.contractors));
        localStorage.setItem('admin_activity_log', JSON.stringify(this.activityLog));
        localStorage.setItem('admin_settings', JSON.stringify(this.settings));
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
        this.saveData();
        this.updateActivityTable();
    }

    // Dashboard
    updateDashboard() {
        const totalRequests = this.activityLog.filter(log => log.action === 'Staging Request').length;
        const activeCampuses = this.campuses.filter(campus => campus.status === 'active').length;
        const totalContractors = this.contractors.filter(contractor => contractor.status === 'active').length;
        
        // Calculate total area from activity log
        const totalArea = this.activityLog
            .filter(log => log.action === 'Staging Request' && log.details.requestedArea)
            .reduce((sum, log) => sum + (log.details.requestedArea || 0), 0);

        document.getElementById('totalRequests').textContent = totalRequests;
        document.getElementById('activeCampuses').textContent = activeCampuses;
        document.getElementById('totalContractors').textContent = totalContractors;
        document.getElementById('totalArea').textContent = totalArea.toLocaleString();

        this.updateChart();
    }

    updateChart() {
        const ctx = document.getElementById('requestsChart');
        if (!ctx) return;

        // Group requests by month
        const monthlyData = {};
        this.activityLog
            .filter(log => log.action === 'Staging Request')
            .forEach(log => {
                const month = new Date(log.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                monthlyData[month] = (monthlyData[month] || 0) + 1;
            });

        const labels = Object.keys(monthlyData);
        const data = Object.values(monthlyData);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Staging Requests',
                    data: data,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Staging Requests'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Campus Management
    updateCampusesTable() {
        const tbody = document.getElementById('campusesTableBody');
        tbody.innerHTML = '';

        this.campuses.forEach(campus => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${campus.name}</td>
                <td>${campus.coordinates[0].toFixed(6)}, ${campus.coordinates[1].toFixed(6)}</td>
                <td>${campus.zoom}</td>
                <td><span class="status-badge status-${campus.status}">${campus.status}</span></td>
                <td>
                    <button class="btn btn-secondary" onclick="adminPanel.editCampus('${campus.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="adminPanel.deleteCampus('${campus.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    addCampus(campusData) {
        const campus = {
            id: campusData.name.toLowerCase().replace(/\s+/g, '-'),
            name: campusData.name,
            coordinates: [parseFloat(campusData.lat), parseFloat(campusData.lng)],
            zoom: parseInt(campusData.zoom),
            status: campusData.status
        };

        this.campuses.push(campus);
        this.saveData();
        this.updateCampusesTable();
        this.updateDashboard();
        this.logActivity('Campus Added', campus);
        this.showNotification('Campus added successfully!', 'success');
    }

    editCampus(campusId) {
        const campus = this.campuses.find(c => c.id === campusId);
        if (!campus) return;

        // Populate modal with campus data
        document.getElementById('campusName').value = campus.name;
        document.getElementById('campusLat').value = campus.coordinates[0];
        document.getElementById('campusLng').value = campus.coordinates[1];
        document.getElementById('campusZoom').value = campus.zoom;
        document.getElementById('campusStatus').value = campus.status;

        // Change form to edit mode
        const form = document.getElementById('addCampusForm');
        form.dataset.editId = campusId;
        form.querySelector('button[type="submit"]').textContent = 'Update Campus';

        this.showModal('addCampusModal');
    }

    deleteCampus(campusId) {
        if (confirm('Are you sure you want to delete this campus?')) {
            this.campuses = this.campuses.filter(c => c.id !== campusId);
            this.saveData();
            this.updateCampusesTable();
            this.updateDashboard();
            this.logActivity('Campus Deleted', { campusId });
            this.showNotification('Campus deleted successfully!', 'success');
        }
    }

    // Contractor Management
    updateContractorsTable() {
        const tbody = document.getElementById('contractorsTableBody');
        tbody.innerHTML = '';

        this.contractors.forEach(contractor => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${contractor.name}</td>
                <td>${contractor.contactPerson || '-'}</td>
                <td>${contractor.email || '-'}</td>
                <td>${contractor.phone || '-'}</td>
                <td><span class="status-badge status-${contractor.status}">${contractor.status}</span></td>
                <td>
                    <button class="btn btn-secondary" onclick="adminPanel.editContractor(${contractor.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger" onclick="adminPanel.deleteContractor(${contractor.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    addContractor(contractorData) {
        const contractor = {
            id: Date.now(),
            name: contractorData.name,
            contactPerson: contractorData.contactPerson,
            email: contractorData.email,
            phone: contractorData.phone,
            status: contractorData.status
        };

        this.contractors.push(contractor);
        this.saveData();
        this.updateContractorsTable();
        this.updateDashboard();
        this.logActivity('Contractor Added', contractor);
        this.showNotification('Contractor added successfully!', 'success');
    }

    editContractor(contractorId) {
        const contractor = this.contractors.find(c => c.id === contractorId);
        if (!contractor) return;

        // Populate modal with contractor data
        document.getElementById('contractorName').value = contractor.name;
        document.getElementById('contactPerson').value = contractor.contactPerson || '';
        document.getElementById('contactEmail').value = contractor.email || '';
        document.getElementById('contactPhone').value = contractor.phone || '';
        document.getElementById('contractorStatus').value = contractor.status;

        // Change form to edit mode
        const form = document.getElementById('addContractorForm');
        form.dataset.editId = contractorId;
        form.querySelector('button[type="submit"]').textContent = 'Update Contractor';

        this.showModal('addContractorModal');
    }

    deleteContractor(contractorId) {
        if (confirm('Are you sure you want to delete this contractor?')) {
            this.contractors = this.contractors.filter(c => c.id !== contractorId);
            this.saveData();
            this.updateContractorsTable();
            this.updateDashboard();
            this.logActivity('Contractor Deleted', { contractorId });
            this.showNotification('Contractor deleted successfully!', 'success');
        }
    }

    // Activity Log
    updateActivityTable() {
        const tbody = document.getElementById('activityTableBody');
        tbody.innerHTML = '';

        this.activityLog.slice(0, 100).forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(activity.timestamp).toLocaleString()}</td>
                <td>${activity.action}</td>
                <td>${activity.user}</td>
                <td>${this.formatActivityDetails(activity.details)}</td>
                <td><span class="status-badge status-${activity.status}">${activity.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    formatActivityDetails(details) {
        if (typeof details === 'string') return details;
        if (typeof details === 'object') {
            return Object.entries(details)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
        }
        return JSON.stringify(details);
    }

    filterActivity() {
        const filter = document.getElementById('activityFilter').value;
        const dateFrom = document.getElementById('activityDateFrom').value;
        const dateTo = document.getElementById('activityDateTo').value;

        let filteredLog = this.activityLog;

        if (filter !== 'all') {
            filteredLog = filteredLog.filter(activity => {
                if (filter === 'request') return activity.action === 'Staging Request';
                if (filter === 'admin') return activity.action.includes('Added') || activity.action.includes('Deleted') || activity.action.includes('Updated');
                if (filter === 'system') return activity.action.includes('System');
                return true;
            });
        }

        if (dateFrom) {
            filteredLog = filteredLog.filter(activity => 
                new Date(activity.timestamp) >= new Date(dateFrom)
            );
        }

        if (dateTo) {
            filteredLog = filteredLog.filter(activity => 
                new Date(activity.timestamp) <= new Date(dateTo + 'T23:59:59')
            );
        }

        this.displayFilteredActivity(filteredLog);
    }

    displayFilteredActivity(filteredLog) {
        const tbody = document.getElementById('activityTableBody');
        tbody.innerHTML = '';

        filteredLog.forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(activity.timestamp).toLocaleString()}</td>
                <td>${activity.action}</td>
                <td>${activity.user}</td>
                <td>${this.formatActivityDetails(activity.details)}</td>
                <td><span class="status-badge status-${activity.status}">${activity.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    // Settings
    loadSettings() {
        this.settings = JSON.parse(localStorage.getItem('admin_settings')) || {
            defaultCampus: 'ronler',
            maxStagingArea: 100000,
            approvalRequired: false,
            adminEmail: '',
            notifyNewRequest: true,
            notifyApproval: true
        };

        // Populate settings form
        document.getElementById('defaultCampus').value = this.settings.defaultCampus;
        document.getElementById('maxStagingArea').value = this.settings.maxStagingArea;
        document.getElementById('approvalRequired').checked = this.settings.approvalRequired;
        document.getElementById('adminEmail').value = this.settings.adminEmail;
        document.getElementById('notifyNewRequest').checked = this.settings.notifyNewRequest;
        document.getElementById('notifyApproval').checked = this.settings.notifyApproval;

        // Populate campus dropdown
        this.populateCampusDropdown();
    }

    populateCampusDropdown() {
        const select = document.getElementById('defaultCampus');
        select.innerHTML = '';
        
        this.campuses.forEach(campus => {
            const option = document.createElement('option');
            option.value = campus.id;
            option.textContent = campus.name;
            select.appendChild(option);
        });
    }

    saveSettings() {
        this.settings = {
            defaultCampus: document.getElementById('defaultCampus').value,
            maxStagingArea: parseInt(document.getElementById('maxStagingArea').value),
            approvalRequired: document.getElementById('approvalRequired').checked,
            adminEmail: document.getElementById('adminEmail').value,
            notifyNewRequest: document.getElementById('notifyNewRequest').checked,
            notifyApproval: document.getElementById('notifyApproval').checked
        };

        this.saveData();
        this.logActivity('Settings Updated', this.settings);
        this.showNotification('Settings saved successfully!', 'success');
    }

    // Export Functions
    exportCampuses() {
        const csv = this.convertToCSV(this.campuses, ['name', 'coordinates', 'zoom', 'status']);
        this.downloadCSV(csv, 'campuses_export.csv');
    }

    exportContractors() {
        const csv = this.convertToCSV(this.contractors, ['name', 'contactPerson', 'email', 'phone', 'status']);
        this.downloadCSV(csv, 'contractors_export.csv');
    }

    exportActivity() {
        const csv = this.convertToCSV(this.activityLog, ['timestamp', 'action', 'user', 'details', 'status']);
        this.downloadCSV(csv, 'activity_log_export.csv');
    }

    convertToCSV(data, fields) {
        const headers = fields.join(',');
        const rows = data.map(item => 
            fields.map(field => {
                const value = item[field];
                if (typeof value === 'object') return JSON.stringify(value);
                return value || '';
            }).join(',')
        );
        return [headers, ...rows].join('\n');
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // Data Management
    backupData() {
        const backup = {
            campuses: this.campuses,
            contractors: this.contractors,
            activityLog: this.activityLog,
            settings: this.settings,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `staging_tool_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        this.logActivity('Data Backup Created', { timestamp: backup.timestamp });
        this.showNotification('Backup created successfully!', 'success');
    }

    clearOldData() {
        if (confirm('Are you sure you want to clear old activity data? This cannot be undone.')) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const oldCount = this.activityLog.length;
            this.activityLog = this.activityLog.filter(activity => 
                new Date(activity.timestamp) > thirtyDaysAgo
            );
            
            this.saveData();
            this.updateActivityTable();
            this.updateDashboard();
            
            this.logActivity('Old Data Cleared', { 
                removedCount: oldCount - this.activityLog.length,
                cutoffDate: thirtyDaysAgo.toISOString()
            });
            this.showNotification(`Cleared ${oldCount - this.activityLog.length} old records!`, 'success');
        }
    }

    // UI Functions
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.nav-btn').dataset.tab;
                this.switchTab(tab);
            });
        });

        // Form submissions
        document.getElementById('addCampusForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCampusForm();
        });

        document.getElementById('addContractorForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleContractorForm();
        });

        // Initial table updates
        this.updateCampusesTable();
        this.updateContractorsTable();
        this.updateActivityTable();
    }

    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Update specific tab data
        if (tabName === 'dashboard') {
            this.updateDashboard();
        }
    }

    handleCampusForm() {
        const form = document.getElementById('addCampusForm');
        const editId = form.dataset.editId;

        const campusData = {
            name: document.getElementById('campusName').value,
            lat: document.getElementById('campusLat').value,
            lng: document.getElementById('campusLng').value,
            zoom: document.getElementById('campusZoom').value,
            status: document.getElementById('campusStatus').value
        };

        if (editId) {
            // Update existing campus
            const index = this.campuses.findIndex(c => c.id === editId);
            if (index !== -1) {
                this.campuses[index] = {
                    ...this.campuses[index],
                    name: campusData.name,
                    coordinates: [parseFloat(campusData.lat), parseFloat(campusData.lng)],
                    zoom: parseInt(campusData.zoom),
                    status: campusData.status
                };
                this.logActivity('Campus Updated', this.campuses[index]);
            }
            delete form.dataset.editId;
            form.querySelector('button[type="submit"]').textContent = 'Add Campus';
        } else {
            // Add new campus
            this.addCampus(campusData);
        }

        this.saveData();
        this.updateCampusesTable();
        this.populateCampusDropdown();
        this.closeModal('addCampusModal');
        form.reset();
    }

    handleContractorForm() {
        const form = document.getElementById('addContractorForm');
        const editId = form.dataset.editId;

        const contractorData = {
            name: document.getElementById('contractorName').value,
            contactPerson: document.getElementById('contactPerson').value,
            email: document.getElementById('contactEmail').value,
            phone: document.getElementById('contactPhone').value,
            status: document.getElementById('contractorStatus').value
        };

        if (editId) {
            // Update existing contractor
            const index = this.contractors.findIndex(c => c.id === parseInt(editId));
            if (index !== -1) {
                this.contractors[index] = {
                    ...this.contractors[index],
                    ...contractorData
                };
                this.logActivity('Contractor Updated', this.contractors[index]);
            }
            delete form.dataset.editId;
            form.querySelector('button[type="submit"]').textContent = 'Add Contractor';
        } else {
            // Add new contractor
            this.addContractor(contractorData);
        }

        this.saveData();
        this.updateContractorsTable();
        this.closeModal('addContractorModal');
        form.reset();
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global functions for HTML onclick handlers
function showAddCampusModal() {
    adminPanel.showModal('addCampusModal');
}

function showAddContractorModal() {
    adminPanel.showModal('addContractorModal');
}

function closeModal(modalId) {
    adminPanel.closeModal(modalId);
}

function exportCampuses() {
    adminPanel.exportCampuses();
}

function exportContractors() {
    adminPanel.exportContractors();
}

function exportActivity() {
    adminPanel.exportActivity();
}

function filterActivity() {
    adminPanel.filterActivity();
}

function saveSettings() {
    adminPanel.saveSettings();
}

function backupData() {
    adminPanel.backupData();
}

function clearOldData() {
    adminPanel.clearOldData();
}

// Initialize admin panel
const adminPanel = new AdminPanel();

// Export data to main application
window.AdminPanel = adminPanel;
