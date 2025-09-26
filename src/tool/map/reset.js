/* Tool map reset wrapper: stable entry for resetting the map view */
(function(){
    function reset(){
        try { if (typeof resetMapView === 'function') return resetMapView(); } catch(_){}
    }
    if (typeof window !== 'undefined') {
        window.ToolMapReset = { reset };
    }
})();


