/**
 * GCN D2C Fintech — Agent 6: Vernacular Localization Agent
 *
 * Model: Large model (claude-sonnet via puter.js)
 *
 * Responsibility (per GCN spec):
 *   Adapts fully disclosed content into Hindi (and other regional languages as needed).
 *   Goes beyond translation:
 *     - Adapts financial idioms (e.g. 'EMI' → 'masik kist' in Hindi)
 *     - Adjusts formality level per segment
 *     - Uses culturally resonant trust signals for Bharat users
 *     - Short sentences, no compound phrases, SMS-friendly in regional language
 *
 *   CRITICAL: All injected statutory disclosures are LOCKED blocks.
 *   The agent CANNOT paraphrase, shorten, or alter them in any way.
 *   Statutory disclosures are passed through as-is, wrapped in XML lock markers.
 *
 *   If vernacular_required = false → skips localization, passes content through unchanged.
 *
 * Handoff:
 *   Returns localized_content object → Agent 7 (Channel Formatter)
 *
 * Failure recovery:
 *   If translation alters statutory text or loses persona tone:
 *   re-runs with locked-block preservation constraints explicitly reinforced.
 *   Max 2 retries per channel before passing original English content with a warning flag.
 */

import { agentLog, setStatus, setTrack, sleep } from '../utils/logger.js';

// Supported localization languages per GCN spec
const SUPPORTED_LANGUAGES = {
  HI: 'Hindi',
  TA: 'Tamil',
  TE: 'Telugu',
  BN: 'Bengali',
  MR: 'Marathi',
};

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run Agent 6 — vernacular localization of fully disclosed content.
 *
 * @param {object} a6Input - handoff from Agent 5
 * @returns {Promise<object>} localized_content payload → Agent 7
 */
export async function runAgent6(a6Input) {
  setStatus('a6', 'running');
  setTrack('track-a6', 'running');
  document.getElementById('out-a6').style.display = 'none';

  const localizationPlan = resolveLocalizationPlan(a6Input);

  agentLog('a6', 'Received fully disclosed content from Agent 5');
  agentLog('a6', `Vernacular required: ${localizationPlan.shouldLocalize}`);
  agentLog('a6', `Preferred language: ${localizationPlan.language}`);

  // If vernacular not required, pass through unchanged
  if (!localizationPlan.shouldLocalize) {
    agentLog('a6', 'Vernacular not required — passing English content through unchanged');

    const passthrough = {};
    for (const [ch, draft] of Object.entries(a6Input.fully_disclosed)) {
      passthrough[ch] = {
        ...draft,
        localized_content: draft.disclosed_content,
        content_for_formatting: draft.disclosed_content,
        language:          'EN',
        localized:         false,
      };
    }

    const a7Handoff = _buildHandoff(a6Input, passthrough);
    _renderOutput(passthrough, false);
    setStatus('a6', 'done');
    setTrack('track-a6', 'done');
    return a7Handoff;
  }

  agentLog('a6', `VERNACULAR MODE — localizing to ${SUPPORTED_LANGUAGES[localizationPlan.language] || localizationPlan.language}`, 'warn');
  agentLog('a6', 'Model: claude-sonnet-4-6 (large model) via puter.js');
  agentLog('a6', 'Statutory disclosures locked — will not be paraphrased or shortened');

  const localizedContent = {};

  for (const [channel, draft] of Object.entries(a6Input.fully_disclosed)) {
    if (draft.failed) {
      localizedContent[channel] = {
        ...draft,
        localized_content: draft.content,
        content_for_formatting: draft.content,
        language: 'EN',
        localized: false
      };
      continue;
    }

    agentLog('a6', `Localizing ${channel} → ${SUPPORTED_LANGUAGES[localizationPlan.language] || localizationPlan.language}...`, 'active');
    await sleep(200);

    let localized     = null;
    let retries       = 0;
    const MAX_RETRIES = 2;

    while (retries <= MAX_RETRIES) {
      try {
        localized = await _localizeChannel(draft.disclosed_content, channel, a6Input, retries, localizationPlan.language);
        agentLog('a6', `✓ ${channel} localized to ${SUPPORTED_LANGUAGES[localizationPlan.language] || localizationPlan.language}`);
        break;
      } catch (err) {
        retries++;
        agentLog('a6', `WARNING: Localization attempt ${retries} failed for ${channel} — ${err.message}`, 'warn');
        await sleep(300);
      }
    }

    if (!localized) {
      agentLog('a6', `Fallback: using English content for ${channel} after ${MAX_RETRIES} retries`, 'warn');
      localizedContent[channel] = {
        ...draft,
        localized_content: draft.disclosed_content,
        content_for_formatting: draft.disclosed_content,
        language: 'EN',
        localized: false,
        localization_failed: true,
      };
      continue;
    }

    localizedContent[channel] = {
      ...draft,
      localized_content: localized,
      content_for_formatting: localized,
      language:          localizationPlan.language,
      localized:         true,
    };
  }

  agentLog('a6', 'Localization complete. Handing off to Agent 7 (Channel Formatter).', 'active');

  const a7Handoff = _buildHandoff(a6Input, localizedContent);
  _renderOutput(localizedContent, true);
  setStatus('a6', 'done');
  setTrack('track-a6', 'done');
  return a7Handoff;
}

// ── LLM localization ──────────────────────────────────────────────────────────

async function _localizeChannel(content, channel, context, attempt, languageCode) {
  // Extract statutory disclosure blocks before sending — pass them through locked
  const locks   = {};
  let lockIdx   = 0;
  let tokenized = content.replace(/\[DISCLOSURE:[^\]]+\]|\[To unsubscribe[^\]]+\]|\[UNRESOLVED[^\]]+\]/g, (m) => {
    const key = `__LOCK_${lockIdx++}__`;
    locks[key] = m;
    return key;
  });

  const retryNote = attempt > 0
    ? `\n⚠️ RETRY ${attempt}: Previous version failed validation. Preserve ALL __LOCK_N__ tokens exactly unchanged.`
    : '';

  const prompt = `You are Agent 6 of the GCN D2C Fintech pipeline — the Vernacular Localization Agent.

Translate and culturally adapt the following D2C fintech content from English to simple ${SUPPORTED_LANGUAGES[languageCode] || languageCode}.

RULES (CRITICAL):
1. ALL tokens in the format __LOCK_N__ must be preserved EXACTLY as-is — do not translate, paraphrase, or remove them.
2. Adapt financial idioms: EMI → "masik kist", loan → "rin", savings → "bachat", interest → "byaaj"
3. Use simple, warm, low-jargon ${SUPPORTED_LANGUAGES[languageCode] || languageCode}. Short sentences. No compound phrases.
4. For Hindi, prefer Devanagari script and low-literacy-friendly wording.
4. Keep the same channel format structure (SMS char constraint applies, push title/body applies).
5. Bharat-segment tone: warm, reassuring, like a trusted friend explaining finances.
6. Persona: ${context.selected_persona}
7. Channel: ${channel}
${retryNote}

CONTENT TO LOCALIZE:
${tokenized}

Return ONLY the adapted content. No explanation. Keep all __LOCK_N__ tokens in place.`;

  const res  = await puter.ai.chat(prompt, { model: 'claude-sonnet-4-6' });
  let output = res.message.content[0].text.trim();

  // Restore locked statutory blocks
  for (const [key, val] of Object.entries(locks)) {
    if (!output.includes(key)) {
      throw new Error(`Lock token ${key} was removed or altered during localization`);
    }
    output = output.replace(key, val);
  }

  if (!isLocalizedOutputValid(output, content, languageCode)) {
    throw new Error(`Localization validation failed for ${languageCode}`);
  }

  return output;
}

// ── Handoff builder ───────────────────────────────────────────────────────────

function _buildHandoff(input, localizedContent) {
  return {
    localized_content:    localizedContent,
    selected_persona:     input.selected_persona,
    product_category:     input.product_category,
    consumer_segment:     input.consumer_segment,
    campaign_intent:      input.campaign_intent,
    channel_mix:          input.channel_mix,
    vernacular_required:  input.vernacular_required,
    preferred_language:   input.preferred_language,
    key_compliance_flags: input.key_compliance_flags,
    hustler_flag:         input.hustler_flag,
  };
}

// ── Output renderer ───────────────────────────────────────────────────────────

function _renderOutput(localizedContent, wasLocalized) {
  const el = document.getElementById('out-a6');
  el.style.display = 'block';

  const localizedChannels = Object.values(localizedContent).filter(item => item.localized).length;
  const failedChannels = Object.values(localizedContent).filter(item => item.localization_failed).length;
  const cards = Object.entries(localizedContent).map(([ch, item]) => {
    const content = item.localized_content || '';
    const preview = content.length > 500 ? content.substring(0, 500) + '…' : content;

    // Highlight locked disclosures in blue
    const highlighted = preview
      .replace(/\[DISCLOSURE:[^\]]+\]|\[To unsubscribe[^\]]+\]/g,
        m => `<span style="color:#4090f0;font-size:10px">${m}</span>`)
      .replace(/\n/g, '<br>');

    return `
      <div class="out-card full">
        <div class="out-lbl" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span>${ch}</span>
          <span>
            <span class="tag ${item.localized ? 'warn' : 'ok'}">${item.language || 'EN'}</span>
            ${item.localized ? '<span class="tag info">LOCALIZED</span>' : '<span class="tag ok">PASSTHROUGH</span>'}
          </span>
        </div>
        <div style="font-size:11px;color:#888;line-height:1.8">${highlighted}</div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="out-grid">
      <div class="out-card full">
        <div class="out-lbl">Localization Summary</div>
        <div style="font-size:11px;color:#3a7a50;margin-top:4px">
          ${wasLocalized
            ? `${localizedChannels} channel(s) localized. Financial idioms adapted. Statutory blocks locked and preserved.${failedChannels ? ` ${failedChannels} channel(s) fell back to English after validation failure.` : ''}`
            : 'Vernacular not required — English content passed through unchanged.'}
        </div>
      </div>
      ${cards}
      <div class="out-card full">
        <div class="out-lbl">→ Handoff to Agent 7 (Channel Formatter)</div>
        <div style="font-size:11px;color:#3a7a50;margin-top:4px">
          All language variants ready for channel-specific formatting.
        </div>
      </div>
    </div>`;
}

function resolveLocalizationPlan(input) {
  const segment = String(input.consumer_segment || '').toLowerCase();
  const preferredLanguage = String(input.preferred_language || '').toUpperCase();
  const shouldLocalize =
    Boolean(input.vernacular_required) ||
    preferredLanguage === 'HI' ||
    segment.includes('bharat');

  return {
    shouldLocalize,
    language: shouldLocalize ? (preferredLanguage || 'HI') : 'EN'
  };
}

function isLocalizedOutputValid(output, original, languageCode) {
  const text = String(output || '').trim();
  if (!text) return false;
  if (languageCode === 'HI') {
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    const changedEnough = text !== String(original || '').trim();
    return hasDevanagari && changedEnough;
  }
  return text !== String(original || '').trim();
}
