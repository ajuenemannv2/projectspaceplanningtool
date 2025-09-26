/* Selection persistence helpers for project/zoom and phases */
(function(){
    function persistProject(projectId, zoom){
        try {
            if (projectId != null) localStorage.setItem('selected_project_id', String(projectId));
            if (zoom != null) localStorage.setItem('selected_project_zoom', String(zoom));
        } catch(_) {}
    }

    function restoreProject(){
        try {
            const projectId = localStorage.getItem('selected_project_id') || null;
            const zoomRaw = localStorage.getItem('selected_project_zoom');
            const zoom = zoomRaw != null ? parseInt(zoomRaw, 10) : null;
            return { projectId, zoom: isNaN(zoom) ? null : zoom };
        } catch(_) { return { projectId: null, zoom: null }; }
    }

    function persistPhases(projectId, phaseIds){
        try {
            if (projectId != null && Array.isArray(phaseIds)) {
                localStorage.setItem('selected_project_id', String(projectId));
                localStorage.setItem('selected_phase_ids', JSON.stringify(phaseIds.map(Number)));
            }
        } catch(_) {}
    }

    function restorePhases(projectId){
        try {
            const savedProject = localStorage.getItem('selected_project_id');
            if (String(savedProject) !== String(projectId)) return [];
            const raw = localStorage.getItem('selected_phase_ids');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.map(Number).filter(n => !isNaN(n)) : [];
        } catch(_) { return []; }
    }

    if (typeof window !== 'undefined') {
        window.ToolSelection = { persistProject, restoreProject, persistPhases, restorePhases };
    }
})();


