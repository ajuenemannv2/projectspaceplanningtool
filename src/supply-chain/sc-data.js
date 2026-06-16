(function(){
    var client = null;

    function getClient() {
        if (!client) client = window.getSupabaseClient();
        return client;
    }

    async function fetchAll() {
        var db = getClient();
        if (!db) throw new Error('Supabase client not available');

        var [entRes, relRes, polRes, piRes, stRes, billRes, biRes, instrRes] = await Promise.all([
            db.from('sc_entities').select('*').order('name'),
            db.from('sc_relationships').select('*'),
            db.from('sc_policy_events').select('*').order('effective_date', { ascending: false }),
            db.from('sc_policy_entity_impacts').select('*, sc_policy_events(title, policy_type, impact_magnitude, durability_weight, effective_date, impact_direction)'),
            db.from('sc_sector_trends').select('*'),
            db.from('gov_bills').select('*').order('introduced_date', { ascending: false }),
            db.from('gov_bill_entity_impacts').select('*, gov_bills(title, stage, impact_direction, impact_magnitude, lobbying_for_usd, lobbying_against_usd)'),
            db.from('sc_instruments').select('*').order('aum_usd', { ascending: false, nullsFirst: false })
        ]);

        if (entRes.error)  throw entRes.error;
        if (relRes.error)  throw relRes.error;

        return {
            entities:      entRes.data  || [],
            relationships: relRes.data  || [],
            policyEvents:  polRes.data  || [],
            policyImpacts: piRes.data   || [],
            sectorTrends:  stRes.data   || [],
            bills:         billRes.data || [],
            billImpacts:   biRes.data   || [],
            instruments:   instrRes.data || []
        };
    }

    async function fetchEntityDetail(entityId) {
        var db = getClient();
        if (!db) throw new Error('Supabase client not available');

        var [entRes, outRes, inRes, piRes, biRes] = await Promise.all([
            db.from('sc_entities').select('*').eq('id', entityId).single(),
            db.from('sc_relationships').select('*, target:target_entity_id(id,name,industry_sector,country_code,entity_type)').eq('source_entity_id', entityId),
            db.from('sc_relationships').select('*, source:source_entity_id(id,name,industry_sector,country_code,entity_type)').eq('target_entity_id', entityId),
            db.from('sc_policy_entity_impacts').select('*, policy:policy_event_id(*)').eq('entity_id', entityId),
            db.from('gov_bill_entity_impacts').select('*, bill:bill_id(*)').eq('entity_id', entityId)
        ]);

        return {
            entity:        entRes.data,
            outbound:      outRes.data || [],
            inbound:       inRes.data  || [],
            policyImpacts: piRes.data  || [],
            billImpacts:   biRes.data  || []
        };
    }

    async function persistScores(scores, entityById) {
        var db = getClient();
        if (!db) return;
        var rows = Object.keys(scores).map(function(id) {
            var s = scores[id];
            return {
                entity_id:        id,
                score_structural: s.structural,
                score_trajectory: s.trajectory,
                score_conviction: s.conviction,
                as_of_date:       new Date().toISOString().slice(0, 10),
                computed_at:      new Date().toISOString()
            };
        });
        await db.from('sc_opportunity_scores').upsert(rows, { onConflict: 'entity_id' });
    }

    window.SCData = {
        fetchAll:        fetchAll,
        fetchEntityDetail: fetchEntityDetail,
        persistScores:   persistScores
    };
})();
