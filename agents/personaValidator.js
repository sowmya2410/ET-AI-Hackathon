/**
 * Persona behavior validation — Groq (optional) + deterministic scoring fallback.
 * Uses global fetch (browser or Node 18+). Do not use node-fetch (breaks browser modules).
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama3-70b-8192';

/** Subscore weights must match the evaluator prompt. */
const WEIGHT = {
  persona: 0.4,
  guideline: 0.3,
  product: 0.2,
  channel: 0.1
};

const PASS_THRESHOLD = 0.2;

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

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function weightedScore(personaMatch, guidelineMatch, productMatch, channelMatch) {
  return (
    WEIGHT.persona * clamp01(personaMatch) +
    WEIGHT.guideline * clamp01(guidelineMatch) +
    WEIGHT.product * clamp01(productMatch) +
    WEIGHT.channel * clamp01(channelMatch)
  );
}

function extractJsonObject(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeVerdict(score) {
  return score >= PASS_THRESHOLD ? 'PASS' : 'RETRY';
}

/**
 * Deterministic validation when API key is missing or the remote call fails.
 * @param {'offline'|'recover'} mode - offline adds a hint when no Groq key; recover skips that hint
 */
function localValidatePersonaOutput({ content, persona, channel, product }, mode = 'recover') {
  const text = (content || '').trim();
  const issues = [];
  if (!text) {
    return fallbackFromSubscores(0, 0, 0, 0, ['Empty content']);
  }

  const forbidden = Array.isArray(persona?.forbidden) ? persona.forbidden : [];
  let guidelineMatch = 0.85;
  for (const phrase of forbidden) {
    if (!phrase) continue;
    if (text.toLowerCase().includes(String(phrase).toLowerCase())) {
      issues.push(`Forbidden phrase surfaced: "${phrase}"`);
      guidelineMatch -= 0.35;
    }
  }
  guidelineMatch = clamp01(guidelineMatch);

  let channelMatch = 0.75;
  const len = text.length;
  if (channel === 'SMS' && len > 160) issues.push('SMS may exceed 160 characters');
  if (channel === 'SMS' && !/\[DISCLOSURE/i.test(text) && !/DISCLOSURE_PLACEHOLDER/i.test(text)) {
    issues.push('SMS should include disclosure placeholder where required');
    channelMatch -= 0.15;
  }
  channelMatch = clamp01(channelMatch);

  const productMatch = product && text.toLowerCase().includes(String(product).toLowerCase().slice(0, 12)) ? 0.8 : 0.55;
  const personaMatch = issues.length === 0 ? 0.72 : 0.45;

  const subs = {
    persona_match: personaMatch,
    guideline_match: guidelineMatch,
    product_match: productMatch,
    channel_match: channelMatch
  };
  const score = weightedScore(subs.persona_match, subs.guideline_match, subs.product_match, subs.channel_match);
  const outIssues = issues.length ? [...issues] : [];
  if (outIssues.length === 0 && mode === 'offline') {
    outIssues.push('Local heuristic only — set process.env.GROQ_API_KEY or globalThis.__GROQ_API_KEY__ for LLM judge');
  }
  return {
    ...subs,
    score,
    issues: outIssues,
    verdict: normalizeVerdict(score)
  };
}

function fallbackFromSubscores(pm, gm, prm, cm, issues) {
  const score = weightedScore(pm, gm, prm, cm);
  return {
    score,
    persona_match: clamp01(pm),
    guideline_match: clamp01(gm),
    product_match: clamp01(prm),
    channel_match: clamp01(cm),
    issues,
    verdict: normalizeVerdict(score)
  };
}

function fallbackResult(reason) {
  return fallbackFromSubscores(0.1, 0.1, 0.1, 0.1, [reason]);
}

/**
 * Validates generated content against persona behavior and product intent.
 */
export async function validatePersonaOutput({
  content,
  persona,
  channel,
  product = 'Financial Product'
}) {
  const role = persona?.role ?? 'Unknown role';
  const tone = persona?.tone ?? '';
  const guidelines = Array.isArray(persona?.guidelines) ? persona.guidelines : [];
  const forbiddenList = Array.isArray(persona?.forbidden) ? persona.forbidden : [];

  if (!persona || guidelines.length === 0) {
    return fallbackResult('Invalid or empty persona definition (guidelines required)');
  }

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    return localValidatePersonaOutput({ content, persona, channel, product }, 'offline');
  }

  const prompt = `
You are a strict evaluator for fintech marketing content.

Evaluate how well the content matches:
1. Persona behavior (role, tone, guidelines)
2. Product alignment
3. Channel appropriateness

PERSONA:
Role: ${role}
Tone: ${tone}
Guidelines:
- ${guidelines.join('\n- ')}
Forbidden terms (must NOT appear literally): ${forbiddenList.join(', ') || '(none specified)'}

PRODUCT:
${product}

CHANNEL:
${channel}

CONTENT:
${content}

Evaluation Criteria (use these weights when setting subscores):
- Persona Tone Match (${WEIGHT.persona * 100}%)
- Guideline Adherence (${WEIGHT.guideline * 100}%)
- Product Relevance (${WEIGHT.product * 100}%)
- Channel Fit (${WEIGHT.channel * 100}%)

Return STRICT JSON ONLY (no markdown fences):
{
  "score": number between 0 and 1,
  "persona_match": number between 0 and 1,
  "guideline_match": number between 0 and 1,
  "product_match": number between 0 and 1,
  "channel_match": number between 0 and 1,
  "issues": ["list of issues"],
  "verdict": "PASS" or "RETRY"
}

Rules:
- Subscores must be consistent with your reasoning.
- If score < ${PASS_THRESHOLD} → verdict must be "RETRY"
- If score >= ${PASS_THRESHOLD} → verdict can be "PASS"
- Be strict. Penalize weak tone or mismatch.
`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a strict JSON evaluator. Output only a single JSON object.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data?.error?.message || `${response.status} ${response.statusText}`;
      const local = localValidatePersonaOutput({ content, persona, channel, product }, 'recover');
      local.issues.unshift(`Groq API error: ${msg}`);
      return local;
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    const parsed = extractJsonObject(text);

    if (!parsed) {
      return fallbackResult('Invalid JSON response from model');
    }

    const pm = clamp01(parsed.persona_match);
    const gm = clamp01(parsed.guideline_match);
    const prm = clamp01(parsed.product_match);
    const cm = clamp01(parsed.channel_match);
    const computed = weightedScore(pm, gm, prm, cm);

    const modelScore = clamp01(parsed.score);
    const scoreDisagreement = Math.abs(modelScore - computed) > 0.12;
    const score = scoreDisagreement ? computed : clamp01(parsed.score ?? computed);

    const issues = Array.isArray(parsed.issues) ? [...parsed.issues] : [];
    if (scoreDisagreement) {
      issues.push('Score reconciled from weighted subscores (persona/guideline/product/channel)');
    }

    const verdict = normalizeVerdict(score);

    return {
      score,
      persona_match: pm,
      guideline_match: gm,
      product_match: prm,
      channel_match: cm,
      issues,
      verdict
    };
  } catch (error) {
    const local = localValidatePersonaOutput({ content, persona, channel, product }, 'recover');
    local.issues.unshift(`Validation request failed: ${error?.message || String(error)}`);
    return local;
  }
}
