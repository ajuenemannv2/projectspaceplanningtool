/* Tool status UI helper to update the drawing status chip */
(function(){
    let currentState = {
        tool: 'none',
        stage: 'idle',
        selection: null,
        drawing: false
    };

    function update(message, type){
        try {
            var dot = document.querySelector('.status-dot');
            var text = document.querySelector('.status-text');
            if (text) text.textContent = message || '';
            if (!dot) return;
            dot.classList.remove('drawing', 'error', 'active', 'selected');
            if (type === 'drawing') dot.classList.add('drawing');
            else if (type === 'error') dot.classList.add('error');
            else if (type === 'active') dot.classList.add('active');
            else if (type === 'selected') dot.classList.add('selected');
        } catch(_) {}
    }

    function updateState(newState) {
        currentState = { ...currentState, ...newState };
        updateStateDisplay();
    }

    function updateStateDisplay() {
        try {
            // Update tool indicator
            const toolIndicator = document.querySelector('.tool-indicator');
            if (toolIndicator) {
                toolIndicator.textContent = getToolDisplayName(currentState.tool);
                toolIndicator.className = `tool-indicator tool-${currentState.tool}`;
            }

            // Update stage indicator
            const stageIndicator = document.querySelector('.stage-indicator');
            if (stageIndicator) {
                stageIndicator.textContent = getStageDisplayName(currentState.stage);
                stageIndicator.className = `stage-indicator stage-${currentState.stage}`;
            }

            // Update selection indicator
            const selectionIndicator = document.querySelector('.selection-indicator');
            if (selectionIndicator) {
                if (currentState.selection) {
                    selectionIndicator.textContent = `Selected: ${getSelectionDisplayName(currentState.selection)}`;
                    selectionIndicator.className = 'selection-indicator has-selection';
                } else {
                    selectionIndicator.textContent = 'No selection';
                    selectionIndicator.className = 'selection-indicator no-selection';
                }
            }

            // Update drawing indicator
            const drawingIndicator = document.querySelector('.drawing-indicator');
            if (drawingIndicator) {
                if (currentState.drawing) {
                    drawingIndicator.textContent = 'Drawing in progress...';
                    drawingIndicator.className = 'drawing-indicator active';
                } else {
                    drawingIndicator.textContent = 'Ready';
                    drawingIndicator.className = 'drawing-indicator ready';
                }
            }

        } catch(_) {}
    }

    function getToolDisplayName(tool) {
        const toolNames = {
            'none': 'No Tool',
            'polygon': 'Polygon Tool',
            'rectangle': 'Rectangle Tool',
            'fence': 'Fence Tool',
            'crane': 'Crane Tool',
            'edit': 'Edit Mode'
        };
        return toolNames[tool] || 'Unknown Tool';
    }

    function getStageDisplayName(stage) {
        const stageNames = {
            'idle': 'Idle',
            'drawing': 'Drawing',
            'editing': 'Editing',
            'pad': 'Crane Pad',
            'radius': 'Crane Radius',
            'sweep': 'Crane Sweep'
        };
        return stageNames[stage] || 'Unknown Stage';
    }

    function getSelectionDisplayName(selection) {
        if (selection && selection._spaceData) {
            return selection._spaceData.space_name || 'Saved Space';
        }
        if (selection && selection._isSavedSpace) {
            return 'Saved Space';
        }
        if (selection) {
            return 'Drawn Shape';
        }
        return 'Unknown Selection';
    }

    function getCurrentState() {
        return { ...currentState };
    }

    if (typeof window !== 'undefined') {
        window.ToolStatus = { 
            update: update, 
            updateState: updateState,
            getCurrentState: getCurrentState
        };
    }
})();


