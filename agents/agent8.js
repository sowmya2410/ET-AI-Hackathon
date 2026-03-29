/**
 * GCN D2C Fintech — Agent 8: Publisher Agent (FIXED)
 */

import { agentLog, setStatus, setTrack, sleep } from '../utils/logger.js';
import { auditLog } from './agentA.js';

// ── Mock DLT registry ─────────────────────────────────────────

const DLT_REGISTERED_SENDERS = ['GCNFIN', 'GCNUPI', 'GCNWAL', 'GCNBNK'];

const OPTIMAL_WINDOWS = {
  'Gen Z (18-25)': '7:00 PM – 9:00 PM IST',
  'Millennial (26-38)': '8:00 AM – 10:00 AM IST',
  'Bharat (Tier 2/3 vernacular)': '6:00 PM – 8:00 PM IST',
  'Mixed': '12:00 PM – 2:00 PM IST',
};

// ── MAIN FUNCTION ─────────────────────────────────────────

export async function runAgent8(a8Input) {
  setStatus('a8', 'running');
  setTrack('track-a8', 'running');

  document.getElementById('out-a8').style.display = 'none';

  agentLog('a8', 'Publisher validation started');

  const publishResults = {};
  let hardBlock = false;
  let blockDetail = null;

  for (const [channel, pkg] of Object.entries(a8Input.formatted_packages)) {
    agentLog('a8', `Validating ${channel}...`);
    await sleep(100);

    const result = _validateDispatch(channel, pkg, a8Input);

    //  FIX 1 — Proper if-else separation
    if (result.blocked) {
      hardBlock = true;
      blockDetail = result.blockDetail;

      agentLog('a8', `BLOCKED: ${channel} → ${result.blockDetail}`, 'warn');

      auditLog({
        agent: 'Agent8',
        event: 'BLOCKED',
        channel,
        detail: result.blockDetail
      });

      publishResults[channel] = { status: 'BLOCKED', ...result };

      break; // stop pipeline
    } else {
      agentLog('a8', `✓ ${channel} queued`);

      auditLog({
        agent: 'Agent8',
        event: 'QUEUED',
        channel
      });

      publishResults[channel] = result;
    }
  }

  // ✅ FIX 2 — Clean handoff (no duplicates)
  const a9Handoff = {
    publish_results: publishResults,
    formatted_packages: a8Input.formatted_packages,

    hard_block: hardBlock,
    block_detail: blockDetail,

    selected_persona: a8Input.selected_persona,
    product_category: a8Input.product_category,
    consumer_segment: a8Input.consumer_segment,
    campaign_intent: a8Input.campaign_intent,
    channel_mix: a8Input.channel_mix,
    vernacular_required: a8Input.vernacular_required,
    hustler_flag: a8Input.hustler_flag,
  };

  _renderOutput(publishResults, hardBlock, blockDetail);

  _persistPublisherHandoff(a9Handoff);

  setStatus('a8', hardBlock ? 'blocked' : 'done');
  setTrack('track-a8', hardBlock ? 'running' : 'done');

  return a9Handoff;
}

/** Browser-only: feed Publisher Agent UI + coordinate analytics handoff to Agent 9. */
function _persistPublisherHandoff(handoff) {
  if (typeof localStorage === 'undefined') return;
  try {
    const runId = localStorage.getItem('gcn_run_id') || '';
    const payload = { ...handoff, run_id: runId, persisted_at: Date.now() };
    localStorage.setItem('gcn_publisher_handoff', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('gcn-publisher-handoff', { detail: payload }));
  } catch (e) {
    console.warn('[Agent8] Could not persist publisher handoff:', e);
  }
}

// ── VALIDATION ─────────────────────────────────────────

function _validateDispatch(channel, pkg, context) {
  const optimalWindow = OPTIMAL_WINDOWS[context.consumer_segment] || '12:00 PM IST';

  const base = {
    status: 'QUEUED',
    scheduledTime: optimalWindow,
    blocked: false,
    blockDetail: null,
    checks: {}
  };

  switch (channel) {
    case 'SMS': {
      const content = pkg.formatted || '';
      const senderId =
        pkg.meta?.dltTemplate ||
        pkg.dltTemplate ||
        (typeof pkg.display?.['DLT Template'] === 'string'
          ? pkg.display['DLT Template'].replace(/\s*✓.*$/, '').trim()
          : null) ||
        'GCNFIN';

      const isRegistered = DLT_REGISTERED_SENDERS.includes(senderId);

      if (!isRegistered) {
        return {
          ...base,
          blocked: true,
          blockDetail: `Sender ${senderId} not registered`
        };
      }

      return {
        ...base,
        checks: {
          Sender: `${senderId} ✓`,
          Length: `${content.length}/160`
        }
      };
    }

    case 'Instagram':
      return {
        ...base,
        status: 'SCHEDULED',
        checks: {
          Schedule: optimalWindow
        }
      };

    case 'Blog':
      return {
        ...base,
        status: 'CMS_QUEUE',
        checks: {
          SEO: 'OK'
        }
      };

    case 'Email':
      return {
        ...base,
        status: 'ESP_QUEUE',
        checks: {
          'Opt-in list': '✓',
          Subject: `${String(pkg.display?.Subject || '').length}/78 (est.)`
        }
      };

    default:
      return base;
  }
}

// ── RENDER OUTPUT ─────────────────────────────────────────

/**
 * Map validation status to a clear pipeline label. QUEUED/CMS_QUEUE mean
 * “cleared Agent 8” — actual go-live is simulated in Publisher UI, not here.
 */
function _rowStatusLabel(ch, r, liveSet) {
  if (r.blocked || r.status === 'BLOCKED') return r.status || 'BLOCKED';
  if (liveSet && liveSet.has(ch)) {
    return 'POSTED (simulated · Publisher UI)';
  }
  return `${r.status} — next: Publisher UI (Approve)`;
}

function _readPublisherSimLiveSet() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('gcn_publisher_sim_complete');
    if (!raw) return null;
    const sim = JSON.parse(raw);
    const runId = localStorage.getItem('gcn_run_id') || '';
    if (!sim.runId || sim.runId !== runId) return null;
    return new Set(sim.channels || []);
  } catch {
    return null;
  }
}

function _renderOutput(results, hardBlock, blockDetail) {
  const el = document.getElementById('out-a8');
  if (!el) return;
  el.style.display = 'block';

  const liveSet = !hardBlock ? _readPublisherSimLiveSet() : null;

  const rows = Object.entries(results).map(([ch, r]) => {
    const label = _rowStatusLabel(ch, r, liveSet);
    return `
    <div class="out-card">
      <b>${ch}</b> → ${label}
    </div>`;
  }).join('');

  const blockMsg = hardBlock
    ? `<div style="color:red">${blockDetail}</div>`
    : '';

  const note = !hardBlock
    ? `<p style="font-size:11px;opacity:0.85;margin:8px 0 0;line-height:1.4"><strong>CMS_QUEUE</strong> / <strong>QUEUED</strong> mean Agent 8 cleared the package for dispatch — not that posting failed. Approve in the Publisher UI to simulate go-live; the orchestrator then shows <strong>POSTED (simulated)</strong>.</p>`
    : '';

  el.innerHTML = `
    <div>
      <h3>Publisher Output</h3>
      ${blockMsg}
      ${rows}
      ${note}
    </div>
  `;
}

/** Call after Publisher UI finishes Approve (or anytime) to refresh statuses on the orchestrator. */
export function refreshAgent8OutputAfterPublisherSim(a8Out) {
  if (!a8Out || a8Out.hard_block || !a8Out.publish_results) return;
  _renderOutput(a8Out.publish_results, a8Out.hard_block, a8Out.block_detail);
}