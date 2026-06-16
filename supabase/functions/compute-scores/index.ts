/**
 * compute-scores Edge Function
 *
 * Runs the same two-axis scoring model as the browser client,
 * then upserts results to sc_opportunity_scores.
 *
 * Schedule via Supabase Dashboard → Cron Jobs:
 *   0 6 * * 1   (every Monday at 06:00 UTC)
 *
 * Or call manually: POST /functions/v1/compute-scores
 * with Authorization: Bearer <anon-key>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BASELINE_CAGR    = 3.0;
const MAX_POLICY_NET   = 15.0;
const REVENUE_MIN      = 500_000_000;
const REVENUE_MAX      = 400_000_000_000;
const NODE_MIN_PX      = 22;
const NODE_MAX_PX      = 58;

// ---------- helpers ----------

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return isFinite(x) ? x : fallback;
}

function structural(entity: Record<string, unknown>, rels: Record<string, unknown>[]): number {
  const outbound = rels.filter((r) => r.source_entity_id === entity.id);
  const inbound  = rels.filter((r) => r.target_entity_id === entity.id);

  const outSole    = outbound.filter((r) => r.is_sole_source).length;
  const avgOutCrit = outbound.length
    ? outbound.reduce((s, r) => s + n(r.criticality_score, 5), 0) / outbound.length
    : 0;
  const chokepoint = Math.min(40, outSole * 10 + outbound.length * 1.5 + avgOutCrit * 1.5);

  const rev = n(entity.annual_revenue_usd);
  const margin = rev > 50e9 ? 30 : rev > 10e9 ? 26 : rev > 3e9 ? 20 : rev > 5e8 ? 13 : rev > 5e7 ? 7 : 3;

  const inSole     = inbound.filter((r) => r.is_sole_source).length;
  const bottleneck = Math.min(30, inSole * 10 + Math.min(10, inbound.length * 1.5));

  return Math.min(100, Math.round(chokepoint + margin + bottleneck));
}

function trajectory(
  entity: Record<string, unknown>,
  policyImpacts: Record<string, unknown>[],
  sectorTrends: Record<string, unknown>[],
  billImpacts: Record<string, unknown>[]
): number {
  const trend = sectorTrends.find((t) => t.sector === entity.industry_sector);
  const cagr  = trend ? n(trend.cagr_10yr_est) : 0;
  const demand = Math.max(-50, Math.min(50, (cagr - BASELINE_CAGR) / 20 * 50));

  const myPolicies = policyImpacts.filter((pi) => pi.entity_id === entity.id);
  let policyNet = 0;
  for (const pi of myPolicies) {
    const sign = pi.impact_direction === 'tailwind' ? 1 : pi.impact_direction === 'headwind' ? -1 : 0;
    const mag  = n(pi.impact_magnitude, 5);
    const dur  = n(pi.durability_weight, 0.5);
    policyNet += mag * sign * dur;
  }
  const policy = Math.max(-35, Math.min(35, policyNet / MAX_POLICY_NET * 35));

  const myBills = billImpacts.filter((bi) => bi.entity_id === entity.id);
  let billNet = 0;
  for (const bi of myBills) {
    const sign = bi.impact_direction === 'tailwind' ? 1 : bi.impact_direction === 'headwind' ? -1 : 0;
    const mag  = n(bi.impact_magnitude, 5);
    const dur  = n(bi.durability_weight, 0.5);
    billNet += mag * sign * dur;
  }
  const bill = Math.max(-15, Math.min(15, billNet / MAX_POLICY_NET * 15));

  return Math.round(demand + policy + bill);
}

function conviction(str: number, traj: number, entity: Record<string, unknown>): number {
  if (entity.is_investable === false) return 0;
  const base = Math.round((traj + 100) / 200 * 65 + str / 100 * 35);
  const penalty = entity.liquidity_tier === 'otc_adr' ? 8 : 0;
  return Math.max(0, Math.min(100, base - penalty));
}

// ---------- handler ----------

Deno.serve(async (req) => {
  // Allow CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const url     = Deno.env.get('SUPABASE_URL')!;
  const key     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db      = createClient(url, key);

  try {
    // Fetch all needed data in parallel
    const [entRes, relRes, piRes, stRes, biRes] = await Promise.all([
      db.from('sc_entities').select('*'),
      db.from('sc_relationships').select('*'),
      db.from('sc_policy_entity_impacts').select('*'),
      db.from('sc_sector_trends').select('*'),
      db.from('gov_bill_entity_impacts').select('*'),
    ]);

    if (entRes.error) throw entRes.error;
    if (relRes.error) throw relRes.error;

    const entities      = entRes.data ?? [];
    const relationships = relRes.data ?? [];
    const policyImpacts = piRes.data   ?? [];
    const sectorTrends  = stRes.data   ?? [];
    const billImpacts   = biRes.data   ?? [];

    const today  = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const rows = entities.map((entity: Record<string, unknown>) => {
      const str  = structural(entity, relationships);
      const traj = trajectory(entity, policyImpacts, sectorTrends, billImpacts);
      const conv = conviction(str, traj, entity);
      return {
        entity_id:        entity.id,
        score_structural: str,
        score_trajectory: traj,
        score_conviction: conv,
        as_of_date:       today,
        computed_at:      nowIso,
      };
    });

    const { error: upsertErr } = await db
      .from('sc_opportunity_scores')
      .upsert(rows, { onConflict: 'entity_id' });

    if (upsertErr) throw upsertErr;

    return Response.json({
      ok:       true,
      computed: rows.length,
      as_of:    today,
      top5:     rows
        .filter((r) => r.score_conviction > 0)
        .sort((a, b) => b.score_conviction - a.score_conviction)
        .slice(0, 5)
        .map((r) => ({ entity_id: r.entity_id, conviction: r.score_conviction }))
    });

  } catch (err) {
    console.error('compute-scores error', err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
