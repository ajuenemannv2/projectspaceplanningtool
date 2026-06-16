(function(){
    var cy = null;
    var _container = null;
    var _scores = {};

    function init(container) {
        _container = container;
        cy = cytoscape({
            container: container,
            style: buildStyle(),
            layout: { name: 'preset' },
            wheelSensitivity: 0.3,
            minZoom: 0.15,
            maxZoom: 4
        });
        cy.on('tap', 'node', function(e) {
            var id = e.target.data('entityId');
            if (id) window.dispatchEvent(new CustomEvent('sc:node-selected', { detail: { entityId: id } }));
        });
        cy.on('tap', function(e) {
            if (e.target === cy) window.dispatchEvent(new CustomEvent('sc:node-deselected'));
        });
    }

    function buildStyle() {
        return [
            {
                selector: 'node',
                style: {
                    'background-color': 'data(color)',
                    'width': 'data(size)',
                    'height': 'data(size)',
                    'label': 'data(label)',
                    'font-size': '11px',
                    'font-family': 'Inter, -apple-system, sans-serif',
                    'color': '#1e293b',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': '4px',
                    'text-max-width': '90px',
                    'text-wrap': 'ellipsis',
                    'border-width': '2px',
                    'border-color': 'data(borderColor)',
                    'border-opacity': 0.6,
                    'transition-property': 'opacity, border-width',
                    'transition-duration': '200ms'
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': '3px',
                    'border-color': '#2563eb',
                    'border-opacity': 1
                }
            },
            {
                selector: 'node.dimmed',
                style: { 'opacity': 0.15 }
            },
            {
                selector: 'edge',
                style: {
                    'width': 'data(width)',
                    'line-color': 'data(edgeColor)',
                    'target-arrow-color': 'data(edgeColor)',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'opacity': 0.6,
                    'transition-property': 'opacity',
                    'transition-duration': '200ms'
                }
            },
            {
                selector: 'edge.sole-source',
                style: {
                    'line-style': 'dashed',
                    'line-dash-pattern': [6, 3]
                }
            },
            {
                selector: 'edge.dimmed',
                style: { 'opacity': 0.05 }
            }
        ];
    }

    function load(entities, relationships, scores) {
        if (!cy) return;
        _scores = scores || {};

        var elements = [];

        entities.forEach(function(entity) {
            var sc = scores[entity.id] || { structural: 30, trajectory: 0 };
            var color      = window.SCScoring.getQuadrantColor(sc.structural, sc.trajectory);
            var size       = window.SCScoring.getNodeSize(entity);
            var isSole     = relationships.some(function(r){ return r.source_entity_id === entity.id && r.is_sole_source; });
            var borderColor = isSole ? '#7c3aed' : '#94a3b8';

            elements.push({
                group: 'nodes',
                data: {
                    id: entity.id,
                    entityId: entity.id,
                    label: entity.name,
                    color: color,
                    size: size,
                    borderColor: borderColor,
                    structural: sc.structural,
                    trajectory: sc.trajectory,
                    sector: entity.industry_sector || '',
                    type: entity.entity_type || '',
                    country: entity.country_code || ''
                }
            });
        });

        relationships.forEach(function(rel) {
            var crit  = rel.criticality_score || 5;
            var width = 1 + (crit / 10) * 4;
            var edgeColor = rel.is_sole_source ? '#7c3aed' : (crit >= 8 ? '#f97316' : '#94a3b8');
            var classes = rel.is_sole_source ? 'sole-source' : '';

            elements.push({
                group: 'edges',
                data: {
                    id: rel.id,
                    source: rel.source_entity_id,
                    target: rel.target_entity_id,
                    width: width,
                    edgeColor: edgeColor,
                    criticality: crit,
                    isSoleSource: rel.is_sole_source
                },
                classes: classes
            });
        });

        cy.elements().remove();
        cy.add(elements);

        runLayout();
        addLegend();
    }

    function runLayout() {
        if (!cy) return;
        var layoutOpts = typeof cola !== 'undefined'
            ? { name: 'cola', animate: true, animationDuration: 800, nodeSpacing: 40, edgeLength: 180, maxSimulationTime: 3000, fit: true, padding: 40 }
            : { name: 'cose', animate: true, animationDuration: 600, nodeRepulsion: 8000, idealEdgeLength: 150, fit: true, padding: 40 };
        cy.layout(layoutOpts).run();
    }

    function addLegend() {
        var existing = _container.querySelector('.sc-graph-legend');
        if (existing) existing.remove();

        var c = window.SCConfig.score.colors;
        var legend = document.createElement('div');
        legend.className = 'sc-graph-legend';
        legend.innerHTML = '<div class="sc-legend-title">Quadrant</div>'
            + '<div class="sc-legend-item"><span class="sc-legend-dot" style="background:' + c.strongLong + '"></span>Strong Long</div>'
            + '<div class="sc-legend-item"><span class="sc-legend-dot" style="background:' + c.emerging + '"></span>Emerging</div>'
            + '<div class="sc-legend-item"><span class="sc-legend-dot" style="background:' + c.tollBooth + '"></span>Toll Booth</div>'
            + '<div class="sc-legend-item"><span class="sc-legend-dot" style="background:' + c.avoid + '"></span>Avoid</div>'
            + '<div class="sc-legend-divider"></div>'
            + '<div class="sc-legend-item"><span class="sc-legend-line sc-legend-line--sole"></span>Sole Source</div>'
            + '<div class="sc-legend-item"><span class="sc-legend-line sc-legend-line--high"></span>High Criticality</div>';
        _container.appendChild(legend);
    }

    function applyFilters(filterState, scores) {
        if (!cy) return;
        _scores = scores || _scores;

        cy.batch(function() {
            cy.nodes().forEach(function(node) {
                var d = node.data();
                var sc = _scores[d.entityId] || { structural: 30, trajectory: 0 };
                var visible = true;

                if (filterState.sectors.length && !filterState.sectors.includes(d.sector)) visible = false;
                if (filterState.entityTypes.length && !filterState.entityTypes.includes(d.type)) visible = false;
                if (filterState.countries.length && !filterState.countries.includes(d.country)) visible = false;
                if (sc.structural < filterState.structuralMin || sc.structural > filterState.structuralMax) visible = false;
                if (sc.trajectory < filterState.trajectoryMin || sc.trajectory > filterState.trajectoryMax) visible = false;
                if (filterState.policyDirections && filterState.policyDirections.length) {
                    var tdir = sc.trajectory >= 10 ? 'tailwind' : sc.trajectory <= -10 ? 'headwind' : 'neutral';
                    if (!filterState.policyDirections.includes(tdir)) visible = false;
                }
                if (filterState.search) {
                    var lbl = (d.label || '').toLowerCase();
                    if (!lbl.includes(filterState.search)) visible = false;
                }

                node.toggleClass('dimmed', !visible);
            });

            cy.edges().forEach(function(edge) {
                var src = cy.getElementById(edge.data('source'));
                var tgt = cy.getElementById(edge.data('target'));
                var hidden = src.hasClass('dimmed') || tgt.hasClass('dimmed');
                edge.toggleClass('dimmed', hidden);
            });
        });
    }

    function focusNode(entityId) {
        if (!cy) return;
        var node = cy.getElementById(entityId);
        if (node && node.length) {
            cy.animate({ fit: { eles: node.neighborhood().add(node), padding: 80 }, duration: 500 });
            node.select();
        }
    }

    function resetView() { if (cy) cy.animate({ fit: { padding: 40 }, duration: 400 }); }

    function exportPNG() {
        if (!cy) return null;
        return cy.png({ full: true, scale: 2, bg: '#ffffff' });
    }

    window.SCGraphView = {
        init: init,
        load: load,
        applyFilters: applyFilters,
        focusNode: focusNode,
        resetView: resetView,
        exportPNG: exportPNG
    };
})();
