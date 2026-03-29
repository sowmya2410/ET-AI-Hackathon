/**
 * GCN D2C Fintech — Agent 2: D2C Persona Matcher
 *
 * Model: Small model (claude-haiku via puter.js) + in-memory Vector DB
 *
 * Responsibility (per GCN spec):
 *   Selects the best writer persona from the D2C library using a two-step approach:
 *
 *   Step 1 — Vector DB retrieval
 *     Retrieves top-3 most similar past campaign runs from the Vector DB.
 *     Similarity is scored on segment × product × channel × intent.
 *
 *   Step 2 — Rule-based scoring
 *     Scores all 5 personas using deterministic rules derived from the GCN
 *     persona specification (segment affinity, channel fit, intent match).
 *
 *   Step 3 — Combined decision
 *     Merges rule score (60%) and vector vote (40%) to rank personas.
 *     If best combined score < 40 → fallback to Planner (conservative default).
 *
 *   Step 4 — LLM reasoning
 *     Generates 2-3 sentence natural-language justification via LLM.
 *
 * Handoff:
 *   Returns a handoff payload → Agent 3 (D2C Writer Agent):
 *     selected_persona, consumer_segment, product_category, campaign_intent,
 *     channel_mix, compliance_risk, vernacular_required, key_compliance_flags,
 *     hustler_flag, match_confidence, fallback_applied, top_vector_match
 *
 * Failure recovery:
 *   - Low confidence → Planner default + low-confidence flag logged
 *   - Hustler persona → stricter compliance threshold flagged for Agent 3/4
 */

import { agentLog, setStatus, setTrack, sleep } from '../utils/logger.js';
import { VECTOR_DB, PERSONAS }                   from '../data/vectorDb.js';
import { simScore, combineScores }               from '../utils/scoring.js';

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run Agent 2 with the structured profile from Agent 1.
 *
 * @param {object} profile - D2C profile from Agent 1
 * @returns {Promise<object>} handoff payload for Agent 3
 */
export async function runAgent2(profile) {
  setStatus('a2', 'running');
  setTrack('track-a2', 'running');
  document.getElementById('out-a2').style.display = 'none';

  agentLog('a2', 'Received profile from Agent 1');
  agentLog('a2', `Segment: ${profile.consumer_segment} | Product: ${profile.product_category}`);

  // ── Step 1: Vector DB similarity retrieval ────────────────────────────
  agentLog('a2', 'Step 1: Querying Vector DB for top-3 similar past runs...', 'active');
  await sleep(300);

  const scored = VECTOR_DB
    .map(r => ({ ...r, sim: simScore(profile, r) }))
    .sort((a, b) => b.sim - a.sim);
  const top3 = scored.slice(0, 3);

  agentLog('a2', `Top match: ${top3[0].persona} (sim ${Math.round(top3[0].sim * 100)}%)`);

  // ── Step 2: Rule-based scoring ────────────────────────────────────────
  agentLog('a2', 'Step 2: Running rule-based scoring across all personas...', 'active');
  await sleep(200);

  // Accumulate vector votes from top-3 matches
  const votes = Object.fromEntries(PERSONAS.map(p => [p, 0]));
  top3.forEach(r => { votes[r.persona] = (votes[r.persona] || 0) + r.sim; });

  // ── Step 3: Combined scoring and decision ─────────────────────────────
  const combined = combineScores(votes, profile);
  const best     = combined[0];

  const lowConf       = best.combined < 40;
  const finalPersona  = lowConf ? 'The Planner' : best.persona;
  const fallbackApplied = lowConf;

  if (fallbackApplied) {
    agentLog('a2', `WARNING: Low confidence (${best.combined}%). Falling back to Planner default.`, 'warn');
  } else {
    agentLog('a2', `Step 3: Combined score — ${finalPersona} (${best.combined}%)`, 'active');
  }

  // Hustler flag: triggers stricter compliance auditing in Agent 4
  const hustlerFlag = finalPersona === 'The Hustler';
  if (hustlerFlag) {
    agentLog('a2', 'HUSTLER FLAG SET — stricter compliance threshold for Agents 3 & 4', 'warn');
  }

  // ── Step 4: LLM reasoning ─────────────────────────────────────────────
  agentLog('a2', 'Step 4: Generating reasoning via LLM (claude-haiku)...', 'active');

  const reasoning = await _generateReasoning(
    finalPersona, profile, top3[0], fallbackApplied
  );

  agentLog('a2', `Persona confirmed: ${finalPersona}`, 'active');
  agentLog('a2', 'Handoff payload ready for Agent 3 (D2C Writer)');

  // ── Build handoff payload ─────────────────────────────────────────────
  const handoff = {
    selected_persona:     finalPersona,
    consumer_segment:     profile.consumer_segment,
    product_category:     profile.product_category,
    campaign_intent:      profile.campaign_intent,
    channel_mix:          profile.channel_mix,
    compliance_risk:      profile.compliance_risk_level,
    vernacular_required:  profile.vernacular_required,
    preferred_language:   profile.preferred_language,
    key_compliance_flags: profile.key_compliance_flags,
    hustler_flag:         hustlerFlag,
    match_confidence:     best.combined,
    fallback_applied:     fallbackApplied,
    top_vector_match: {
      id:         top3[0].id,
      similarity: top3[0].sim,
      ctr:        top3[0].ctr,
      conversion: top3[0].conversion,
    },
  };

  _renderOutput(top3, combined, finalPersona, best.combined, fallbackApplied, hustlerFlag, reasoning, handoff);
  setStatus('a2', 'done');
  setTrack('track-a2', 'done');

  return handoff;
}

// ── LLM reasoning helper ──────────────────────────────────────────────────────

/**
 * Ask the LLM to justify the persona selection in 2-3 sentences.
 *
 * @param {string} persona
 * @param {object} profile        - Agent 1 structured profile
 * @param {object} topMatch       - best Vector DB record
 * @param {boolean} fallback      - whether the fallback was applied
 * @returns {Promise<string>} plain-text reasoning
 */
async function _generateReasoning(persona, profile, topMatch, fallback) {
  const prompt = `You are Agent 2 of the GCN D2C Fintech pipeline — the D2C Persona Matcher.

You selected the persona "${persona}" for:
- Segment: ${profile.consumer_segment}
- Product: ${profile.product_category}
- Intent: ${profile.campaign_intent}
- Channels: ${(profile.channel_mix || []).join(', ')}
- Compliance Risk: ${profile.compliance_risk_level}
- Vernacular Required: ${profile.vernacular_required}
- Top Vector DB match: ${topMatch.persona} (similarity ${Math.round(topMatch.sim * 100)}%, CTR ${(topMatch.ctr * 100).toFixed(1)}%, Conversion ${(topMatch.conversion * 100).toFixed(1)}%)
- Fallback applied: ${fallback}

Write 2-3 sentences explaining why "${persona}" is the right persona for this brief.
Mention segment fit, channel fit, and compliance implications if relevant.
Return ONLY the explanation text — no labels, no JSON.`;

  const res = await puter.ai.chat(prompt, { model: 'claude-haiku-4-5' });
  return res.message.content[0].text.trim();
}

// ── Output renderer ───────────────────────────────────────────────────────────

/**
 * Renders Agent 2 results into the #out-a2 panel.
 */
function _renderOutput(top3, combined, finalPersona, confidence, fallback, hustlerFlag, reasoning, handoff) {
  const el = document.getElementById('out-a2');
  el.style.display = 'block';

  el.innerHTML = `
    <div class="out-grid">
      ${_renderVectorMatches(top3)}
      ${_renderScoreTable(combined, finalPersona)}
      ${_renderDecisionCard(finalPersona, confidence, fallback, hustlerFlag, reasoning)}
      ${_renderHandoffPayload(handoff)}
    </div>`;
}

/** Vector DB top-3 match table */
function _renderVectorMatches(top3) {
  const rows = top3.map((r, i) => `
    <div class="match-row ${i === 0 ? 'top' : ''}">
      <div>#${i + 1}</div>
      <div>${r.persona}</div>
      <div style="color:#555">${r.segment.split(' ')[0]} · ${r.product}</div>
      <div>${Math.round(r.sim * 100)}%</div>
      <div>${(r.ctr * 100).toFixed(1)}% / ${(r.conversion * 100).toFixed(1)}%</div>
    </div>`).join('');

  return `
    <div class="out-card full">
      <div class="out-lbl" style="margin-bottom:8px">Vector DB — Top 3 Similar Past Runs</div>
      <div class="match-row header">
        <div>#</div><div>Persona</div><div>Segment · Product</div>
        <div>Similarity</div><div>CTR / Conv</div>
      </div>
      ${rows}
    </div>`;
}

/** Combined rule + vector score table */
function _renderScoreTable(combined, finalPersona) {
  const rows = combined.map(row => `
    <tr${row.persona === finalPersona ? ' class="selected"' : ''}>
      <td>${row.persona}</td>
      <td>${row.ruleScore}</td>
      <td>${row.vectorVote}</td>
      <td>${row.combined}%</td>
      <td>${row.persona === finalPersona ? '<span class="tag ok">SELECTED</span>' : ''}</td>
    </tr>`).join('');

  return `
    <div class="out-card full">
      <div class="out-lbl" style="margin-bottom:8px">Rule + Vector Combined Scores</div>
      <table class="score-table">
        <thead>
          <tr>
            <th>Persona</th><th>Rule</th><th>Vector Vote</th>
            <th>Combined</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/** Selected persona decision card */
function _renderDecisionCard(finalPersona, confidence, fallback, hustlerFlag, reasoning) {
  const confColor  = confidence >= 60 ? '#7fd6a0' : confidence >= 40 ? '#f0a040' : '#f04040';
  const borderColor = fallback ? '#3a2000' : '#0a3a1a';

  return `
    <div class="out-card full" style="border-color:${borderColor}">
      <div class="out-lbl">Selected Persona</div>
      <div class="out-val hi" style="font-size:18px; margin:6px 0">${finalPersona}</div>
      <div style="margin-bottom:8px">
        <span class="tag" style="color:${confColor}; background:#111">Confidence: ${confidence}%</span>
        ${fallback    ? '<span class="tag warn">FALLBACK — Planner default applied</span>'          : ''}
        ${hustlerFlag ? '<span class="tag block">HUSTLER FLAG — strict compliance for Agents 3 &amp; 4</span>' : ''}
      </div>
      <div class="reasoning">${reasoning}</div>
    </div>`;
}

/** Raw handoff payload (for transparency / debugging) */
function _renderHandoffPayload(handoff) {
  return `
    <div class="out-card full">
      <div class="out-lbl" style="margin-bottom:8px">Handoff Payload → Agent 3 (D2C Writer)</div>
      <pre style="font-size:10px; color:#444; white-space:pre-wrap; line-height:1.6">${JSON.stringify(handoff, null, 2)}</pre>
    </div>`;
}
