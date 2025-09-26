/* Tool phases wrapper: delegates to existing functions in script.js
   This keeps behavior identical while providing a stable entry point. */
(function(){
    function populate(projectId){
        try {
            if (typeof populatePhaseCheckboxes === 'function') {
                return populatePhaseCheckboxes(projectId);
            }
        } catch(_) {}
    }

    function getSelected(){
        try {
            if (typeof getSelectedPhases === 'function') {
                return getSelectedPhases();
            }
        } catch(_) {}
        return [];
    }

    function restoreForProject(projectId){
        try {
            if (window.ToolSelection && typeof window.ToolSelection.restorePhases === 'function') {
                const ids = window.ToolSelection.restorePhases(projectId);
                if (Array.isArray(ids) && ids.length) {
                    ids.forEach(id => {
                        const cb = document.getElementById('phase_' + id);
                        if (cb) cb.checked = true;
                    });
                }
            }
        } catch(_) {}
    }

    if (typeof window !== 'undefined') {
        window.ToolPhases = { populate, getSelected, restoreForProject };
    }
})();


