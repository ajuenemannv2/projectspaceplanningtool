(function(){
    var _container = null;
    var _activeTab = 'filters';

    function init(container) {
        _container = container;
    }

    // Called after scores are computed; renders the Opportunities tab content
    function render(entities, scores, instruments) {
        if (!_container) return;

        // Build the tab strip (only once)
        if (!_container.querySelector('.sc-tab-bar')) {
            _container.innerHTML = '<div class="sc-tab-bar">'
                + '<button class="sc-tab sc-tab--active" data-tab="filters">Filters</button>'
                + '<button class="sc-tab" data-tab="opportunities">Opportunities</button>'
                + '</div>'
                + '<div id="scTabFilters" class="sc-tab-pane sc-tab-pane--active"></div>'
                + '<div id="scTabOpportunities" class="sc-tab-pane"></div>';

            _container.querySelectorAll('.sc-tab').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    switchTab(btn.dataset.tab);
                });
            });

            // Move the existing filter panel content into the filters pane
            var filterPanel = document.getElementById('scFilterPanel');
            if (filterPanel) {
                document.getElementById('scTabFilters').appendChild(filterPanel);
            }
        }

        renderOpportunityList(entities, scores, instruments);
    }

    function switchTab(tab) {
        _activeTab = tab;
        _container.querySelectorAll('.sc-tab').forEach(function(b) {
            b.classList.toggle('sc-tab--active', b.dataset.tab === tab);
        });
        _container.querySelectorAll('.sc-tab-pane').forEach(function(p) {
            p.classList.toggle('sc-tab-pane--active', p.id === 'scTab' + cap(tab));
        });
    }

    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function renderOpportunityList(entities, scores, instruments) {
        var pane = document.getElementById('scTabOpportunities');
        if (!pane) return;

        var entityById = {};
        entities.forEach(function(e) { entityById[e.id] = e; });

        // Sort investable entities by conviction DESC
        var ranked = entities
            .filter(function(e) { return e.is_investable !== false && scores[e.id]; })
            .map(function(e) {
                var sc = scores[e.id];
                return {
                    entity:     e,
                    structural: sc.structural,
                    trajectory: sc.trajectory,
                    conviction: sc.conviction
                };
            })
            .sort(function(a, b) { return b.conviction - a.conviction; });

        // Score ETFs
        var scoredInstruments = (instruments || [])
            .filter(function(i) { return i.is_investable !== false; })
            .map(function(i) {
                return {
                    instrument: i,
                    conviction: window.SCScoring.scoreInstrument(i, entities, scores)
                };
            })
            .sort(function(a, b) { return b.conviction - a.conviction; });

        var html = '<div class="sc-opp-section">';
        html += '<div class="sc-opp-section-title">Top Stocks · Direct Buy</div>';

        if (!ranked.length) {
            html += '<div class="sc-opp-empty">No investable entities loaded.</div>';
        } else {
            ranked.slice(0, 10).forEach(function(row, i) {
                var e   = row.entity;
                var color = window.SCScoring.getQuadrantColor(row.structural, row.trajectory);
                var label = window.SCScoring.getQuadrantLabel(row.structural, row.trajectory);
                var trajColor = window.SCScoring.getTrajectoryColor(row.trajectory);
                var insight = getInsight(row);
                var exchBadge = e.exchange ? '<span class="sc-opp-exch">' + escapeHtml(e.exchange) + '</span>' : '';
                var liquBadge = e.liquidity_tier === 'otc_adr' ? '<span class="sc-opp-liq-warn" title="OTC ADR — wider spreads, lower liquidity">OTC</span>' : '';

                html += '<div class="sc-opp-card" data-entity-id="' + escapeHtml(e.id) + '">'
                    + '<div class="sc-opp-rank">' + (i + 1) + '</div>'
                    + '<div class="sc-opp-body">'
                    +   '<div class="sc-opp-top">'
                    +     '<span class="sc-opp-ticker">' + escapeHtml(e.ticker_symbol || '?') + '</span>'
                    +     exchBadge + liquBadge
                    +     '<span class="sc-opp-quadrant" style="color:' + color + '">● ' + escapeHtml(label) + '</span>'
                    +   '</div>'
                    +   '<div class="sc-opp-name">' + escapeHtml(e.name) + '</div>'
                    +   '<div class="sc-opp-insight">' + escapeHtml(insight) + '</div>'
                    +   '<div class="sc-opp-scores">'
                    +     '<div class="sc-opp-conviction-bar-wrap">'
                    +       '<div class="sc-opp-conviction-bar" style="width:' + row.conviction + '%;background:' + color + '"></div>'
                    +     '</div>'
                    +     '<span class="sc-opp-conviction-val">' + row.conviction + '</span>'
                    +   '</div>'
                    +   '<div class="sc-opp-sub-scores">'
                    +     'Str <strong>' + row.structural + '</strong>'
                    +     ' · Traj <strong style="color:' + trajColor + '">' + (row.trajectory >= 0 ? '+' : '') + row.trajectory + '</strong>'
                    +   '</div>'
                    + '</div>'
                    + '</div>';
            });
        }

        html += '</div>';

        // ETF / fund recommendations
        if (scoredInstruments.length) {
            html += '<div class="sc-opp-section">';
            html += '<div class="sc-opp-section-title">ETFs &amp; Funds · Basket Exposure</div>';

            scoredInstruments.forEach(function(row) {
                var inst = row.instrument;
                var typeLabel = inst.instrument_type === 'mutual_fund' ? 'Mutual Fund' : inst.instrument_type.toUpperCase();
                var aumStr = inst.aum_usd ? formatAum(inst.aum_usd) : '';
                var erStr  = inst.expense_ratio ? (inst.expense_ratio * 100).toFixed(2) + '% ER' : '';

                html += '<div class="sc-opp-card sc-opp-card--fund">'
                    + '<div class="sc-opp-rank sc-opp-rank--fund">ETF</div>'
                    + '<div class="sc-opp-body">'
                    +   '<div class="sc-opp-top">'
                    +     '<span class="sc-opp-ticker">' + escapeHtml(inst.ticker) + '</span>'
                    +     '<span class="sc-opp-exch">' + escapeHtml(typeLabel) + '</span>'
                    +   '</div>'
                    +   '<div class="sc-opp-name">' + escapeHtml(inst.name) + '</div>'
                    +   '<div class="sc-opp-insight">' + escapeHtml(inst.description || '') + '</div>'
                    +   '<div class="sc-opp-scores">'
                    +     '<div class="sc-opp-conviction-bar-wrap">'
                    +       '<div class="sc-opp-conviction-bar" style="width:' + row.conviction + '%;background:#60a5fa"></div>'
                    +     '</div>'
                    +     '<span class="sc-opp-conviction-val">' + row.conviction + '</span>'
                    +   '</div>'
                    +   (aumStr || erStr
                        ? '<div class="sc-opp-sub-scores">' + (aumStr ? 'AUM ' + aumStr : '') + (aumStr && erStr ? ' · ' : '') + erStr + '</div>'
                        : '')
                    + '</div>'
                    + '</div>';
            });

            html += '</div>';
        }

        pane.innerHTML = html;

        // Wire card clicks → select entity
        pane.querySelectorAll('.sc-opp-card[data-entity-id]').forEach(function(card) {
            card.addEventListener('click', function() {
                var eid = card.dataset.entityId;
                if (eid) window.dispatchEvent(new CustomEvent('sc:node-selected', { detail: { entityId: eid } }));
            });
        });
    }

    function getInsight(row) {
        var e = row.entity;
        var isStrong   = row.structural >= 45;
        var isTailwind = row.trajectory >= 0;
        var sector     = (e.industry_sector || '').replace(/_/g, ' ');

        if (isStrong && isTailwind) {
            if (row.conviction >= 75) return 'Dominant chokepoint with strong policy/CAGR tailwind — highest-conviction long.';
            return 'Strong structural moat + positive trajectory. Compounding candidate.';
        }
        if (!isStrong && isTailwind) {
            return 'Early-cycle play on ' + sector + ' growth. Weaker moat but sector tailwind could re-rate.';
        }
        if (isStrong && !isTailwind) {
            return 'Entrenched position but facing headwinds. Watch-list: buy the dip if policy resolves.';
        }
        return 'Weak moat + negative trajectory. Avoid or short via sector ETF.';
    }

    function formatAum(usd) {
        if (usd >= 1e12) return '$' + (usd / 1e12).toFixed(1) + 'T';
        if (usd >= 1e9)  return '$' + (usd / 1e9).toFixed(1) + 'B';
        if (usd >= 1e6)  return '$' + (usd / 1e6).toFixed(0) + 'M';
        return '$' + usd.toLocaleString();
    }

    window.SCOpportunities = { init: init, render: render, switchTab: switchTab };
})();
