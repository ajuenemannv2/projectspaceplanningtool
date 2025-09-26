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

    if (typeof window !== 'undefined') {
        window.ToolPhases = { populate, getSelected };
    }
})();


