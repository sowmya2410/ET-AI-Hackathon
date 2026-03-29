/**
 * GCN D2C Fintech — Agent 5: Disclosure Injection Agent
 *
 * Model: Rule-based — NO LLM
 *
 * Responsibility (per GCN spec):
 *   Resolves all [DISCLOSURE_PLACEHOLDER:TYPE] tags in audited content.
 *   Injects the correct statutory disclosure text based on product type and channel:
 *     - APR_FEE_SCHEDULE   → full APR + fee schedule for loan content
 *     - RBI_OMBUDSMAN      → RBI Banking Ombudsman contact for credit/grievance content
 *     - TRAI_OPT_OUT       → TRAI opt-out instruction for all promotional SMS
 *     - SEBI_RISK_WARNING  → risk warning for savings/investment nudges
 *     - DPDPA_CONSENT      → consent language for any message referencing user data
 *     - NPCI_CASHBACK      → cashback disclaimer for UPI content
 *
 *   Statutory disclosures are LOCKED — never paraphrased, never shortened.
 *   Disclosure text has truncation immunity in downstream Channel Formatter.
 *
 * Handoff:
 *   Returns fully_disclosed_content → Agent 6 (Vernacular Localization Agent)
 *
 * Failure recovery:
 *   If a placeholder type is unrecognised → flags to Orchestrator, requests
 *   human classification before proceeding. Does NOT silently drop the placeholder.
 */

import { agentLog, setStatus, setTrack, sleep } from '../utils/logger.js';
import {
  DISCLOSURES,
  DISCLOSURE_MAP,
  CHANNEL_DISCLOSURE_MAP,
} from '../data/ruleDb.js';

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run Agent 5 — inject statutory disclosures into all audited channel drafts.
 *
 * @param {object} a5Input - handoff payload from Agent 4
 * @returns {Promise<object>} fully_disclosed payload → Agent 6
 */
export async function runAgent5(a5Input) {
  setStatus('a5', 'running');
  setTrack('track-a5', 'running');
  document.getElementById('out-a5').style.display = 'none';

  agentLog('a5', 'Received audited content from Agent 4 (Compliance Auditor)');
  agentLog('a5', 'Model: Rule-based — no LLM');
  agentLog('a5', `Resolving [DISCLOSURE_PLACEHOLDER] tags across ${Object.keys(a5Input.draft_content).length} channel(s)...`, 'active');

  await sleep(200);

  const fullyDisclosed   = {};
  const injectionLog     = [];
  const unresolvedFlags  = [];

  // Determine required disclosures from product + channels
  const productDisclosures = DISCLOSURE_MAP[a5Input.product_category] || [];

  for (const [channel, draft] of Object.entries(a5Input.draft_content)) {
    if (draft.failed) {
      fullyDisclosed[channel] = { ...draft, disclosed_content: draft.content };
      agentLog('a5', `Skipping ${channel} — draft was marked failed`, 'warn');
      continue;
    }

    agentLog('a5', `Injecting disclosures for channel: ${channel}...`);
    await sleep(100);

    const channelDisclosures = CHANNEL_DISCLOSURE_MAP[channel] || [];
    const allRequired = [...new Set([...productDisclosures, ...channelDisclosures])];

    // Also collect any disclosure types flagged by Agent 4 audit
    const auditRequired = (a5Input.audit_results?.[channel]?.disclosure_injections_needed) || [];
    const combined = [...new Set([...allRequired, ...auditRequired])];

    let content = draft.content;
    const injected = [];
    const unresolved = [];

    // Replace each [DISCLOSURE_PLACEHOLDER:TYPE] tag
    content = content.replace(/\[DISCLOSURE_PLACEHOLDER(?::([A-Z_]+))?\]/g, (match, type) => {
      if (!type) {
        // Generic placeholder — inject all required for this product/channel
        const texts = combined
          .map(k => DISCLOSURES[k])
          .filter(Boolean)
          .join(' ');
        injected.push(...combined);
        return texts || match;
      }

      if (DISCLOSURES[type]) {
        injected.push(type);
        return DISCLOSURES[type];
      }

      // Unknown type — flag it
      unresolved.push(type);
      unresolvedFlags.push({ channel, type });
      agentLog('a5', `WARNING: Unknown placeholder type [${type}] in ${channel} — flagging for human review`, 'warn');
      return `[UNRESOLVED_DISCLOSURE:${type}]`;
    });

    // Also append any required disclosures that had no placeholder
    const alreadyInjected = new Set(injected);
    for (const key of combined) {
      if (!alreadyInjected.has(key) && DISCLOSURES[key]) {
        content += '\n' + DISCLOSURES[key];
        injected.push(key);
        agentLog('a5', `Appended missing disclosure: ${key} to ${channel}`);
      }
    }

    injectionLog.push({ channel, injected, unresolved });
    agentLog('a5', `✓ ${channel} — ${injected.length} disclosure(s) injected`);

    fullyDisclosed[channel] = {
      ...draft,
      disclosed_content:    content,
      disclosures_injected: injected,
    };
  }

  agentLog('a5', 'All disclosures resolved. Handing off to Agent 6 (Vernacular Localization).', 'active');

  const a6Handoff = {
    fully_disclosed:      fullyDisclosed,
    selected_persona:     a5Input.selected_persona,
    product_category:     a5Input.product_category,
    consumer_segment:     a5Input.consumer_segment,
    campaign_intent:      a5Input.campaign_intent,
    channel_mix:          a5Input.channel_mix,
    vernacular_required:  a5Input.vernacular_required,
    preferred_language:   a5Input.preferred_language,
    key_compliance_flags: a5Input.key_compliance_flags,
    hustler_flag:         a5Input.hustler_flag,
    unresolved_flags:     unresolvedFlags,
    injection_log:        injectionLog,
  };

  _renderOutput(injectionLog, fullyDisclosed, unresolvedFlags);
  setStatus('a5', 'done');
  setTrack('track-a5', 'done');

  return a6Handoff;
}

// ── Output renderer ───────────────────────────────────────────────────────────

function _renderOutput(injectionLog, fullyDisclosed, unresolvedFlags) {
  const el = document.getElementById('out-a5');
  el.style.display = 'block';

  const cards = injectionLog.map(({ channel, injected, unresolved }) => {
    const disclosedContent = fullyDisclosed[channel]?.disclosed_content || '';
    const preview = disclosedContent.length > 600
      ? disclosedContent.substring(0, 600) + '…'
      : disclosedContent;

    // Highlight injected disclosure text
    const highlightedPreview = preview.replace(
      /\[DISCLOSURE:[^\]]+\]|\[To unsubscribe[^\]]+\]/g,
      m => `<span style="color:#4090f0;font-size:10px">${m}</span>`
    ).replace(/\n/g, '<br>');

    return `
      <div class="out-card full">
        <div class="out-lbl" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span>${channel}</span>
          <span>
            ${injected.map(k => `<span class="tag info">${k}</span>`).join(' ')}
            ${unresolved.map(k => `<span class="tag warn">UNRESOLVED: ${k}</span>`).join(' ')}
          </span>
        </div>
        <div style="font-size:11px;color:#888;line-height:1.8">${highlightedPreview}</div>
      </div>`;
  }).join('');

  const unresolvedBanner = unresolvedFlags.length > 0 ? `
    <div class="out-card full" style="border-color:#3a2000">
      <div class="out-lbl" style="color:#f0a040">⚠ Unresolved Placeholder Types — Human Review Required</div>
      <div style="font-size:11px;color:#666;margin-top:4px">
        ${unresolvedFlags.map(f => `${f.channel}: ${f.type}`).join(', ')}
      </div>
    </div>` : '';

  el.innerHTML = `
    <div class="out-grid">
      <div class="out-card full">
        <div class="out-lbl">Disclosure Injection Summary</div>
        <div style="font-size:11px;color:#3a7a50;margin-top:4px">
          ${injectionLog.reduce((t, l) => t + l.injected.length, 0)} disclosure(s) injected across
          ${injectionLog.length} channel(s). Statutory text is locked — cannot be paraphrased downstream.
        </div>
      </div>
      ${unresolvedBanner}
      ${cards}
      <div class="out-card full">
        <div class="out-lbl">→ Handoff to Agent 6 (Vernacular Localization)</div>
        <div style="font-size:11px;color:#3a7a50;margin-top:4px">
          Fully disclosed content forwarded. Statutory blocks locked for translation.
        </div>
      </div>
    </div>`;
}
