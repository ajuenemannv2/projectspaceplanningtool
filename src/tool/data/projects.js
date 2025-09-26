/* Tool projects wrapper: delegates to existing functions/variables */
(function(){
    function load(){
        try {
            if (typeof loadProjectsFromDatabase === 'function') {
                return loadProjectsFromDatabase();
            }
        } catch(_) {}
    }

    function navigate(projectKey){
        try {
            if (typeof navigateToProject === 'function') {
                return navigateToProject(projectKey);
            }
        } catch(_) {}
    }

    function getAll(){
        try { return window.PROJECTS || {}; } catch(_) { return {}; }
    }

    if (typeof window !== 'undefined') {
        window.ToolProjects = { load, navigate, getAll };
    }
})();


