/* Logistics phases wrapper: delegates to LogisticsMap instance methods */
(function(){
    function populate(projectId){
        try { if (window.logisticsMap && typeof window.logisticsMap.loadPhases === 'function') return window.logisticsMap.loadPhases(projectId); } catch(_){}
    }
    function applySelection(){
        try { if (window.logisticsMap && typeof window.logisticsMap.onPhaseChange === 'function') return window.logisticsMap.onPhaseChange(); } catch(_){}
    }
    if (typeof window !== 'undefined') {
        window.LogisticsPhases = { populate, applySelection };
    }
})();


