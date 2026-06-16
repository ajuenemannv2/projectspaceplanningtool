(function(){
    var cfg = null;
    function getCfg() { return cfg || (cfg = window.SCConfig); }

    // Safely coerce Postgres numeric/text columns to JS number (fixes string-concat accumulator bug)
    function n(v, fallback) { var x = Number(v); return isFinite(x) ? x : (fallback !== undefined ? fallback : 0); }

    function computeStructural(entity, relationships) {
        var outbound = relationships.filter(function(r){ return r.source_entity_id === entity.id; });
        var inbound  = relationships.filter(function(r){ return r.target_entity_id === entity.id; });

        // Chokepoint: sole-source supplier to important buyers? (0-40)
        var outSole = outbound.filter(function(r){ return r.is_sole_source; }).length;
        var avgOutCrit = outbound.length
            ? outbound.reduce(function(s,r){ return s + n(r.criticality_score, 5); }, 0) / outbound.length
            : 0;
        var chokepointScore = Math.min(40,
            (outSole * 10) + (outbound.length * 1.5) + (avgOutCrit * 1.5)
        );

        // Margin leverage: revenue tier proxy (3-30)
        var rev = n(entity.annual_revenue_usd);
        var marginScore = rev > 50e9 ? 30
            : rev > 10e9 ? 26
            : rev > 3e9  ? 20
            : rev > 5e8  ? 13
            : rev > 5e7  ? 7
            : 3;

        // Structural bottleneck: sole-sourced inputs = fragile power (0-30)
        var inSole = inbound.filter(function(r){ return r.is_sole_source; }).length;
        var bottleneckScore = Math.min(30, inSole * 10 + Math.min(10, inbound.length * 1.5));

        return Math.min(100, Math.round(chokepointScore + marginScore + bottleneckScore));
    }

    function computeTrajectory(entity, policyImpacts, sectorTrends, billImpacts) {
        var c = getCfg();

        // Demand CAGR component (-50 to +50)
        var trend = null;
        for (var i = 0; i < sectorTrends.length; i++) {
            if (sectorTrends[i].sector === entity.industry_sector) { trend = sectorTrends[i]; break; }
        }
        var cagr = trend ? n(trend.cagr_10yr_est) : 0;
        var demandScore = Math.max(-50, Math.min(50,
            (cagr - n(c.scoring.baselineCagr, 3)) / 20 * 50
        ));

        // Policy net: enacted/confirmed policies (-35 to +35)
        var entityPolicies = policyImpacts.filter(function(pi){ return pi.entity_id === entity.id; });
        var policyNet = 0;
        entityPolicies.forEach(function(pi) {
            var sign = pi.impact_direction === 'tailwind' ? 1 : pi.impact_direction === 'headwind' ? -1 : 0;
            var mag  = n(pi.impact_magnitude, n(pi.sc_policy_events && pi.sc_policy_events.impact_magnitude, 5));
            var dur  = n(pi.durability_weight, n(pi.sc_policy_events && pi.sc_policy_events.durability_weight, 0.5));
            policyNet += mag * sign * dur;
        });
        var policyScore = Math.max(-35, Math.min(35,
            policyNet / n(c.scoring.maxPolicyNet, 15) * 35
        ));

        // Bill/legislation net: pending bills (-15 to +15, discounted vs. enacted policy)
        var entityBills = (billImpacts || []).filter(function(bi){ return bi.entity_id === entity.id; });
        var billNet = 0;
        entityBills.forEach(function(bi) {
            var sign = bi.impact_direction === 'tailwind' ? 1 : bi.impact_direction === 'headwind' ? -1 : 0;
            var mag  = n(bi.impact_magnitude, 5);
            var dur  = n(bi.durability_weight, 0.5);
            billNet += mag * sign * dur;
        });
        var billScore = Math.max(-15, Math.min(15,
            billNet / n(c.scoring.maxPolicyNet, 15) * 15
        ));

        return Math.round(demandScore + policyScore + billScore);
    }

    // Composite conviction: high-growth tilted (65% trajectory, 35% structural)
    function computeConviction(structural, trajectory, entity) {
        if (entity && entity.is_investable === false) return 0;

        var trajNorm = (trajectory + 100) / 200 * 65;  // -100..+100 → 0..65
        var strNorm  = structural / 100 * 35;           //   0..100   → 0..35
        var base     = Math.round(trajNorm + strNorm);  // 0..100

        // OTC/ADR liquidity discount (wider spreads, harder to exit at size)
        if (entity && entity.liquidity_tier === 'otc_adr') base = Math.max(0, base - 8);

        return Math.max(0, Math.min(100, base));
    }

    function computeAll(entities, relationships, policyImpacts, sectorTrends, billImpacts) {
        var scores = {};
        entities.forEach(function(entity) {
            var structural = computeStructural(entity, relationships);
            var trajectory = computeTrajectory(entity, policyImpacts, sectorTrends, billImpacts || []);
            var conviction = computeConviction(structural, trajectory, entity);
            scores[entity.id] = { structural: structural, trajectory: trajectory, conviction: conviction };
        });
        return scores;
    }

    // ETF-level conviction: average conviction of investable entities in target sectors
    function scoreInstrument(instrument, entities, scores) {
        var sectors = instrument.target_sectors || [];
        if (!sectors.length) return 0;
        var total = 0, count = 0;
        entities.forEach(function(e) {
            if (sectors.indexOf(e.industry_sector) >= 0 && scores[e.id] && e.is_investable !== false) {
                total += scores[e.id].conviction;
                count++;
            }
        });
        return count ? Math.round(total / count) : 0;
    }

    function getQuadrantColor(structural, trajectory) {
        var c = getCfg().score.colors;
        var isStrong   = structural >= 45;
        var isTailwind = trajectory >= 0;
        if (isStrong && isTailwind)   return c.strongLong;
        if (!isStrong && isTailwind)  return c.emerging;
        if (isStrong && !isTailwind)  return c.tollBooth;
        return c.avoid;
    }

    function getQuadrantLabel(structural, trajectory) {
        var isStrong   = structural >= 45;
        var isTailwind = trajectory >= 0;
        if (isStrong && isTailwind)   return 'Strong Long';
        if (!isStrong && isTailwind)  return 'Emerging';
        if (isStrong && !isTailwind)  return 'Toll Booth (Watch)';
        return 'Avoid / Short';
    }

    function getTrajectoryColor(trajectory) {
        var c = getCfg().score.trajectoryColors;
        if (trajectory >= 40)  return c.strongTailwind;
        if (trajectory >= 10)  return c.mildTailwind;
        if (trajectory >= -10) return c.neutral;
        if (trajectory >= -40) return c.mildHeadwind;
        return c.strongHeadwind;
    }

    function getNodeSize(entity) {
        var c = getCfg().graph;
        var rev = Math.max(c.revenueMin, Math.min(c.revenueMax, n(entity.annual_revenue_usd, c.revenueMin)));
        var ratio = (Math.log(rev) - Math.log(c.revenueMin)) / (Math.log(c.revenueMax) - Math.log(c.revenueMin));
        return Math.round(c.nodeMinPx + ratio * (c.nodeMaxPx - c.nodeMinPx));
    }

    window.SCScoring = {
        computeAll: computeAll,
        computeStructural: computeStructural,
        computeTrajectory: computeTrajectory,
        computeConviction: computeConviction,
        scoreInstrument: scoreInstrument,
        getQuadrantColor: getQuadrantColor,
        getQuadrantLabel: getQuadrantLabel,
        getTrajectoryColor: getTrajectoryColor,
        getNodeSize: getNodeSize
    };
})();
