/* Tool drawing controls: wrappers for existing drawing helpers */
(function(){
    function addUndo(){ try { if (typeof addUndoButtonToToolbar === 'function') return addUndoButtonToToolbar(); } catch(_){} }
    function enable(){ try { if (typeof enableDrawingControls === 'function') return enableDrawingControls(); } catch(_){} }
    function setActive(active){ try { if (typeof setDrawingModeActive === 'function') return setDrawingModeActive(!!active); } catch(_){} }
    function cancel(){ try { if (typeof cancelDrawing === 'function') return cancelDrawing(); } catch(_){} }
    if (typeof window !== 'undefined') { window.ToolDrawing = { addUndo, enable, setActive, cancel }; }
})();


