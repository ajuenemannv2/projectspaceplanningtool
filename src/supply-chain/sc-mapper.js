(function(){
    var _data        = null;
    var _scores      = {};
    var _view        = 'graph';
    var _filterState = null;
    var _filterDebounce = null;

    function init() {
        var errorBanner  = document.getElementById('globalErrorBanner');
        var errorText    = document.getElementById('globalErrorText');
        var errorRetry   = document.getElementById('globalErrorRetry');
        var errorDismiss = document.getElementById('globalErrorDismiss');

        function showError(msg, retryFn) {
            if (errorText)   errorText.textContent = msg;
            if (errorBanner) errorBanner.classList.add('visible');
            if (errorRetry)  errorRetry.onclick = retryFn || null;
            if (errorDismiss) errorDismiss.onclick = function(){ errorBanner.classList.remove('visible'); };
        }

        // Init sub-modules
        window.SCDetailPanel.init(document.getElementById('scDrawer'));
        window.SCGraphView.init(document.getElementById('scGraphContainer'));
        window.SCMapView.init(document.getElementById('scMapContainer'));
        window.SCOpportunities.init(document.getElementById('scSidebar'));

        // Wire view toggle
        document.querySelectorAll('.sc-view-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                switchView(btn.dataset.view);
            });
        });

        // Wire node selected
        window.addEventListener('sc:node-selected', function(e) {
            var entityId = e.detail && e.detail.entityId;
            if (!entityId) return;
            window.SCDetailPanel.open(entityId);
            window.SCGraphView.focusNode(entityId);
            window.SCMapView.focusEntity(entityId);
        });

        // Wire filter change
        window.addEventListener('sc:filter-change', function(e) {
            _filterState = e.detail;
            clearTimeout(_filterDebounce);
            _filterDebounce = setTimeout(function(){ applyFilters(); }, 180);
        });

        // Wire export
        var exportBtn = document.getElementById('scExportBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportGraph);

        // Wire heatmap toggle
        var heatBtn = document.getElementById('scHeatmapBtn');
        if (heatBtn) {
            var heatOn = false;
            heatBtn.addEventListener('click', function() {
                heatOn = !heatOn;
                window.SCMapView.toggleHeatmap(heatOn);
                heatBtn.classList.toggle('sc-view-btn--active', heatOn);
            });
        }

        loadData(showError);
    }

    function loadData(showError) {
        var loadingEl = document.getElementById('scLoading');
        if (loadingEl) loadingEl.classList.remove('sc-hidden');

        window.SCData.fetchAll().then(function(data) {
            _data = data;
            window._scEntitiesCache = data.entities;

            // Compute scores — now includes billImpacts for full legislative signal
            _scores = window.SCScoring.computeAll(
                data.entities,
                data.relationships,
                data.policyImpacts,
                data.sectorTrends,
                data.billImpacts
            );
            window._scScoresCache = _scores;

            // Build filter panel
            window.SCFilterPanel.build(
                document.getElementById('scFilterPanel'),
                data.entities
            );
            _filterState = window.SCFilterPanel.getState();

            // Render opportunities panel (wraps filter panel in tabs)
            window.SCOpportunities.render(data.entities, _scores, data.instruments);

            // Load graph and map
            window.SCGraphView.load(data.entities, data.relationships, _scores);
            window.SCMapView.load(data.entities, _scores);

            updateStats(data);

            if (loadingEl) loadingEl.classList.add('sc-hidden');

            // Persist scores to DB asynchronously (non-blocking)
            window.SCData.persistScores(_scores).catch(function(err) {
                LOG.warn('Score persistence failed (non-critical)', err);
            });

        }).catch(function(err) {
            LOG.error('SCMapper load error', err);
            if (loadingEl) loadingEl.classList.add('sc-hidden');
            if (showError) showError('Failed to load supply chain data. Check your connection.', function(){ loadData(showError); });
        });
    }

    function applyFilters() {
        if (!_filterState || !_data) return;
        window.SCGraphView.applyFilters(_filterState, _scores);
        window.SCMapView.applyFilters(_filterState, _scores);
    }

    function switchView(view) {
        _view = view;
        var graphEl = document.getElementById('scGraphContainer');
        var mapEl   = document.getElementById('scMapContainer');

        document.querySelectorAll('.sc-view-btn').forEach(function(b){
            b.classList.toggle('sc-view-btn--active', b.dataset.view === view);
        });

        graphEl.classList.remove('sc-split-pane');
        mapEl.classList.remove('sc-split-pane');

        if (view === 'graph') {
            graphEl.classList.remove('sc-hidden');
            mapEl.classList.add('sc-hidden');
        } else if (view === 'map') {
            graphEl.classList.add('sc-hidden');
            mapEl.classList.remove('sc-hidden');
            window.SCMapView.invalidateSize();
        } else if (view === 'split') {
            graphEl.classList.remove('sc-hidden');
            mapEl.classList.remove('sc-hidden');
            graphEl.classList.add('sc-split-pane');
            mapEl.classList.add('sc-split-pane');
            window.SCMapView.invalidateSize();
        }
    }

    function updateStats(data) {
        var el = document.getElementById('scEntityCount');
        if (el) el.textContent = data.entities.length + ' entities';
        var relEl = document.getElementById('scRelCount');
        if (relEl) relEl.textContent = data.relationships.length + ' relationships';
        var polEl = document.getElementById('scPolCount');
        if (polEl) polEl.textContent = data.policyEvents.length + ' policy events';
    }

    function exportGraph() {
        var png = window.SCGraphView.exportPNG();
        if (!png) return;
        var a = document.createElement('a');
        a.href = png;
        a.download = 'investor-chain-' + new Date().toISOString().slice(0,10) + '.png';
        a.click();
    }

    window.addEventListener('DOMContentLoaded', init);
    window.SCMapper = { switchView: switchView };
})();
