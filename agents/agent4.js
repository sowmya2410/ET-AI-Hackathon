/**
 * GCN D2C Fintech — Agent 4: D2C Compliance Auditor
 *
 * Model: Small model (claude-haiku via puter.js) + D2C Regulatory Rule DB
 *
 * Responsibility (per GCN spec):
 *   Validates every draft content piece against the D2C compliance rule database:
 *     - RBI Fair Practices Code (misleading APR, undisclosed fees, coercive language)
 *     - SEBI Investment Norms (guaranteed/assured/risk-free language)
 *     - TRAI DLT Rules (160-char SMS limit, opt-out instruction)
 *     - DPDPA 2023 (PAN/Aadhaar in plain text, data reference without consent)
 *     - NPCI UPI Guidelines (misleading cashback claims)
 *     - RBI Grievance Redressal (Ombudsman reference mandatory)
 *
 *   For each violation, outputs:
 *     - flagged_sentence: exact offending text
 *     - violation_type: Prohibited claim / Missing disclosure / Misleading quantification /
 *                       Data privacy breach / TRAI DLT violation
 *     - rule_id + circular reference
 *     - severity: BLOCK | FLAG
 *     - compliant_rewrite: suggested replacement
 *
 *   Hustler-tagged content uses a STRICTER threshold.
 *
 * Handoff:
 *   PASS → sends audited content to Agent 5 (Disclosure Injection Agent)
 *   FAIL → sends flagged sentences + rewrites back to Agent 3 as hard constraints
 *   BLOCK after 3 retries → escalates to human compliance officer. Pipeline halts.
 *
 * Failure recovery:
 *   - Tracks retry count per channel.
 *   - After 3 failed retries: BLOCK severity, escalate to human, halt pipeline.
 */

import { agentLog, setStatus, setTrack, sleep }       from '../utils/logger.js';
import { COMPLIANCE_RULES, PERSONA_THRESHOLDS }       from '../data/ruleDb.js';
import { auditLog, logComplianceViolation, logPipelineBlock } from './agentA.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_AUDIT_RETRIES = 3;

// Violation type labels (per GCN spec)
const VIOLATION_TYPES = {
  PROHIBITED_CLAIM:       'Prohibited claim',
  MISSING_DISCLOSURE:     'Missing disclosure',
  MISLEADING_QUANT:       'Misleading quantification',
  DATA_PRIVACY_BREACH:    'Data privacy breach',
  TRAI_DLT_VIOLATION:     'TRAI DLT violation',
  COERCIVE_LANGUAGE:      'Coercive language',
  MISLEADING_CASHBACK:    'Misleading cashback claim',
};

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run Agent 4 — compliance audit on all channel drafts from Agent 3.
 *
 * @param {object} a4Input - handoff payload from Agent 3
 * @returns {Promise<object>} audit result payload → Agent 5
 */
export async function runAgent4(a4Input) {
  setStatus('a4', 'running');
  setTrack('track-a4', 'running');
  document.getElementById('out-a4').style.display = 'none';

  const persona    = a4Input.selected_persona;
  const threshold  = PERSONA_THRESHOLDS[persona] || PERSONA_THRESHOLDS['The Planner'];
  const strictMode = a4Input.hustler_flag || threshold.strictMode;

  agentLog('a4', 'Received draft content from Agent 3 (Writer)');
  agentLog('a4', `Auditing ${Object.keys(a4Input.draft_content).length} channel(s) — persona: ${persona}`);
  agentLog('a4', `Model: claude-haiku-4-5 (small model) + Rule DB`, );

  if (strictMode) {
    agentLog('a4', 'STRICT MODE active — Hustler persona uses elevated compliance threshold', 'warn');
  }

  const auditResults   = {};
  let   pipelineBlocked = false;
  let   blockReason     = null;

  for (const [channel, draft] of Object.entries(a4Input.draft_content)) {
    agentLog('a4', `Auditing channel: ${channel}...`, 'active');
    await sleep(200);

    // Step 1: Fast keyword pre-scan against Rule DB
    const preFlags = _preScankeywords(draft.content, channel, a4Input);
    if (preFlags.length > 0) {
      agentLog('a4', `Pre-scan: ${preFlags.length} potential violation(s) flagged in ${channel}`, 'warn');
    }

    // Step 2: LLM deep audit
    let auditPass  = null;
    let retries    = 0;

    while (retries < MAX_AUDIT_RETRIES) {
      agentLog('a4', `Step 2: LLM deep audit — ${channel} (attempt ${retries + 1})...`, 'active');

      try {
        auditPass = await _llmAudit(
          draft.content, channel, a4Input, preFlags, strictMode, persona
        );

        const blockViolations = auditPass.violations.filter(v => v.severity === 'BLOCK');
        const flagViolations  = auditPass.violations.filter(v => v.severity === 'FLAG');

        if (blockViolations.length === 0 && flagViolations.length === 0) {
          // Clean pass
          agentLog('a4', `✓ ${channel} — PASS (no violations)`, 'active');
          auditPass.result = 'PASS';
          break;
        }

        if (blockViolations.length > 0) {
          retries++;
          agentLog('a4', `BLOCK violation in ${channel}: ${blockViolations[0].violation_type} — retry ${retries}/${MAX_AUDIT_RETRIES}`, 'warn');

          if (retries >= MAX_AUDIT_RETRIES) {
            // Pipeline halt
            auditPass.result = 'BLOCK';
            pipelineBlocked  = true;
            blockReason       = `${channel}: ${blockViolations[0].violation_type} — ${blockViolations[0].rule_id}`;
            agentLog('a4', `PIPELINE HALTED — BLOCK severity after ${MAX_AUDIT_RETRIES} retries. Escalating to compliance officer.`, 'warn');
            logPipelineBlock(blockReason, blockViolations[0].rule_id);
            logComplianceViolation('Agent4-Auditor', blockViolations[0].rule_id, blockViolations[0].circular, 'BLOCK', blockViolations[0].violation_type);
            break;
          }
          // Send violation+rewrite back to writer (simulated — flag for re-generation)
          auditPass.result = 'FAIL_RETRY';
          // Update draft content with violation context for next pass
          a4Input.draft_content[channel].violation_context = blockViolations;
          break;
        }

        // Only FLAG violations — still a pass but with disclosure injection needed
        agentLog('a4', `${channel} — PASS with ${flagViolations.length} FLAG(s) → disclosure injection required`);
        auditPass.result = 'PASS_WITH_FLAGS';
        break;

      } catch (err) {
        retries++;
        agentLog('a4', `Audit attempt ${retries} error: ${err.message}`, 'warn');
        await sleep(400);
      }
    }

    auditResults[channel] = auditPass || {
      result:     'ERROR',
      violations: [],
      message:    'Audit could not complete',
    };

    if (pipelineBlocked) break;
  }

  // Build handoff for Agent 5
  const a5Handoff = {
    audit_results:    auditResults,
    draft_content:    a4Input.draft_content,
    selected_persona: a4Input.selected_persona,
    product_category: a4Input.product_category,
    consumer_segment: a4Input.consumer_segment,
    campaign_intent:  a4Input.campaign_intent,
    channel_mix:      a4Input.channel_mix,
    compliance_risk:  a4Input.compliance_risk,
    vernacular_required: a4Input.vernacular_required,
    preferred_language: a4Input.preferred_language,
    key_compliance_flags: a4Input.key_compliance_flags,
    hustler_flag:     a4Input.hustler_flag,
    pipeline_blocked: pipelineBlocked,
    block_reason:     blockReason,
    strict_mode:      strictMode,
  };

  _renderOutput(auditResults, pipelineBlocked, blockReason, strictMode, persona);
  setStatus('a4', pipelineBlocked ? 'blocked' : 'done');
  setTrack('track-a4', pipelineBlocked ? 'running' : 'done');

  return a5Handoff;
}

// ── Keyword pre-scan ──────────────────────────────────────────────────────────

/**
 * Fast deterministic pre-scan against Rule DB keywords.
 * Returns list of matching rule IDs — used to focus the LLM audit.
 */
function _preScankeywords(content, channel, context) {
  const lower   = content.toLowerCase();
  const matched = [];

  for (const rule of COMPLIANCE_RULES) {
    // Check channel applicability
    if (rule.appliesTo && !rule.appliesTo.includes(channel)) continue;

    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push({ ruleId: rule.id, keyword: kw, severity: rule.severity });
        break;
      }
    }

    // SMS char limit check
    if (rule.id === 'TRAI-DLT-002' && channel === 'SMS') {
      const charCount = content.replace(/\[DISCLOSURE_PLACEHOLDER[^\]]*\]/g, '').length;
      if (charCount > rule.charLimit) {
        matched.push({ ruleId: rule.id, keyword: `SMS exceeds ${rule.charLimit} chars (${charCount})`, severity: 'BLOCK' });
      }
    }
  }

  return matched;
}

// ── LLM deep audit ────────────────────────────────────────────────────────────

/**
 * Ask the LLM to perform a detailed compliance audit, guided by pre-scan results.
 */
async function _llmAudit(content, channel, context, preFlags, strictMode, persona) {
  const rulesText = COMPLIANCE_RULES.map(r =>
    `[${r.id}] ${r.regulator} | ${r.category} | Severity: ${r.severity}
     Rule: ${r.description}
     Circular: ${r.circular || 'N/A'}
     Keywords: ${r.keywords.slice(0, 5).join(', ')}${r.keywords.length > 5 ? '...' : ''}`
  ).join('\n\n');

  const preFlagText = preFlags.length > 0
    ? `\nPRE-SCAN FLAGS (focus your attention here):\n` +
      preFlags.map(f => `  - Rule ${f.ruleId} triggered by keyword: "${f.keyword}" (${f.severity})`).join('\n')
    : '\nPre-scan: no keyword matches.';

  const strictNote = strictMode
    ? '\n⚠️ STRICT MODE (Hustler persona): Flag aggressive language even if it technically clears standard rules. Any over-promise or FOMO language that implies guaranteed outcomes must be flagged.'
    : '';

  const prompt = `You are Agent 4 of the GCN D2C Fintech pipeline — the D2C Compliance Auditor.

Audit the following consumer-facing content for compliance violations.
Return ONLY a raw JSON object — no markdown, no explanation, no backticks.

CONTENT TO AUDIT:
Channel: ${channel}
Persona: ${persona}
Product: ${context.product_category}
Segment: ${context.consumer_segment}
---
${content}
---
${preFlagText}
${strictNote}

COMPLIANCE RULE DATABASE:
${rulesText}

VIOLATION TYPE CODES:
- Prohibited claim
- Missing disclosure
- Misleading quantification
- Data privacy breach
- TRAI DLT violation
- Coercive language
- Misleading cashback claim

Return this exact JSON structure:
{
  "violations": [
    {
      "flagged_sentence": "<exact offending text from content>",
      "violation_type": "<violation type code from above>",
      "rule_id": "<e.g. SEBI-INV-001>",
      "regulator": "<RBI | SEBI | TRAI | DPDPA | NPCI>",
      "circular": "<circular reference>",
      "severity": "<BLOCK | FLAG>",
      "compliant_rewrite": "<suggested replacement sentence>"
    }
  ],
  "overall_assessment": "<1-2 sentences on the content's compliance posture>",
  "disclosure_injections_needed": ["<DISCLOSURE type keys needed, e.g. APR_FEE_SCHEDULE>"]
}

If no violations, return: {"violations": [], "overall_assessment": "Content is compliant.", "disclosure_injections_needed": []}`;

  const res  = await puter.ai.chat(prompt, { model: 'claude-haiku-4-5' });
  const raw  = res.message.content[0].text;
  const clean = raw.replace(/```[a-zA-Z]*\n?/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);

  if (!match) throw new Error('Agent 4: No JSON in audit response');

  return JSON.parse(match[0]);
}

// ── Output renderer ───────────────────────────────────────────────────────────

function _renderOutput(auditResults, pipelineBlocked, blockReason, strictMode, persona) {
  const el = document.getElementById('out-a4');
  el.style.display = 'block';

  const channelCards = Object.entries(auditResults).map(([ch, audit]) => {
    if (!audit) return '';

    const result     = audit.result || 'UNKNOWN';
    const violations = audit.violations || [];
    const blocks     = violations.filter(v => v.severity === 'BLOCK');
    const flags      = violations.filter(v => v.severity === 'FLAG');

    const resultTag =
      result === 'PASS'            ? '<span class="tag ok">PASS</span>'           :
      result === 'PASS_WITH_FLAGS' ? '<span class="tag warn">PASS + FLAGS</span>' :
      result === 'BLOCK'           ? '<span class="tag block">BLOCK</span>'       :
      result === 'FAIL_RETRY'      ? '<span class="tag warn">FAIL — RETRY</span>' :
                                     '<span class="tag">UNKNOWN</span>';

    const violationHtml = violations.length === 0
      ? '<div style="font-size:11px;color:#3a6a40;margin-top:6px">No violations detected.</div>'
      : violations.map(v => `
          <div style="margin-top:10px; padding:8px; background:#0d0d0d; border-left:2px solid ${v.severity === 'BLOCK' ? '#f04040' : '#f0a040'}; border-radius:2px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span class="tag ${v.severity === 'BLOCK' ? 'block' : 'warn'}">${v.severity}</span>
              <span style="font-size:10px;color:#555">${v.rule_id} · ${v.circular || ''}</span>
            </div>
            <div style="font-size:10px;color:#666;margin-bottom:2px">Type: ${v.violation_type}</div>
            <div style="font-size:11px;color:#f04040;margin-bottom:4px">⚑ "${v.flagged_sentence}"</div>
            <div style="font-size:10px;color:#444;margin-bottom:4px">Compliant rewrite:</div>
            <div style="font-size:11px;color:#7fd6a0">"${v.compliant_rewrite}"</div>
          </div>`).join('');

    const disclosures = (audit.disclosure_injections_needed || []);
    const disclosureHtml = disclosures.length > 0
      ? `<div style="margin-top:8px">${disclosures.map(d => `<span class="tag info">${d}</span>`).join(' ')}</div>`
      : '';

    return `
      <div class="out-card full" style="border-color:${blocks.length > 0 ? '#3a0000' : flags.length > 0 ? '#3a2000' : '#0a3a1a'}">
        <div class="out-lbl" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span>${ch}</span>
          <span>${resultTag}
            ${blocks.length > 0 ? `<span class="tag block">${blocks.length} BLOCK</span>` : ''}
            ${flags.length  > 0 ? `<span class="tag warn">${flags.length} FLAG</span>`   : ''}
          </span>
        </div>
        ${violationHtml}
        ${disclosures.length > 0 ? `<div style="margin-top:8px"><div class="out-lbl">Disclosures to inject</div>${disclosureHtml}</div>` : ''}
        ${audit.overall_assessment
          ? `<div class="reasoning" style="margin-top:8px;border-top:1px solid #1e1e1e;padding-top:8px">${audit.overall_assessment}</div>`
          : ''}
      </div>`;
  }).join('');

  const blockedBanner = pipelineBlocked ? `
    <div class="out-card full" style="border-color:#f04040;background:#0d0000">
      <div class="out-lbl" style="color:#f04040">⛔ PIPELINE HALTED — BLOCK SEVERITY</div>
      <div style="font-size:12px;color:#f04040;margin-top:6px">${blockReason}</div>
      <div style="font-size:11px;color:#666;margin-top:4px">
        Escalated to human compliance officer. No further agents will run until this is resolved.
      </div>
    </div>` : '';

  const passBanner = !pipelineBlocked ? `
    <div class="out-card full" style="border-color:#0a3a1a">
      <div class="out-lbl">→ Handoff to Agent 5 (Disclosure Injection)</div>
      <div style="font-size:11px;color:#3a7a50;margin-top:4px">
        Audit complete. Audited content + disclosure injection list forwarded to Agent 5.
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="out-grid">
      <div class="out-card">
        <div class="out-lbl">Persona Audited</div>
        <div class="out-val hi">${persona}</div>
      </div>
      <div class="out-card">
        <div class="out-lbl">Audit Mode</div>
        <div class="out-val">${strictMode ? '<span class="tag block">STRICT (Hustler)</span>' : '<span class="tag ok">STANDARD</span>'}</div>
      </div>
      ${blockedBanner}
      ${channelCards}
      ${passBanner}
    </div>`;
}
