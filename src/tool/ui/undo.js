/* Undo UI helper: thin wrapper to call existing functions */
(function(){
    function update(){
        try { if (typeof updateUndoButton === 'function') return updateUndoButton(); } catch(_){}
    }
    function clear(){
        try { if (typeof clearDrawing === 'function') return clearDrawing(); } catch(_){}
    }
    if (typeof window !== 'undefined') {
        window.ToolUndo = { update, clear };
    }
})();


