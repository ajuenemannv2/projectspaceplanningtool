(function(){
    var _drawer  = null;
    var _content = null;
    var _currentId = null;

    function init(drawer) {
        _drawer  = drawer;
        _content = drawer.querySelector('#scDrawerContent');
        var closeBtn = drawer.querySelector('#scDrawerClose');
        if (closeBtn) closeBtn.addEventListener('click', close);
        window.addEventListener('sc:node-deselected', close);
    }

    function open(entityId) {
        _currentId = entityId;
        _drawer.classList.add('sc-drawer--open');
        render('<div class="sc-loading-spinner"></div>');
        window.SCData.fetchEntityDetail(entityId).then(function(detail) {
            if (_currentId !== entityId) return;
            renderDetail(detail);
        }).catch(function(err) {
            render('<div class="sc-detail-error">Failed to load entity details.</div>');
            LOG.error('Detail fetch error', err);
        });
    }

    function close() {
        _drawer.classList.remove('sc-drawer--open');
        _currentId = null;
    }

    function render(html) { if (_content) _content.innerHTML = html; }

    function renderDetail(detail) {
        var entity   = detail.entity;
        var sc       = (window._scScoresCache || {})[entity.id] || { structural: 30, trajectory: 0 };
        var color    = window.SCScoring.getQuadrantColor(sc.structural, sc.trajectory);
        var quadrant = window.SCScoring.getQuadrantLabel(sc.structural, sc.trajectory);
        var trajColor = window.SCScoring.getTrajectoryColor(sc.trajectory);
        var html = '';

        html += '<div class="sc-detail-header" style="border-left:4px solid ' + color + '">'
            + '<div class="sc-detail-name">' + escapeHtml(entity.name) + '</div>'
            + '<div class="sc-detail-meta">'
            + '<span class="sc-badge sc-badge--type">' + escapeHtml(entity.entity_type || '') + '</span>'
            + '<span class="sc-badge" style="background:' + color + ';color:#fff">' + escapeHtml(quadrant) + '</span>'
            + '</div>'
            + (entity.ticker_symbol ? '<div class="sc-detail-ticker">$' + escapeHtml(entity.ticker_symbol) + '</div>' : '')
            + '</div>';

        var strPct  = Math.round(Math.min(100, Math.max(0, sc.structural)));
        var trajAbs = Math.abs(sc.trajectory);
        html += '<div class="sc-detail-section">'
            + '<div class="sc-detail-section-title">Signal Scores</div>'
            + '<div class="sc-score-row">'
            + '<span class="sc-score-label">Structural Power</span>'
            + '<div class="sc-score-bar-wrap"><div class="sc-score-bar" style="width:' + strPct + '%;background:' + color + '"></div></div>'
            + '<span class="sc-score-val">' + strPct + '</span>'
            + '</div>'
            + '<div class="sc-score-row">'
            + '<span class="sc-score-label">Trajectory</span>'
            + '<div class="sc-score-bar-wrap sc-score-bar-wrap--traj"><div class="sc-score-bar-center"></div>'
            + '<div class="sc-score-bar sc-score-bar--traj" style="width:' + (trajAbs / 2) + '%;' + (sc.trajectory >= 0 ? 'left:50%' : 'right:50%') + ';background:' + trajColor + '"></div></div>'
            + '<span class="sc-score-val" style="color:' + trajColor + '">' + (sc.trajectory >= 0 ? '+' : '') + Math.round(sc.trajectory) + '</span>'
            + '</div>'
            + '</div>';

        html += '<div class="sc-detail-section">'
            + '<div class="sc-detail-section-title">Entity Info</div>'
            + '<div class="sc-info-grid">'
            + kv('Sector', (entity.industry_sector || '').replace(/_/g,' '))
            + kv('Country', entity.country_code || '—')
            + kv('City', entity.city || '—')
            + kv('Size', entity.company_size || '—')
            + kv('Revenue', entity.annual_revenue_usd ? '$' + fmtRev(entity.annual_revenue_usd) : '—')
            + '</div>'
            + (entity.description ? '<div class="sc-detail-desc">' + escapeHtml(entity.description) + '</div>' : '')
            + '</div>';

        var policies = detail.policyImpacts || [];
        var bills    = detail.billImpacts || [];
        if (policies.length || bills.length) {
            html += '<div class="sc-detail-section"><div class="sc-detail-section-title">Policy Exposure</div>';
            policies.forEach(function(pi) {
                var pol   = pi.policy || pi.sc_policy_events || {};
                var pdir  = pi.impact_direction || pol.impact_direction || 'neutral';
                var icon  = pdir === 'tailwind' ? '↑' : pdir === 'headwind' ? '↓' : '→';
                var pc    = pdir === 'tailwind' ? '#10b981' : pdir === 'headwind' ? '#ef4444' : '#94a3b8';
                html += '<div class="sc-policy-item"><span class="sc-policy-icon" style="color:' + pc + '">' + icon + '</span>'
                    + '<div class="sc-policy-body"><div class="sc-policy-title">' + escapeHtml(pol.title || 'Policy') + '</div>'
                    + (pi.analyst_notes ? '<div class="sc-policy-notes">' + escapeHtml(pi.analyst_notes) + '</div>' : '')
                    + '</div></div>';
            });
            bills.forEach(function(bi) {
                var bill  = bi.bill || bi.gov_bills || {};
                var bdir  = bi.impact_direction || 'neutral';
                var icon  = bdir === 'tailwind' ? '↑' : bdir === 'headwind' ? '↓' : '→';
                var pc    = bdir === 'tailwind' ? '#10b981' : bdir === 'headwind' ? '#ef4444' : '#94a3b8';
                var total = (bill.lobbying_for_usd || 0) + (bill.lobbying_against_usd || 0);
                var ratio = total > 0 ? Math.round((bill.lobbying_for_usd || 0) / total * 100) : null;
                html += '<div class="sc-policy-item sc-bill-item"><span class="sc-policy-icon" style="color:' + pc + '">' + icon + '</span>'
                    + '<div class="sc-policy-body"><div class="sc-policy-title">' + escapeHtml(bill.title || 'Bill') + '</div>'
                    + '<div class="sc-policy-meta"><span class="sc-badge sc-badge--stage">' + escapeHtml((bill.stage || '').replace(/_/g,' ')) + '</span>'
                    + (ratio !== null ? '<span class="sc-lobby-ratio">' + ratio + '% industry for</span>' : '')
                    + '</div>'
                    + (bi.notes ? '<div class="sc-policy-notes">' + escapeHtml(bi.notes) + '</div>' : '')
                    + '</div></div>';
            });
            html += '</div>';
        }

        var outbound = detail.outbound || [];
        var inbound  = detail.inbound || [];
        if (outbound.length || inbound.length) {
            html += '<div class="sc-detail-section"><div class="sc-detail-section-title">Supply Relationships</div>';
            if (outbound.length) {
                html += '<div class="sc-rel-group-title">Supplies to (' + outbound.length + ')</div><div class="sc-rel-chips">';
                outbound.forEach(function(r) {
                    var tgt = r.target || {};
                    html += '<div class="sc-rel-chip" data-entity-id="' + escapeHtml(tgt.id || '') + '">'
                        + (r.is_sole_source ? '<span class="sc-rel-sole" title="Sole source">★</span>' : '')
                        + escapeHtml(tgt.name || '?')
                        + (r.criticality_score >= 8 ? '<span class="sc-rel-crit">!</span>' : '')
                        + '</div>';
                });
                html += '</div>';
            }
            if (inbound.length) {
                html += '<div class="sc-rel-group-title">Supplied by (' + inbound.length + ')</div><div class="sc-rel-chips">';
                inbound.forEach(function(r) {
                    var src = r.source || {};
                    html += '<div class="sc-rel-chip" data-entity-id="' + escapeHtml(src.id || '') + '">'
                        + (r.is_sole_source ? '<span class="sc-rel-sole" title="Sole source">★</span>' : '')
                        + escapeHtml(src.name || '?')
                        + (r.criticality_score >= 8 ? '<span class="sc-rel-crit">!</span>' : '')
                        + '</div>';
                });
                html += '</div>';
            }
            html += '</div>';
        }

        render(html);
        _content.querySelectorAll('.sc-rel-chip[data-entity-id]').forEach(function(chip) {
            chip.addEventListener('click', function() {
                var eid = chip.dataset.entityId;
                if (eid) window.dispatchEvent(new CustomEvent('sc:node-selected', { detail: { entityId: eid } }));
            });
        });
    }

    function kv(label, value) {
        return '<div class="sc-kv"><span class="sc-kv-label">' + escapeHtml(label) + '</span>'
            + '<span class="sc-kv-value">' + escapeHtml(String(value)) + '</span></div>';
    }

    function fmtRev(num) {
        if (num >= 1e12) return (num/1e12).toFixed(1)+'T';
        if (num >= 1e9)  return (num/1e9).toFixed(1)+'B';
        if (num >= 1e6)  return (num/1e6).toFixed(1)+'M';
        return num.toLocaleString();
    }

    window.SCDetailPanel = { init: init, open: open, close: close };
})();
