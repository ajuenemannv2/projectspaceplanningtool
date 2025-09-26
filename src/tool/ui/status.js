/* Tool status UI helper to update the drawing status chip */
(function(){
    function update(message, type){
        try {
            var dot = document.querySelector('.status-dot');
            var text = document.querySelector('.status-text');
            if (text) text.textContent = message || '';
            if (!dot) return;
            dot.classList.remove('drawing', 'error');
            if (type === 'drawing') dot.classList.add('drawing');
            else if (type === 'error') dot.classList.add('error');
        } catch(_) {}
    }

    if (typeof window !== 'undefined') {
        window.ToolStatus = { update: update };
    }
})();


