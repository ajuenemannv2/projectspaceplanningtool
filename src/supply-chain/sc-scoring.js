(function(){
    var cfg = null;
    function getCfg() { return cfg || (cfg = window.SCConfig); }

    function computeStructural(entity, relationships) {
        var outbound = relationships.filter(function(r){ return r.source_entity_id === entity.id; });
        var inbound  = relationships.filter(function(r){ return r.target_entity_id === entity.id; });

        // Chokepoint: are you sole-source to important buyers? (0-40)
        var outSole = outbound.filter(function(r){ return r.is_sole_source; }).length;
        var avgOutCrit = outbound.length
            ? outbound.reduce(function(s,r){ return s + (r.criticality_score||5); }, 0) / outbound.length
            : 0;
        var chokepointScore = Math.min(40,
            (outSole * 10) + (outbound.length * 1.5) + (avgOutCrit * 1.5)
        );

        // Margin leverage: revenue tier proxy (0-30)
        var rev = entity.annual_revenue_usd || 0;
        var marginScore = rev > 50000000000 ? 30
            : rev > 10000000000 ? 26
            : rev > 3000000000  ? 20
            : rev > 500000000   ? 13
            : rev > 50000000    ? 7
            : 3;

        // Structural bottleneck: are your inputs sole-sourced? High = fragile power (0-30)
        var inSole = inbound.filter(function(r){ return r.is_sole_source; }).length;
        var bottleneckScore = Math.min(30, inSole * 10 + Math.min(10, inbound.length * 1.5));

        return Math.min(100, Math.round(chokepointScore + marginScore + bottleneckScore));
    }

    function computeTrajectory(entity, policyImpacts, sectorTrends) {
        var c = getCfg();

        // Demand CAGR component (-50 to +50)
        var trend = null;
        for (var i = 0; i < sectorTrends.length; i++) {
            if (sectorTrends[i].sector === entity.industry_sector) { trend = sectorTrends[i]; break; }
        }
        var cagr = trend ? (trend.cagr_10yr_est || 0) : 0;
        var demandScore = Math.max(-50, Math.min(50,
            (cagr - c.scoring.baselineCagr) / 20 * 50
        ));

        // Policy net component (-50 to +50) — durable policies weighted higher
        var entityPolicies = policyImpacts.filter(function(pi){ return pi.entity_id === entity.id; });
        var policyNet = 0;
        entityPolicies.forEach(function(pi) {
            var sign = pi.impact_direction === 'tailwind' ? 1 : pi.impact_direction === 'headwind' ? -1 : 0;
            var mag  = pi.impact_magnitude != null ? pi.impact_magnitude : (pi.sc_policy_events ? pi.sc_policy_events.impact_magnitude : 5) || 5;
            var dur  = pi.durability_weight != null ? pi.durability_weight : (pi.sc_policy_events ? pi.sc_policy_events.durability_weight : 0.5) || 0.5;
            policyNet += mag * sign * dur;
        });
        var policyScore = Math.max(-50, Math.min(50,
            policyNet / c.scoring.maxPolicyNet * 50
        ));

        return Math.round(demandScore + policyScore);
    }

    function computeAll(entities, relationships, policyImpacts, sectorTrends) {
        var scores = {};
        entities.forEach(function(entity) {
            var structural  = computeStructural(entity, relationships);
            var trajectory  = computeTrajectory(entity, policyImpacts, sectorTrends);
            scores[entity.id] = { structural: structural, trajectory: trajectory };
        });
        return scores;
    }

    function getQuadrantColor(structural, trajectory) {
        var c = getCfg().score.colors;
        var isStrong = structural >= 45;
        var isTailwind = trajectory >= 0;
        if (isStrong && isTailwind)   return c.strongLong;
        if (!isStrong && isTailwind)  return c.emerging;
        if (isStrong && !isTailwind)  return c.tollBooth;
        return c.avoid;
    }

    function getQuadrantLabel(structural, trajectory) {
        var isStrong = structural >= 45;
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
        var rev = entity.annual_revenue_usd || c.revenueMin;
        rev = Math.max(c.revenueMin, Math.min(c.revenueMax, rev));
        var logMin = Math.log(c.revenueMin);
        var logMax = Math.log(c.revenueMax);
        var ratio  = (Math.log(rev) - logMin) / (logMax - logMin);
        return Math.round(c.nodeMinPx + ratio * (c.nodeMaxPx - c.nodeMinPx));
    }

    window.SCScoring = {
        computeAll: computeAll,
        computeStructural: computeStructural,
        computeTrajectory: computeTrajectory,
        getQuadrantColor: getQuadrantColor,
        getQuadrantLabel: getQuadrantLabel,
        getTrajectoryColor: getTrajectoryColor,
        getNodeSize: getNodeSize
    };
})();
