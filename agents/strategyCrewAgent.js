/**
 * Strategy Intelligence Layer (Crew-style logic)
 */

import { getAnalyticsHistory } from '../data/analyticsMemory.js';

export async function runStrategyCrewLayer(a9Output) {
  const history = getAnalyticsHistory();
  const currentSignals = a9Output.signals || [];

  // STEP 1 — Aggregate patterns
  const pattern = analyzePatterns(history, currentSignals);

  //  STEP 2 — Detect shift
  const shift = detectStrategyShift(pattern);

  //  STEP 3 — Generate new mix
  const newMix = generateContentMix(pattern);

  //  STEP 4 — Generate improved calendar
  const improvedCalendar = generateImprovedCalendar(newMix);

  // STEP 5 — Claude-based strategy analysis
  const llmAnalysis = await analyzeStrategyWithClaude({
    persona: a9Output.top_signal?.persona,
    segment: currentSignals[0]?.segment,
    topSignal: a9Output.top_signal,
    pattern,
    newMix,
    improvedCalendar
  });

  const finalOutput = {
    ...a9Output,
    pattern_detected: pattern,
    strategy_shift: shift,
    new_content_mix: newMix,
    improved_calendar: improvedCalendar,
    strategy_analysis: llmAnalysis
  };

  renderStrategyCrewOutput(finalOutput);

  return finalOutput;
}

function analyzePatterns(history, currentSignals = []) {
  const channelStats = {};

  for (const batch of history) {
    for (const item of batch?.data || []) {
      const key = `${item.channel}_${item.content_type}_${item.timestamp}`;

      if (!channelStats[key]) {
        channelStats[key] = {
          channel: item.channel || 'Unknown',
          content_type: item.content_type || 'unknown',
          timestamp: item.timestamp ?? 'unknown',
          category: {},
          totalCTR: 0,
          count: 0
        };
      }

      channelStats[key].totalCTR += Number(item.ctr) || 0;
      channelStats[key].count += 1;

      const category = item.category || 'general';
      channelStats[key].category[category] =
        (channelStats[key].category[category] || 0) + 1;
    }
  }

  return Object.entries(channelStats)
    .map(([key, stats]) => ({
      key,
      channel: stats.channel,
      content_type: stats.content_type,
      timestamp: stats.timestamp,
      avg_ctr: stats.count ? stats.totalCTR / stats.count : 0,
      sample_size: stats.count,
      dominant_category: dominantKey(stats.category),
      current_signal_count: currentSignals.filter(s => s.channel === stats.channel).length
    }))
    .sort((a, b) => b.avg_ctr - a.avg_ctr);
}

function detectStrategyShift(pattern) {
  if (!pattern.length) {
    return {
      channel: 'No data',
      recommendation: 'Collect more analytics before shifting strategy.'
    };
  }

  const best = pattern[0];
  const hourLabel =
    Number.isFinite(best.timestamp) ? formatHour(best.timestamp) : 'best window';

  return {
    channel: best.key,
    recommendation: `Increase ${best.channel} ${best.content_type} content at ${hourLabel}.`,
    avg_ctr: best.avg_ctr,
    category: best.dominant_category
  };
}

function generateContentMix(pattern) {
  return pattern.slice(0, 3).map(item => ({
    channel: item.key,
    recommended_share: `${Math.max(20, Math.round(item.avg_ctr * 100))}%`,
    rationale: `${item.channel} ${item.content_type} content performs best around ${formatHour(item.timestamp)}.`
  }));
}

function generateImprovedCalendar(newMix) {
  return newMix.map((item, index) => ({
    day_offset: index,
    slot: extractTimeFromKey(item.channel),
    focus: item.channel
  }));
}

async function analyzeStrategyWithClaude(input) {
  try {
    const prompt = `
You are a marketing strategy analyst for a fintech content pipeline.
Review the analytics patterns and produce strict JSON with this shape:
{
  "summary": "short paragraph",
  "shift": "single sentence about the strongest strategic shift",
  "mix": ["3 short bullets as strings"],
  "calendar": ["up to 5 short schedule recommendations as strings"]
}

Context:
${JSON.stringify(input, null, 2)}
`;

    const res = await puter.ai.chat(prompt, { model: 'claude-sonnet-4' });
    const text = res?.message?.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON returned');
    return JSON.parse(match[0]);
  } catch (_) {
    return buildHeuristicAnalysis(input);
  }
}

function buildHeuristicAnalysis(input) {
  const best = input.pattern[0];
  return {
    summary: best
      ? `${best.channel} ${best.content_type} content is leading around ${formatHour(best.timestamp)} with the strongest average CTR in the current history.`
      : 'Not enough analytics history is available yet to produce a confident strategy readout.',
    shift: input.newMix[0]
      ? `Shift more effort toward ${input.newMix[0].channel} and reduce low-performing generic slots.`
      : 'Collect more analytics before changing the content plan.',
    mix: input.newMix.map(item => `${item.channel}: ${item.recommended_share} recommended share.`),
    calendar: input.improvedCalendar.map(item => `Day ${item.day_offset + 1}: ${item.focus} at ${item.slot}.`)
  };
}

function renderStrategyCrewOutput(output) {
  const host = document.getElementById('a9-strategy-output');
  if (!host) return;

  const analysis = output.strategy_analysis || {};
  const patternRows = (output.pattern_detected || [])
    .slice(0, 5)
    .map(item => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #1f1f1f">${item.key}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #1f1f1f">${(item.avg_ctr * 100).toFixed(2)}%</td>
        <td style="padding:6px 8px;border-bottom:1px solid #1f1f1f">${item.dominant_category}</td>
      </tr>
    `)
    .join('');

  const mixItems = (analysis.mix || output.new_content_mix || [])
    .map(item => `<li>${typeof item === 'string' ? item : `${item.channel}: ${item.recommended_share}`}</li>`)
    .join('');

  const calendarItems = (analysis.calendar || output.improved_calendar || [])
    .map(item => {
      if (typeof item === 'string') return `<li>${item}</li>`;
      return `<li>Day ${item.day_offset + 1}: ${item.focus} at ${item.slot}</li>`;
    })
    .join('');

  host.innerHTML = `
    <div style="margin-top:18px;padding:18px;border:1px solid #25573a;border-radius:14px;background:linear-gradient(180deg,#0b1610 0%,#08110b 100%);box-shadow:0 10px 28px rgba(0,0,0,0.28)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div>
          <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#7fd6a0">Strategy Crew</div>
          <h4 style="margin:4px 0 0;color:#f3fff7;font-size:18px">Content Strategy Readout</h4>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="padding:6px 10px;border-radius:999px;background:#123222;color:#7fd6a0;font-size:11px;border:1px solid #25573a">Pattern-led</span>
          <span style="padding:6px 10px;border-radius:999px;background:#17283a;color:#9bc7ff;font-size:11px;border:1px solid #294665">Claude analysed</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px">
        <div style="padding:12px;border-radius:12px;background:#101d16;border:1px solid #1c4130">
          <div style="font-size:11px;text-transform:uppercase;color:#7fd6a0;margin-bottom:6px">Pattern Analysis</div>
          <div style="font-size:13px;line-height:1.7;color:#eaf7ef">${escapeHtml(analysis.summary || 'No summary available.')}</div>
        </div>
        <div style="padding:12px;border-radius:12px;background:#1c1306;border:1px solid #5b4412">
          <div style="font-size:11px;text-transform:uppercase;color:#f5c26b;margin-bottom:6px">Shift Strategy</div>
          <div style="font-size:14px;line-height:1.7;color:#fff4dd;font-weight:600">${escapeHtml(analysis.shift || output.strategy_shift?.recommendation || 'No shift recommendation available.')}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:14px">
        <div style="padding:12px;border-radius:12px;background:#0d151e;border:1px solid #22384d">
          <div style="font-size:11px;text-transform:uppercase;color:#9bc7ff;margin-bottom:8px">Recommended New Mix</div>
          <ul style="margin:0 0 0 18px;color:#edf5ff;line-height:1.8">${mixItems || '<li>No mix recommendations available.</li>'}</ul>
        </div>
        <div style="padding:12px;border-radius:12px;background:#161016;border:1px solid #42304a">
          <div style="font-size:11px;text-transform:uppercase;color:#d7b0f6;margin-bottom:8px">Content Calendar</div>
          <ul style="margin:0 0 0 18px;color:#fbf1ff;line-height:1.8">${calendarItems || '<li>No calendar recommendations available.</li>'}</ul>
        </div>
      </div>

      <div style="padding:12px;border-radius:12px;background:#0b0f0d;border:1px solid #253229">
        <div style="font-size:11px;text-transform:uppercase;color:#8fb59d;margin-bottom:8px">Top Patterns</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #2a4a2a">Pattern</th>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #2a4a2a">Avg CTR</th>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #2a4a2a">Category</th>
          </tr>
        </thead>
        <tbody>${patternRows || '<tr><td colspan="3" style="padding:8px">No pattern data available.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}

function dominantKey(map) {
  const entries = Object.entries(map || {});
  if (!entries.length) return 'general';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function extractTimeFromKey(key) {
  const parts = String(key).split('_');
  const rawHour = Number(parts[parts.length - 1]);
  return Number.isFinite(rawHour) ? formatHour(rawHour) : 'Flexible';
}

function formatHour(hour) {
  const normalized = ((Number(hour) % 24) + 24) % 24;
  const suffix = normalized >= 12 ? 'PM' : 'AM';
  const display = normalized % 12 || 12;
  return `${display}${suffix}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
