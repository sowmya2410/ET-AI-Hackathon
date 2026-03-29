/**
 * GCN D2C Fintech — Scoring Functions
 *
 * Used by Agent 2 (D2C Persona Matcher).
 *
 * Two independent scoring methods are combined (60% rule, 40% vector) to
 * select the best writer persona for a given D2C profile.
 */

import { PERSONAS } from '../data/vectorDb.js';

/**
 * simScore — cosine-like similarity between a query profile and a Vector DB record.
 *
 * Weights (must sum to 1.0):
 *   0.35  segment match
 *   0.25  product match
 *   0.20  intent match
 *   0.20  channel overlap (Jaccard)
 *
 * @param {object} query   - structured profile from Agent 1
 * @param {object} record  - one row from VECTOR_DB
 * @returns {number} similarity score in [0, 1]
 */
export function simScore(query, record) {
  let s = 0;

  if (query.consumer_segment === record.segment)  s += 0.35;
  if (query.product_category  === record.product)  s += 0.25;
  if (query.campaign_intent   === record.intent)   s += 0.20;

  // Jaccard channel overlap
  const queryChannels  = query.channel_mix || [];
  const overlap = queryChannels.filter(c => record.channels.includes(c)).length;
  const union   = new Set([...queryChannels, ...record.channels]).size;
  s += 0.20 * (union > 0 ? overlap / union : 0);

  return Math.round(s * 1000) / 1000;
}

/**
 * ruleScore — deterministic rule-based persona scoring.
 *
 * Each persona has hard-coded affinities for segment, channel, intent, and
 * product category derived from the GCN D2C Fintech persona specification.
 * Returns a raw integer score (not normalised).
 *
 * Persona specs (from PDF):
 *   The Hustler   — Gen Z, Instagram/Shorts, Acquisition/Referral/Feature Adoption
 *   The Planner   — Millennial, Blog/Email, Acquisition/Education/Retention
 *   The Neighbour — Bharat, SMS/WhatsApp/IVR, vernacular flag
 *   The Advisor   — Millennial investor, Blog/Push, Education/Retention, Savings/Insurance
 *   The Trustee   — All segments, Email/In-app, Grievance intent
 *
 * @param {string} persona - one of PERSONAS
 * @param {object} q       - structured profile from Agent 1
 * @returns {number} raw score
 */
export function ruleScore(persona, q) {
  let s = 0;
  const seg    = q.consumer_segment;
  const prod   = q.product_category;
  const intent = q.campaign_intent;
  const ch     = q.channel_mix || [];
  const vern   = q.vernacular_required;

  if (persona === 'The Hustler') {
    if (seg === 'Gen Z (18-25)')                                           s += 30;
    if (['Instagram', 'YouTube Shorts'].some(c => ch.includes(c)))        s += 20;
    if (['Acquisition', 'Referral/Growth', 'Feature Adoption'].includes(intent)) s += 20;
    if (['Personal Loan', 'UPI/Payments', 'Credit Card'].includes(prod))  s += 15;
  }

  if (persona === 'The Planner') {
    if (seg === 'Millennial (26-38)')                                      s += 30;
    if (['Blog', 'Email'].some(c => ch.includes(c)))                      s += 20;
    if (['Acquisition', 'Education', 'Retention'].includes(intent))       s += 15;
    if (['Personal Loan', 'Neo-bank', 'Credit Card'].includes(prod))      s += 15;
  }

  if (persona === 'The Neighbour') {
    if (seg === 'Bharat (Tier 2/3 vernacular)')                           s += 40;
    if (vern)                                                              s += 20;
    if (['SMS', 'WhatsApp', 'IVR'].some(c => ch.includes(c)))             s += 15;
    if (['Personal Loan', 'UPI/Payments', 'Education/FAQ'].includes(prod)) s += 10;
  }

  if (persona === 'The Advisor') {
    if (seg === 'Millennial (26-38)')                                      s += 20;
    if (['Blog', 'Email'].some(c => ch.includes(c)))                      s += 15;
    if (['Education', 'Retention'].includes(intent))                      s += 20;
    if (['Wallet/Savings', 'Insurance', 'Neo-bank'].includes(prod))       s += 25;
  }

  if (persona === 'The Trustee') {
    if (intent === 'Grievance')                                            s += 50;
    if (['Email', 'In-app Banner'].some(c => ch.includes(c)))             s += 15;
    if (prod === 'Grievance')                                              s += 20;
  }

  return s;
}

/**
 * combineScores — merges rule scores and vector DB votes into a final ranking.
 *
 * Formula: combined = 0.6 × (ruleScore / maxRule) + 0.4 × (vectorVote / maxVote)
 * Returns an array sorted descending by combined score.
 *
 * @param {object} votes      - { personaName: totalSimScore, ... }
 * @param {object} q          - structured profile from Agent 1
 * @returns {Array<{persona, ruleScore, vectorVote, combined}>}
 */
export function combineScores(votes, q) {
  const ruleScores = PERSONAS.map(p => ({ persona: p, rule: ruleScore(p, q) }));
  const maxRule = Math.max(...ruleScores.map(r => r.rule)) || 1;
  const maxVote = Math.max(...Object.values(votes))         || 1;

  const combined = PERSONAS.map(p => {
    const rs = ruleScores.find(r => r.persona === p).rule / maxRule;
    const vs = (votes[p] || 0) / maxVote;
    return {
      persona:     p,
      ruleScore:   ruleScores.find(r => r.persona === p).rule,
      vectorVote:  Math.round((votes[p] || 0) * 100) / 100,
      combined:    Math.round((0.6 * rs + 0.4 * vs) * 100),
    };
  });

  combined.sort((a, b) => b.combined - a.combined);
  return combined;
}
