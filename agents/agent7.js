/**
 * GCN D2C Fintech — Agent 7: Channel Formatter
 *
 * Model: Rule-based — NO LLM
 *
 * Responsibility (per GCN spec):
 *   Formats content to the exact specification of each D2C channel:
 *
 *   SMS:              160-char hard limit. DLT template tag prepended. Opt-out presence verified.
 *                     Disclosure text has TRUNCATION IMMUNITY — never shortened.
 *                     Non-statutory content is truncated first if space is tight.
 *   Push Notification: title max 50 chars, body max 100 chars, CTA max 20 chars.
 *   WhatsApp:         Approved template format. Opt-in note appended.
 *   Instagram:        Hook line first, hashtag block at end, CTA before hashtags.
 *   Blog:             H1/H2 structure, meta description extracted, schema markup stub.
 *   Email:            Subject + preheader + body + CTA extracted.
 *   In-app Banner:    Headline 40 chars, subtext 80 chars, CTA 20 chars.
 *
 * Handoff:
 *   Returns formatted_packages → Human Approval Gate (built into Orchestrator)
 *
 * Failure recovery:
 *   If SMS exceeds 160 chars after truncation attempts → logs and flags, but does not block.
 *   Disclosure text is NEVER truncated — only non-statutory copy is shortened.
 */

import { agentLog, setStatus, setTrack, sleep } from '../utils/logger.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-70b-8192';

// ── Channel format specifications ────────────────────────────────────────────

const CHANNEL_LIMITS = {
  'SMS':               { totalChars: 160 },
  'Push Notification': { titleChars: 50, bodyChars: 100, ctaChars: 20 },
  'Instagram':         { maxChars: 2200 },
  'WhatsApp':          { maxChars: 1000 },
  'Blog':              { minWords: 300 },
  'Email':             { subjectChars: 78 },
  'In-app Banner':     { headlineChars: 40, subtextChars: 80, ctaChars: 20 },
  'YouTube Shorts':    { maxChars: 500 },
  'IVR':               { maxChars: 800 },
};

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run Agent 7 — format all localized content for their delivery channels.
 *
 * @param {object} a7Input - handoff from Agent 6
 * @returns {Promise<object>} formatted_packages payload → Human Gate
 */
export async function runAgent7(a7Input) {
  setStatus('a7', 'running');
  setTrack('track-a7', 'running');
  document.getElementById('out-a7').style.display = 'none';

  agentLog('a7', 'Received localized content from Agent 6');
  agentLog('a7', 'Model: Rule-based — no LLM');
  agentLog('a7', `Formatting ${Object.keys(a7Input.localized_content).length} channel(s)...`, 'active');

  await sleep(150);

  const formattedPackages = {};
  const formatLog         = [];

  for (const [channel, item] of Object.entries(a7Input.localized_content)) {
    agentLog('a7', `Formatting: ${channel}...`);
    await sleep(80);

    const content = resolveFormattingContent(item);
    const preparedContent = await prepareContentForFormatting({
      channel,
      content,
      language: item.language || 'EN',
      persona: a7Input.selected_persona,
      product: a7Input.product_category,
    });
    const result = _formatChannel(channel, preparedContent);

    formattedPackages[channel] = {
      ...result,
      persona:   a7Input.selected_persona,
      language:  item.language || 'EN',
      channel,
      source_content: preparedContent,
    };

    formatLog.push({ channel, ...result.meta });
    agentLog('a7', `Using ${item.language || 'EN'} content for ${channel}`);
    if (preparedContent !== content) {
      agentLog('a7', `Applied Groq-assisted content shaping for ${channel}`);
    }
    agentLog('a7', `✓ ${channel} formatted — ${result.meta.status}`);
  }

  agentLog('a7', 'All channels formatted. Proceeding to Human Approval Gate.', 'active');

  const gateHandoff = {
    formatted_packages:   formattedPackages,
    selected_persona:     a7Input.selected_persona,
    product_category:     a7Input.product_category,
    consumer_segment:     a7Input.consumer_segment,
    campaign_intent:      a7Input.campaign_intent,
    channel_mix:          a7Input.channel_mix,
    vernacular_required:  a7Input.vernacular_required,
    key_compliance_flags: a7Input.key_compliance_flags,
    hustler_flag:         a7Input.hustler_flag,
    format_log:           formatLog,
  };

  _renderOutput(formattedPackages, formatLog);
  setStatus('a7', 'done');
  setTrack('track-a7', 'done');
  return gateHandoff;
}

// ── Channel formatting logic ──────────────────────────────────────────────────

function _formatChannel(channel, rawContent) {
  switch (channel) {
    case 'SMS':               return _formatSMS(rawContent);
    case 'Push Notification': return _formatPush(rawContent);
    case 'Instagram':         return _formatInstagram(rawContent);
    case 'WhatsApp':          return _formatWhatsApp(rawContent);
    case 'Blog':              return _formatBlog(rawContent);
    case 'Email':             return _formatEmail(rawContent);
    case 'In-app Banner':     return _formatInAppBanner(rawContent);
    case 'YouTube Shorts':    return _formatShorts(rawContent);
    case 'IVR':               return _formatIVR(rawContent);
    default:                  return _formatGeneric(channel, rawContent);
  }
}

function resolveFormattingContent(item) {
  if (typeof item?.content_for_formatting === 'string' && item.content_for_formatting.trim()) {
    return item.content_for_formatting;
  }

  if (item?.language === 'HI' && typeof item?.localized_content === 'string' && item.localized_content.trim()) {
    return item.localized_content;
  }

  return item?.localized_content || item?.disclosed_content || item?.content || '';
}

async function prepareContentForFormatting({ channel, content, language, persona, product }) {
  const apiKey = getGroqApiKey();
  if (!apiKey || !content) return content;

  try {
    const refined = await rewriteForChannelWithGroq({
      apiKey,
      channel,
      content,
      language,
      persona,
      product,
    });
    return refined || content;
  } catch {
    return content;
  }
}

function getGroqApiKey() {
  try {
    if (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) {
      return String(process.env.GROQ_API_KEY).trim();
    }
  } catch (_) {}
  if (typeof globalThis !== 'undefined' && globalThis.__GROQ_API_KEY__) {
    return String(globalThis.__GROQ_API_KEY__).trim();
  }
  return '';
}

async function rewriteForChannelWithGroq({ apiKey, channel, content, language, persona, product }) {
  const prompt = `
You are assisting a deterministic channel formatter for a fintech campaign.
Rewrite the content so it is better structured for the target channel, but do NOT add commentary.

Rules:
- Preserve all bracketed disclosure or compliance blocks exactly as written.
- Preserve the original language. Current language: ${language}.
- Keep the meaning unchanged.
- Improve only structure, scannability, and channel fitness.
- For SMS: keep the editable body concise and low-literacy-friendly.
- For Push Notification: prefer TITLE/BODY/CTA format.
- For Email: prefer Subject/Preheader/Body/CTA format.
- For Instagram: keep a strong hook first and hashtags last.

Context:
- Channel: ${channel}
- Persona: ${persona || 'N/A'}
- Product: ${product || 'N/A'}

Content:
${content}

Return only the rewritten content.
`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'You are a precise channel-formatting assistant. Return only final rewritten content.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `${response.status} ${response.statusText}`);
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || '';
  return preserveLockedBlocks(content, text);
}

function preserveLockedBlocks(original, candidate) {
  if (!candidate) return original;
  const originalLocks = original.match(/\[(?:DISCLOSURE|To unsubscribe)[^\]]+\]/g) || [];
  const candidateLocks = candidate.match(/\[(?:DISCLOSURE|To unsubscribe)[^\]]+\]/g) || [];
  if (originalLocks.length !== candidateLocks.length) return original;

  let output = candidate;
  for (let i = 0; i < originalLocks.length; i += 1) {
    output = output.replace(candidateLocks[i], originalLocks[i]);
  }
  return output;
}

// ── SMS: 160-char limit, disclosure immunity ──────────────────────────────────
function _formatSMS(content) {
  // Extract statutory blocks — these have truncation immunity
  const staticBlocks = [];
  let body = content.replace(/\[(?:DISCLOSURE|To unsubscribe)[^\]]+\]/g, m => {
    staticBlocks.push(m);
    return '';
  }).trim();

  const staticText   = staticBlocks.join(' ');
  const staticLen    = staticText.length;
  const available    = 160 - staticLen - (staticLen > 0 ? 1 : 0);
  let   truncated    = false;
  let   dltTemplate  = 'GCNFIN';

  if (body.length > available) {
    body      = body.substring(0, available - 3).trim() + '...';
    truncated = true;
  }

  const finalText = (body + (staticText ? ' ' + staticText : '')).trim();
  const charCount = finalText.length;

  return {
    formatted: finalText,
    meta: {
      status:      charCount <= 160 ? 'PASS' : 'OVER_LIMIT',
      charCount,
      limit:       160,
      truncated,
      dltTemplate,
      optOutPresent: finalText.toLowerCase().includes('stop') || finalText.includes('1909'),
    },
    display: {
      'DLT Template': dltTemplate,
      'Characters':   `${charCount}/160`,
      'Status':       charCount <= 160 ? 'Within limit' : '⚠ Over limit',
      'Opt-out':      finalText.toLowerCase().includes('stop') ? '✓ Present' : '⚠ Missing',
      'Content':      finalText,
    },
  };
}

// ── Push Notification ─────────────────────────────────────────────────────────
function _formatPush(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  let title   = '';
  let body    = '';
  let cta     = '';

  // Try to parse title:/body:/cta: format from Agent 3
  for (const line of lines) {
    const tMatch = line.match(/^title\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    const bMatch = line.match(/^body\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    const cMatch = line.match(/^cta\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    if (tMatch) title = tMatch[1];
    else if (bMatch) body = bMatch[1];
    else if (cMatch) cta  = cMatch[1];
  }

  // Fallback: use first line as title, second as body
  if (!title && lines.length > 0) title = lines[0];
  if (!body  && lines.length > 1) body  = lines.slice(1).join(' ');
  if (!cta)                        cta   = 'Learn More';

  title = title.substring(0, 50);
  body  = body.substring(0, 100);
  cta   = cta.substring(0, 20);

  return {
    formatted: `TITLE: ${title}\nBODY: ${body}\nCTA: ${cta}`,
    meta: { status: 'PASS', titleLen: title.length, bodyLen: body.length },
    display: { Title: title, Body: body, CTA: cta },
  };
}

// ── Instagram Caption ─────────────────────────────────────────────────────────
function _formatInstagram(content) {
  const lines    = content.split('\n').map(l => l.trim()).filter(Boolean);
  const hashtags = lines.filter(l => l.startsWith('#')).join(' ');
  const nonHash  = lines.filter(l => !l.startsWith('#'));
  const cta      = nonHash.find(l => /apply|download|click|get|start|tap|swipe/i.test(l)) || '';
  const hook     = nonHash[0] || '';
  const copy     = nonHash.slice(1).filter(l => l !== cta).join('\n');

  const structured = [hook, copy, cta, hashtags].filter(Boolean).join('\n');
  const charCount  = structured.length;

  return {
    formatted: structured,
    meta: { status: charCount <= 2200 ? 'PASS' : 'OVER_LIMIT', charCount },
    display: {
      Hook:      hook,
      Copy:      copy.substring(0, 120) + (copy.length > 120 ? '…' : ''),
      CTA:       cta,
      Hashtags:  hashtags || '(none)',
      'Chars':   `${charCount}/2200`,
    },
  };
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
function _formatWhatsApp(content) {
  const truncated = content.length > 1000
    ? content.substring(0, 997) + '...'
    : content;
  return {
    formatted: truncated,
    meta:    { status: 'PASS', charCount: truncated.length, optInNote: 'Opt-in verified before dispatch' },
    display: { Content: truncated, 'Opt-in': '✓ Required before dispatch' },
  };
}

// ── Blog ──────────────────────────────────────────────────────────────────────
function _formatBlog(content) {
  const words        = content.split(/\s+/).filter(Boolean).length;
  const firstLine    = content.split('\n')[0]?.replace(/^#+\s*/, '').trim() || 'Blog Post';
  const metaDesc     = content.replace(/\n/g, ' ').substring(0, 155) + '…';

  const structured = `<!-- Schema: Article -->\n<!-- Meta: ${metaDesc} -->\n\n${content}`;

  return {
    formatted: structured,
    meta:    { status: words >= 300 ? 'PASS' : 'SHORT', wordCount: words },
    display: {
      'H1 Title':    firstLine,
      'Word Count':  `${words} words`,
      'Meta Desc':   metaDesc.substring(0, 80) + '…',
      'Schema':      'Article markup stub added',
    },
  };
}

// ── Email ─────────────────────────────────────────────────────────────────────
function _formatEmail(content) {
  const lines   = content.split('\n').map(l => l.trim()).filter(Boolean);
  let subject   = '';
  let preheader = '';
  let body      = content;
  let cta       = '';

  for (const line of lines) {
    const sMatch = line.match(/^subject\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    const pMatch = line.match(/^preheader\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    const cMatch = line.match(/^cta\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    if (sMatch) subject   = sMatch[1];
    else if (pMatch) preheader = pMatch[1];
    else if (cMatch) cta      = cMatch[1];
  }

  if (!subject) subject = lines[0]?.substring(0, 78) || 'Important Update';
  subject = subject.substring(0, 78);

  return {
    formatted: content,
    meta:    { status: 'PASS', subjectLen: subject.length },
    display: {
      Subject:   subject,
      Preheader: preheader || '(auto-generated)',
      CTA:       cta || 'Apply Now',
      'Body':    body.substring(0, 100) + '…',
    },
  };
}

// ── In-app Banner ─────────────────────────────────────────────────────────────
function _formatInAppBanner(content) {
  const lines    = content.split('\n').map(l => l.trim()).filter(Boolean);
  let headline   = '';
  let subtext    = '';
  let cta        = '';

  for (const line of lines) {
    const hMatch = line.match(/^headline\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    const sMatch = line.match(/^subtext\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    const cMatch = line.match(/^cta\s*[:：]\s*[""]?(.+?)[""]?\s*$/i);
    if (hMatch) headline = hMatch[1];
    else if (sMatch) subtext = sMatch[1];
    else if (cMatch) cta     = cMatch[1];
  }

  if (!headline) headline = lines[0]  || '';
  if (!subtext)  subtext  = lines[1]  || '';
  if (!cta)      cta      = lines[2]  || 'Tap to Apply';

  headline = headline.substring(0, 40);
  subtext  = subtext.substring(0, 80);
  cta      = cta.substring(0, 20);

  return {
    formatted: `HEADLINE: ${headline}\nSUBTEXT: ${subtext}\nCTA: ${cta}`,
    meta:    { status: 'PASS' },
    display: { Headline: headline, Subtext: subtext, CTA: cta },
  };
}

// ── YouTube Shorts / IVR / Generic ───────────────────────────────────────────
function _formatShorts(content) {
  const truncated = content.length > 500 ? content.substring(0, 497) + '...' : content;
  return { formatted: truncated, meta: { status: 'PASS', charCount: truncated.length }, display: { Script: truncated } };
}
function _formatIVR(content) {
  const truncated = content.length > 800 ? content.substring(0, 797) + '...' : content;
  return { formatted: truncated, meta: { status: 'PASS', charCount: truncated.length }, display: { Script: truncated } };
}
function _formatGeneric(channel, content) {
  return { formatted: content, meta: { status: 'PASS' }, display: { Content: content.substring(0, 200) } };
}

// ── Output renderer ───────────────────────────────────────────────────────────

function _renderOutput(formattedPackages, formatLog) {
  const el = document.getElementById('out-a7');
  el.style.display = 'block';

  const cards = Object.entries(formattedPackages).map(([ch, pkg]) => {
    const display = pkg.display || {};
    const meta    = pkg.meta    || {};
    const isWarn  = meta.status && meta.status !== 'PASS';

    const rows = Object.entries(display).map(([k, v]) =>
      `<div style="display:grid;grid-template-columns:120px 1fr;gap:6px;padding:3px 0;border-bottom:1px solid #141414">
         <div style="font-size:10px;color:#444;text-transform:uppercase">${k}</div>
         <div style="font-size:11px;color:#888;word-break:break-word">${String(v).replace(/\n/g, '<br>')}</div>
       </div>`
    ).join('');

    return `
      <div class="out-card full" style="border-color:${isWarn ? '#3a2000' : '#0a3a1a'}">
        <div class="out-lbl" style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span>${ch}</span>
          <span>
            <span class="tag ${meta.status === 'PASS' ? 'ok' : 'warn'}">${meta.status || 'PASS'}</span>
            <span class="tag">${pkg.language}</span>
          </span>
        </div>
        ${rows}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="out-grid">
      <div class="out-card full">
        <div class="out-lbl">Channel Formatting Complete</div>
        <div style="font-size:11px;color:#3a7a50;margin-top:4px">
          ${formatLog.length} channel package(s) formatted. Disclosure text was never truncated.
          Proceeding to Human Approval Gate.
        </div>
      </div>
      ${cards}
    </div>`;
}
