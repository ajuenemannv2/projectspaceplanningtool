/* Logistics spaces wrapper: delegates to LogisticsMap instance methods */
(function(){
    function refresh(){
        try { if (window.logisticsMap && typeof window.logisticsMap.filterSpaces === 'function') return window.logisticsMap.filterSpaces(); } catch(_){}
    }
    if (typeof window !== 'undefined') {
        window.LogisticsSpaces = { refresh };
    }
})();


