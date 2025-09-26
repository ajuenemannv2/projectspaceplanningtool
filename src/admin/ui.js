/* Admin UI wrapper: delegates to AdminPanelDatabase UI updates */
(function(){
    function updateProjectsTable(){ try { if (window.adminPanel && typeof window.adminPanel.updateProjectsTable === 'function') return window.adminPanel.updateProjectsTable(); } catch(_){} }
    function updateSpacesTable(){ try { if (window.adminPanel && typeof window.adminPanel.updateSpacesTable === 'function') return window.adminPanel.updateSpacesTable(); } catch(_){} }
    if (typeof window !== 'undefined') { window.AdminUI = { updateProjectsTable, updateSpacesTable }; }
})();


