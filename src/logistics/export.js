/* Logistics export wrapper: delegates to LogisticsMap.exportHDImage */
(function(){
    function exportHDImage(){
        try { if (window.logisticsMap && typeof window.logisticsMap.exportHDImage === 'function') return window.logisticsMap.exportHDImage(); } catch(_){}
    }
    if (typeof window !== 'undefined') { window.LogisticsExport = { exportHDImage }; }
})();


