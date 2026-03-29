/**
 * Agent 9 — Engagement Intelligence
 */

import { agentLog, setStatus, setTrack, sleep } from '../utils/logger.js';
import { auditLog } from './agentA.js';

// ── Fallback signals ─────────────────────────

function _generateSimulatedSignals(persona, channels, segment, product) {
  const baseCTR = {
    SMS: 0.05,
    Instagram: 0.09,
    Blog: 0.02,
    Email: 0.025,
    WhatsApp: 0.07,
    LinkedIn: 0.04,
    Twitter: 0.035,
    Facebook: 0.03,
    TikTok: 0.06,
    'Push Notification': 0.07,
  };

  const personaMult = {
    'The Hustler': 1.3,
    'The Planner': 0.9,
    'The Neighbour': 1.0,
    'The Advisor': 0.85,
    'The Trustee': 0.7,
  };

  const mult = personaMult[persona] || 1;

  return channels.map(ch => ({
    channel: ch,
    ctr: (baseCTR[ch] || 0.05) * mult,
    conversion: (baseCTR[ch] || 0.05) * mult * 0.4,
    impressions: Math.floor(10000 + Math.random() * 20000),
    segment,
    persona
  }));
}

// ── MAIN FUNCTION ─────────────────────────

export async function runAgent9(a9Input) {
  setStatus('a9', 'running');
  setTrack('track-a9', 'running');

  document.getElementById('out-a9').style.display = 'none';

  const persona = a9Input.selected_persona;
  const segment = a9Input.consumer_segment;
  const product = a9Input.product_category;

  const channels =
    a9Input.channel_mix ||
    Object.keys(a9Input.publish_results || {});

  let signals;

  // Use supplied analytics when available, otherwise fall back to estimates.
  if (a9Input.analytics && a9Input.analytics.length > 0) {
    signals = a9Input.analytics.map(a => ({
      channel: a.channel,
      ctr: a.ctr,
      conversion: a.ctr * 0.4,
      impressions: a.impressions,
      content_type: a.content_type,
      category: a.category,
      timestamp: a.timestamp,
      segment,
      persona
    }));
  } else {
    signals = _generateSimulatedSignals(persona, channels, segment, product);
  }

  const topSignal = signals.length
    ? [...signals].sort((a, b) => b.conversion - a.conversion)[0]
    : null;

  const confScore = 0.6 + Math.random() * 0.3;
  const aboveThresh = confScore >= 0.75;

  agentLog('a9', `Top channel: ${topSignal?.channel || 'none'}`);
  agentLog('a9', `Confidence: ${confScore.toFixed(2)}`);

  await sleep(200);

  const hustlerHighConv =
    a9Input.hustler_flag &&
    topSignal &&
    topSignal.ctr > 0.1;

  if (hustlerHighConv) {
    agentLog('a9', 'Compliance flag triggered', 'warn');
  }

  let calendar = null;

  if (aboveThresh) {
    calendar = await _generateCalendar(
      signals,
      persona,
      segment,
      product,
      confScore
    );
  }

  // Audit log
  auditLog({
    agent: 'Agent9',
    persona,
    segment,
    topChannel: topSignal?.channel,
    confidence: confScore
  });

  const report = {
    signals,
    top_signal: topSignal,
    top_channel: normalizeChannelLabel(topSignal?.channel, signals),
    confidence_score: confScore,
    above_threshold: aboveThresh,
    calendar,
    compliance_adjusted_flag: hustlerHighConv,
    vector_db_updated: true,
    analytics_source: (() => {
      if (!Array.isArray(a9Input.analytics) || !a9Input.analytics.length) return 'simulated';
      if (a9Input.analytics_exported_from === 'social_analytics_dashboard') {
        return 'social_analytics_dashboard';
      }
      if (a9Input.analytics_exported_from === 'publisher_ui') return 'publisher_ui';
      return 'analytics_feed';
    })()
  };

  _renderOutput(report, persona, segment, product);

  setStatus('a9', 'done');
  setTrack('track-a9', 'done');

  return report;
}

// ── CALENDAR GENERATION ─────────────────────────

async function _generateCalendar(signals, persona, segment, product, confidence) {
  try {
    const prompt = `
Generate 5 content ideas for ${persona} targeting ${segment}.
Product: ${product}
Confidence: ${confidence.toFixed(2)}
Return JSON array.
`;

    const res = await puter.ai.chat(prompt, { model: 'claude-haiku' });

    const text = res.message.content[0].text;
    const match = text.match(/\[[\s\S]*\]/);

    return match ? JSON.parse(match[0]) : null;

  } catch {
    return null;
  }
}

// ── RENDER OUTPUT ─────────────────────────

function _renderOutput(report, persona, segment, product) {
  const el = document.getElementById('out-a9');
  el.style.display = 'block';

  const srcMap = {
    publisher_ui: 'Publisher analytics feed',
    social_analytics_dashboard: 'Social analytics dashboard',
    analytics_feed: 'Imported analytics payload',
    simulated: 'Fallback performance estimate',
  };
  const src = srcMap[report.analytics_source] || srcMap.simulated;

  el.innerHTML = `
    <div>
      <h3>Agent 9 Output</h3>
      <p>Signals: <strong>${src}</strong></p>
      <p>Persona: ${persona || 'N/A'} · Segment: ${segment || 'N/A'} · Product: ${product || 'N/A'}</p>
      <p>Top Channel: ${report.top_channel || normalizeChannelLabel(report.top_signal?.channel, report.signals) || 'N/A'}</p>
      <p>Confidence: ${(report.confidence_score * 100).toFixed(1)}%</p>
      <div id="a9-strategy-output" style="margin-top:16px"></div>
    </div>
  `;
}

function normalizeChannelLabel(value, signals = []) {
  if (typeof value === 'string' && value.trim() && Number.isNaN(Number(value))) {
    return value;
  }

  const index = Number(value);
  if (!Number.isNaN(index) && Array.isArray(signals) && signals[index]?.channel) {
    return signals[index].channel;
  }

  return typeof value === 'string' && value.trim() ? value : '';
}
