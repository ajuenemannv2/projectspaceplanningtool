/* Logistics UI helper: update space count display (wrapper) */
(function(){
    function updateSpaceCount(count){
        try { if (window.logisticsMap && typeof window.logisticsMap.updateSpaceCount === 'function') return window.logisticsMap.updateSpaceCount(count); } catch(_){}
    }
    if (typeof window !== 'undefined') { window.LogisticsUI = { updateSpaceCount }; }
})();


