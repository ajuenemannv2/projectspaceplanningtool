/* Admin data wrapper: delegates to AdminPanelDatabase instance methods */
(function(){
    function loadProjectPhases(projectId){
        try { if (window.adminPanel && typeof window.adminPanel.loadProjectPhases === 'function') return window.adminPanel.loadProjectPhases(projectId); } catch(_){}
    }
    function loadProjectSpaces(projectId){
        try { if (window.adminPanel && typeof window.adminPanel.loadProjectSpaces === 'function') return window.adminPanel.loadProjectSpaces(projectId); } catch(_){}
    }
    if (typeof window !== 'undefined') {
        window.AdminData = { loadProjectPhases, loadProjectSpaces };
    }
})();


