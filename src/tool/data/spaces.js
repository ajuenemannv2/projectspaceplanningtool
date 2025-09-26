/* Tool spaces wrapper: provides a stable entry to refresh saved spaces */
(function(){
    function refresh(){
        try {
            if (typeof loadProjectSpaces === 'function') {
                return loadProjectSpaces();
            }
        } catch(_) {}
    }

    if (typeof window !== 'undefined') {
        window.ToolSpaces = { refresh };
    }
})();


