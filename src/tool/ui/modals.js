/* Tool modal helpers: no-ops retained for compatibility after removing legacy modals */
(function(){
    function closePreview(){ try { if (typeof closePreviewModal === 'function') return closePreviewModal(); } catch(_){} }
    function closeSuccess(){ try { if (typeof closeSuccessModal === 'function') return closeSuccessModal(); } catch(_){} }
    if (typeof window !== 'undefined') {
        window.ToolModals = { closePreview, closeSuccess };
    }
})();


