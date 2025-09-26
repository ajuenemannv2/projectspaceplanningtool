/* Tool TopoJSON export wrapper */
(function(){
    function exportSpaces(spaces){
        try { if (typeof exportSpacesToTopoJSON === 'function') return exportSpacesToTopoJSON(spaces); } catch(_){}
        return null;
    }
    if (typeof window !== 'undefined') { window.ToolExport = { exportSpacesToTopoJSON: exportSpaces }; }
})();


