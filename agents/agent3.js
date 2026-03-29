/**
 * GCN D2C Fintech — Agent 3: D2C Writer Agent
 *
 * Updated:
 * - Replaced PERSONA_VOICE with structured PERSONA_SYSTEM
 * - Added strict persona enforcement
 * - Added few-shot examples
 * - Improved prompt clarity and control
 */

import { agentLog, setStatus, setTrack, sleep } from '../utils/logger.js';
import { validatePersonaOutput } from "./personaValidator.js";

// ── Structured Persona System ────────────────────────────────────────────────

const PERSONA_SYSTEM = {
  'The Hustler': {
    role: "Aggressive fintech growth marketer targeting Gen Z users",

    context: `
Audience: Gen Z (18–25), mobile-first, short attention span
Use case: Instant loans, quick cash needs, urgency-driven decisions
Platform behavior: Instagram, WhatsApp, push notifications
    `,

    tone: `
Energetic, punchy, informal
High urgency and action-driven language
Short sentences, conversational
    `,

    format: `
- Hook first (1 line)
- Benefit (1–2 lines)
- CTA (1 line)
- Keep sentences under 10 words
    `,

    guidelines: [
      "Use urgency words: now, instant, today, hurry",
      "Include at least one CTA",
      "Keep content concise and high-impact",
      "Use numbers and currency (₹) where relevant"
    ],

    forbidden: [
      "guaranteed", "risk-free", "assured", "no risk"
    ],

    task: `
Generate high-conversion marketing content that drives immediate action 
while maintaining compliance.
    `,

    examples: [
      "Get ₹50,000 instantly. Apply now.",
      "Cash when you need it. Start today."
    ]
  },

  'The Planner': {
    role: "Analytical financial decision advisor",

    context: `
Audience: Salaried professionals, comparison-driven users
Use case: Evaluating loan or financial products
Platform: Blog, email, push notifications
    `,

    tone: `
Professional, structured, logical
Clear and informative
    `,

    format: `
- Introduction
- Key features
- Fees and rates
- CTA
    `,

    guidelines: [
      "Explain clearly using structured points",
      "Include numbers and comparisons",
      "Build trust through clarity"
    ],

    forbidden: [
      "vague claims", "emotional exaggeration"
    ],

    task: `
Generate structured, informative content enabling rational decision-making.
    `,

    examples: [
      "Compare interest rates before choosing your loan.",
      "Transparent pricing with clear repayment options."
    ]
  },

  'The Neighbour': {
    role: "Friendly advisor for Bharat users",

    context: `
Audience: Tier 2/3 users
Language: Hindi or regional
Use case: Simple understanding of loans
    `,

    tone: `
Warm, simple, conversational
Very low jargon
    `,

    format: `
- Simple opening
- Explanation
- CTA
    `,

    guidelines: [
      "Use simple Hindi words",
      "Avoid English financial jargon",
      "Explain like speaking to a friend"
    ],

    forbidden: [
      "complex sentences", "technical jargon"
    ],

    task: `
Explain financial products in a simple and relatable way.
    `,

    examples: [
      "Aapko turant loan chahiye? Aaj hi apply karein.",
      "Asaan mahine ki kist ke saath loan paayein."
    ]
  },
    'The Advisor': {
    role: "Data-driven financial expert guiding investment decisions",

    context: `
Audience: Millennial investors (28–40)
Use case: Evaluating investment products, long-term financial planning
Platform: Blog, push notifications, long-form content
    `,

    tone: `
Calm, authoritative, data-driven
Balanced and caveat-aware
Professional but accessible
    `,

    format: `
- Insight-driven opening
- Data or reasoning
- Risk explanation
- CTA (subtle, not aggressive)
    `,

    guidelines: [
      "Use data points and reasoning",
      "Include risk awareness where applicable",
      "Maintain a balanced and informative tone",
      "Focus on long-term value, not urgency"
    ],

    forbidden: [
      "guaranteed returns",
      "assured profit",
      "no risk investment"
    ],

    task: `
Generate informative financial content that builds credibility and helps users make informed investment decisions.
    `,

    examples: [
      "Evaluate returns alongside associated risks before investing.",
      "A diversified approach helps manage long-term uncertainty."
    ]
  },

  'The Trustee': {
    role: "Formal and empathetic financial support representative",

    context: `
Audience: All users in grievance or support scenarios
Use case: Complaint resolution, issue handling, support communication
Platform: Email, in-app messages
    `,

    tone: `
Formal, empathetic, resolution-focused
Clear, respectful, and reassuring
    `,

    format: `
- Acknowledge concern
- Provide resolution steps
- Offer assistance
- Reference support channels
    `,

    guidelines: [
      "Acknowledge user concerns clearly",
      "Provide actionable resolution steps",
      "Maintain formal and respectful tone",
      "Build trust through clarity and accountability"
    ],

    forbidden: [
      "casual language",
      "marketing tone",
      "uncertain statements"
    ],

    task: `
Generate formal, empathetic responses that address user concerns and provide clear resolution pathways.
    `,

    examples: [
      "We understand your concern and are actively working on a resolution.",
      "Please find the next steps outlined below to resolve your issue."
    ]
  }
};

// ── Channel format specs (unchanged) ─────────────────────────────────────────

const CHANNEL_SPECS = {
  'SMS': `Format: Max 160 characters. Include [DISCLOSURE_PLACEHOLDER].`,
  'Push Notification': `Title + Body + CTA format.`,
  'Instagram': `Hook, copy, CTA, hashtags.`,
  'WhatsApp': `Conversational format.`,
  'Blog': `Structured long-form.`,
  'Email': `Professional structured email.`,
  'In-app Banner': `Headline + Subtext + CTA.`
};

function resolvePersona(selectedKey) {
  const p = PERSONA_SYSTEM[selectedKey];
  if (p) return { def: p, key: selectedKey };
  return {
    def: {
      role: `Unmapped persona "${selectedKey || 'unknown'}". Write clear, compliant marketing copy.`,
      context: 'General D2C audience.',
      tone: 'Professional and approachable.',
      format: 'Match the channel specification.',
      guidelines: ['Stay factual', 'Include a clear CTA where appropriate', 'Respect channel limits'],
      forbidden: ['guaranteed', 'risk-free', 'assured returns'],
      task: 'Produce on-brief channel content.',
      examples: []
    },
    key: selectedKey || 'Fallback'
  };
}

// ── Main agent function (unchanged logic) ─────────────────────────────────────

export async function runAgent3(handoff, brief) {
  setStatus('a3', 'running');
  setTrack('track-a3', 'running');

  const channels = handoff.channel_mix || [];
  const draftContent = {};
  const personaBundle = resolvePersona(handoff.selected_persona);

  agentLog('a3', 'Received handoff from Agent 2');
  agentLog('a3', `Persona locked: ${personaBundle.key}`, 'active');
  agentLog('a3', `Persona role: ${personaBundle.def.role}`);
  agentLog('a3', `Channels requested: ${channels.join(', ') || 'none'}`);

  for (const channel of channels) {
    let success = false;
    let attempt = 0;

    agentLog('a3', `Preparing ${channel} with strict persona behaviour rules`, 'active');

    while (!success && attempt < 3) {
      attempt++;
      try {
        agentLog('a3', `${channel}: generation attempt ${attempt}/3`);
        const content = await _generateChannelContent(handoff, brief, channel, attempt, personaBundle);
        agentLog('a3', `${channel}: draft generated, running persona validation`);

        const validation = await validatePersonaOutput({
          content,
          persona: personaBundle.def,
          channel,
          product: handoff.product_category
        });

        const scorePct = Math.round((Number(validation.score) || 0) * 100);
        const issues = Array.isArray(validation.issues) ? validation.issues.filter(Boolean) : [];
        agentLog(
          'a3',
          `${channel}: validation ${validation.verdict} (${scorePct}%)`,
          validation.verdict === 'PASS' ? 'active' : 'warn'
        );
        if (issues.length) {
          agentLog('a3', `${channel}: ${issues[0]}`, validation.verdict === 'PASS' ? undefined : 'warn');
        }

        if (validation.verdict === "PASS") {
          draftContent[channel] = {
            content,
            channel,
            validation
          };
          agentLog('a3', `${channel}: persona-compliant draft accepted`, 'active');
          success = true;
        } else if (attempt >= 3) {
          draftContent[channel] = {
            content,
            channel,
            validation,
            forced: true
          };
          agentLog('a3', `${channel}: max retries reached, using last draft with warning flag`, 'warn');
          success = true;
        } else {
          agentLog('a3', `${channel}: retrying with tighter persona enforcement`, 'warn');
        }
      } catch (err) {
        agentLog('a3', `${channel}: generation error on attempt ${attempt} — ${err.message}`, 'warn');
        await sleep(200);
      }
    }
  }

  agentLog('a3', 'Draft generation complete. Handing off to Agent 4.', 'active');

  setStatus('a3', 'done');
  setTrack('track-a3', 'done');

  return {
    draft_content: draftContent,
    selected_persona: handoff.selected_persona,
    consumer_segment: handoff.consumer_segment,
    product_category: handoff.product_category,
    campaign_intent: handoff.campaign_intent,
    channel_mix: handoff.channel_mix,
    compliance_risk: handoff.compliance_risk,
    vernacular_required: handoff.vernacular_required,
    preferred_language: handoff.preferred_language,
    key_compliance_flags: handoff.key_compliance_flags,
    hustler_flag: handoff.hustler_flag
  };
}

// ── Updated Prompt Injection ─────────────────────────────────────────────────

async function _generateChannelContent(handoff, brief, channel, attempt, personaBundle) {

  const persona = personaBundle.def;
  const channelSpec = CHANNEL_SPECS[channel] || "";

  const guidelinesText = (persona.guidelines || []).join("\n- ");
  const forbiddenText = (persona.forbidden || []).join(", ");
  const examplesText = (persona.examples || []).length
    ? persona.examples.join("\n- ")
    : "(none)";

  const personaPrompt = `
PERSONA DEFINITION:

ROLE:
${persona.role}

CONTEXT:
${persona.context}

TONE:
${persona.tone}

FORMAT RULES:
${persona.format}

GUIDELINES:
- ${guidelinesText}

FORBIDDEN:
${forbiddenText}

TASK:
${persona.task}

EXAMPLES:
- ${examplesText}
`;

  const strictRules = `
STRICT PERSONA RULES:
- Follow ROLE and CONTEXT strictly
- Follow FORMAT exactly
- Follow GUIDELINES strictly
- NEVER use FORBIDDEN terms
- Output must clearly reflect the defined persona
`;

  const prompt = `
You are Agent 3 of a fintech AI system.

${personaPrompt}

CHANNEL: ${channel}
FORMAT: ${channelSpec}

CONTENT BRIEF:
${brief}

${strictRules}

RULES:
1. Output only final content
2. Insert [DISCLOSURE_PLACEHOLDER] where needed
3. No explanation or metadata

`;

  const res = await puter.ai.chat(prompt, { model: 'claude-sonnet-4-6' });
  return res.message.content[0].text.trim();
}
