/**
 * GCN D2C Fintech — Agent 1: D2C Audience & Context Profiler
 *
 * Model: Small model (claude-haiku via puter.js)
 *
 * Responsibility (per GCN spec):
 *   Transforms a raw content brief into a structured D2C profile:
 *     - consumer_segment  (Gen Z / Millennial / Bharat / Mixed)
 *     - product_category  (Personal Loan / UPI / Wallet / Neo-bank / etc.)
 *     - campaign_intent   (Acquisition / Retention / Education / Grievance / etc.)
 *     - channel_mix       (SMS / Push / WhatsApp / Instagram / Blog / etc.)
 *     - vernacular_required
 *     - compliance_risk_level (LOW / MEDIUM / HIGH / BLOCK-RISK)
 *     - recommended_persona
 *     - key_compliance_flags
 *     - confidence_score
 *     - fallback_action
 *     - reasoning
 *
 * Handoff: Returns structured profile object → Agent 2 (D2C Persona Matcher)
 *
 * Failure recovery:
 *   - If confidence < 0.7 → fallback_action is set (REQUEST_CLARIFICATION /
 *     USE_PLANNER_DEFAULT / ESCALATE_HUMAN)
 *   - Vernacular pipeline activated automatically when Bharat segment detected
 */

import { agentLog, setStatus, setTrack, riskTag } from '../utils/logger.js';

// ── System prompt sent to the LLM ─────────────────────────────────────────────

const AGENT1_SYSTEM_PROMPT = `You are Agent 1 of the GCN D2C Fintech pipeline — the D2C Audience & Context Profiler.

Your ONLY job is to analyse the content brief and return a structured JSON profile. Do NOT write any campaign content. Do NOT explain. Return ONLY the raw JSON object — no markdown, no backticks, no text before or after.

Return exactly this JSON structure:
{
  "consumer_segment": "<Gen Z (18-25) | Millennial (26-38) | Bharat (Tier 2/3 vernacular) | Mixed>",
  "product_category": "<Personal Loan | UPI/Payments | Wallet/Savings | Neo-bank | Credit Card | Insurance | Education/FAQ | Grievance>",
  "campaign_intent": "<Acquisition | Retention | Education | Grievance | Feature Adoption | Referral/Growth>",
  "channel_mix": ["<SMS | Push Notification | WhatsApp | Instagram | YouTube Shorts | Blog | Email | In-app Banner | IVR>"],
  "vernacular_required": <true | false>,
  "preferred_language": "<EN | HI | TA | TE | BN | MR>",
  "compliance_risk_level": "<LOW | MEDIUM | HIGH | BLOCK-RISK>",
  "recommended_persona": "<The Hustler | The Planner | The Neighbour | The Advisor | The Trustee>",
  "key_compliance_flags": ["<RBI Fair Practices | TRAI DLT | DPDPA 2023 | SEBI Investment Norms | NPCI UPI Guidelines | RBI Grievance Redressal>"],
  "confidence_score": <0.0 to 1.0>,
  "fallback_action": "<REQUEST_CLARIFICATION | USE_PLANNER_DEFAULT | ESCALATE_HUMAN | null>",
  "reasoning": "<2-3 sentences on segment, persona, compliance risk>"
}

Rules:
- vernacular_required = true if Bharat segment OR Hindi/regional language is mentioned
- preferred_language = "HI" if Hindi is requested or Bharat/Tier 2/3 users are mentioned, unless another regional language is explicitly requested
- if product specification details are present, use them as grounding facts for product category, feature claims, eligibility, fees, repayment language, and compliance flags instead of making generic assumptions
- fallback_action = null if confidence_score >= 0.7
- compliance_risk_level:
    BLOCK-RISK → guaranteed returns or similar absolute claims
    HIGH       → lending products (Personal Loan, Credit Card)
    MEDIUM     → UPI / payments / wallet
    LOW        → education content, grievance handling`;

// ── Main agent function ────────────────────────────────────────────────────────

/**
 * Run Agent 1 against a content brief.
 *
 * @param {string} brief - raw content brief from the Orchestrator
 * @returns {Promise<object>} structured D2C profile
 * @throws if the LLM response contains no parseable JSON
 */
export async function runAgent1(brief) {
  setStatus('a1', 'running');
  setTrack('track-a1', 'running');
  document.getElementById('out-a1').style.display = 'none';

  agentLog('a1', 'Initialising — D2C Audience & Context Profiler');
  agentLog('a1', 'Model: claude-haiku (small model) via puter.js');
  agentLog('a1', 'Analysing content brief...', 'active');
  if (/\bPRODUCT SPECIFICATION\b/i.test(brief)) {
    agentLog('a1', 'Product specification detected — grounding profile from enterprise context');
  }

  const fullPrompt = `${AGENT1_SYSTEM_PROMPT}\n\nCONTENT BRIEF:\n${brief}`;

  const response = await puter.ai.chat(fullPrompt, { model: 'claude-haiku-4-5' });
  const raw      = response.message.content[0].text;

  agentLog('a1', 'Response received. Extracting JSON profile...');

  // Strip any accidental markdown fences the model might add
  const cleaned = raw.replace(/```[a-zA-Z]*\n?/g, '').trim();
  const match   = cleaned.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error('Agent 1: No JSON found in LLM response. Got: ' + raw.substring(0, 200));
  }

  const profile = JSON.parse(match[0]);
  const normalizedProfile = normalizeProfile(profile, brief);

  agentLog('a1', `Profile validated. Segment: ${normalizedProfile.consumer_segment}`, 'active');
  agentLog('a1', `Persona suggestion: ${normalizedProfile.recommended_persona}`);
  agentLog('a1', `Compliance risk: ${normalizedProfile.compliance_risk_level}`);
  agentLog('a1', `Language preference: ${normalizedProfile.preferred_language}`);
  agentLog('a1', `Confidence: ${Math.round(normalizedProfile.confidence_score * 100)}% — handing off to Agent 2`);

  if (normalizedProfile.vernacular_required) {
    agentLog('a1', 'BHARAT FLAG — vernacular pipeline will be activated downstream', 'warn');
  }

  _renderOutput(normalizedProfile);
  setStatus('a1', 'done');
  setTrack('track-a1', 'done');

  return normalizedProfile;
}

function normalizeProfile(profile, brief) {
  const normalized = { ...profile };
  const lowerBrief = String(brief || '').toLowerCase();
  const wantsHindi =
    /\bhindi\b/.test(lowerBrief) ||
    /\bbharat\b/.test(lowerBrief) ||
    /\btier\s*2\b/.test(lowerBrief) ||
    /\btier\s*3\b/.test(lowerBrief) ||
    /low[-\s]?literacy/.test(lowerBrief);

  if (wantsHindi) {
    normalized.vernacular_required = true;
    normalized.preferred_language = 'HI';
  } else if (!normalized.preferred_language) {
    normalized.preferred_language = normalized.vernacular_required ? 'HI' : 'EN';
  }

  if (wantsHindi && !/bharat/i.test(normalized.consumer_segment || '')) {
    normalized.consumer_segment = 'Bharat (Tier 2/3 vernacular)';
  }

  return normalized;
}

// ── Output renderer ───────────────────────────────────────────────────────────

/**
 * Renders Agent 1 output into the #out-a1 panel.
 * @param {object} p - validated profile object
 */
function _renderOutput(p) {
  const el = document.getElementById('out-a1');
  el.style.display = 'block';

  const flags    = (p.key_compliance_flags || [])
    .map(f => `<span class="tag warn">${f}</span>`).join(' ');
  const channels = (p.channel_mix || [])
    .map(c => `<span class="tag">${c}</span>`).join(' ');
  const confColor = p.confidence_score >= 0.75 ? '#7fd6a0'
                  : p.confidence_score >= 0.5  ? '#f0a040'
                  : '#f04040';
  const fallback  = p.fallback_action && p.fallback_action !== 'null'
    ? `<span class="tag warn">${p.fallback_action}</span>`
    : `<span class="tag ok">NONE</span>`;

  el.innerHTML = `
    <div class="out-grid">
      <div class="out-card">
        <div class="out-lbl">Consumer Segment</div>
        <div class="out-val hi">${p.consumer_segment}</div>
      </div>
      <div class="out-card">
        <div class="out-lbl">Product Category</div>
        <div class="out-val">${p.product_category}</div>
      </div>
      <div class="out-card">
        <div class="out-lbl">Campaign Intent</div>
        <div class="out-val">${p.campaign_intent}</div>
      </div>
      <div class="out-card">
        <div class="out-lbl">Recommended Persona</div>
        <div class="out-val hi">${p.recommended_persona}</div>
      </div>
      <div class="out-card">
        <div class="out-lbl">Compliance Risk</div>
        <div class="out-val">${riskTag(p.compliance_risk_level)}</div>
      </div>
      <div class="out-card">
        <div class="out-lbl">Confidence</div>
        <div class="out-val" style="color:${confColor}">${Math.round(p.confidence_score * 100)}%</div>
      </div>
      <div class="out-card full">
        <div class="out-lbl">Channel Mix</div>
        <div class="out-val" style="margin-top:4px">${channels}</div>
      </div>
      <div class="out-card full">
        <div class="out-lbl">Vernacular Pipeline</div>
        <div class="out-val" style="margin-top:4px">
          ${p.vernacular_required
            ? '<span class="tag warn">YES — vernacular pipeline activated</span>'
            : '<span class="tag ok">NO</span>'}
        </div>
      </div>
      <div class="out-card">
        <div class="out-lbl">Preferred Language</div>
        <div class="out-val hi">${p.preferred_language || 'EN'}</div>
      </div>
      <div class="out-card full">
        <div class="out-lbl">Compliance Flags</div>
        <div class="out-val" style="margin-top:4px">${flags || '<span class="tag ok">None</span>'}</div>
      </div>
      <div class="out-card full">
        <div class="out-lbl">Fallback Action</div>
        <div class="out-val" style="margin-top:4px">${fallback}</div>
      </div>
      <div class="out-card full">
        <div class="out-lbl">Reasoning</div>
        <div class="reasoning">${p.reasoning}</div>
      </div>
    </div>`;
}
