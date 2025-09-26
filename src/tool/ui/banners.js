/* Tool UI helpers (global error banner, project banner text) */
(function(){
    function byId(id){ return document.getElementById(id); }

    function initGlobalErrorBanner(){
        const banner = byId('globalErrorBanner');
        const retry = byId('globalErrorRetry');
        const dismiss = byId('globalErrorDismiss');
        if (!banner) return;
        // Ensure hidden on init
        banner.style.display = 'none';
        if (dismiss) dismiss.onclick = function(){ banner.style.display = 'none'; };
        // Retry handler will be set dynamically in showError
        if (retry) retry.onclick = function(){ banner.style.display = 'none'; };
    }

    function showError(message, retryFn){
        const banner = byId('globalErrorBanner');
        const text = byId('globalErrorText');
        const retry = byId('globalErrorRetry');
        const dismiss = byId('globalErrorDismiss');
        if (!banner) return;
        if (text) text.textContent = message || 'An error occurred.';
        if (retry) retry.onclick = function(){ if (typeof retryFn === 'function') retryFn(); banner.style.display = 'none'; };
        if (dismiss) dismiss.onclick = function(){ banner.style.display = 'none'; };
        banner.style.display = 'block';
    }

    function hideError(){
        const banner = byId('globalErrorBanner');
        if (banner) banner.style.display = 'none';
    }

    function setCurrentProjectName(name){
        const cont = byId('currentProjectBanner');
        const val = byId('currentProjectName');
        if (!cont) return;
        if (!name){ cont.style.display = 'none'; return; }
        if (val) val.textContent = name;
        cont.style.display = 'block';
    }

    if (typeof window !== 'undefined'){
        window.ToolUI = { initGlobalErrorBanner, showError, hideError, setCurrentProjectName };
    }
})();
