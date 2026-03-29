/**
 * GCN D2C Fintech — Agent A: Audit Logger
 *
 * Model: NO LLM — append-only structured log
 *
 * Responsibility (per GCN spec):
 *   Records EVERY pipeline event across all agents:
 *     - agent ID
 *     - timestamp (ISO 8601)
 *     - event type
 *     - regulatory rule cited (with circular number where applicable)
 *     - input hash
 *     - output hash
 *     - retry count
 *     - persona used
 *     - human gate outcome
 *
 *   Stored as structured JSON — queryable by compliance team.
 *   NON-BLOCKING — pipeline continues on logger failure.
 *   Secondary in-memory buffer holds events until logger recovers.
 *
 *   On TRAI / RBI / DPDPA inquiry:
 *     Every published consumer message can be traced back to:
 *       - which agent wrote it
 *       - which compliance rules it was checked against
 *       - which human approved it
 *       - what the output hash was at publish time
 *
 * This module exports:
 *   auditLog(event)  — append one event (callable from any agent)
 *   getAuditLog()    — return full log array
 *   renderAuditLog() — render log into #out-audit panel
 */

// ── In-memory log store ───────────────────────────────────────────────────────
const _log    = [];
const _buffer = [];   // secondary buffer if primary log fails

let _logFailed = false;

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyArx09vYTUMLvO_yoWri3bMeyLWvNxYOAQ',
  authDomain: 'et-hackathon-66bcb.firebaseapp.com',
  projectId: 'et-hackathon-66bcb',
  storageBucket: 'et-hackathon-66bcb.firebasestorage.app',
  messagingSenderId: '367645023444',
  appId: '1:367645023444:web:577c4551e856ac0f5bef41',
  collection: 'auditLogs',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Append one event to the audit log.
 * Non-blocking — never throws; errors are buffered.
 * @param {object} event
 */
export function auditLog(event) {
  const entry = {
    id:        _log.length + _buffer.length + 1,
    timestamp: new Date().toISOString(),
    ...event,
  };

  try {
    _log.push(entry);
    _logFailed = false;
  } catch (err) {
    _buffer.push(entry);
    _logFailed = true;
    console.warn('[AuditLogger] Primary log failed — buffered event:', entry);
  }
}

/**
 * Return a copy of the full audit log.
 */
export function getAuditLog() {
  return [..._log, ..._buffer];
}

export function buildAuditReport(extra = {}) {
  return {
    meta: {
      exported_at: new Date().toISOString(),
      total_events: getAuditLog().length,
      source: 'GCN D2C Fintech Audit Logger',
      ...extra,
    },
    entries: getAuditLog(),
  };
}

export function downloadAuditReport(extra = {}) {
  const payload = buildAuditReport(extra);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gcn-audit-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setAuditActionStatus('Audit report downloaded.');
}

export async function saveAuditLogToFirebase(extra = {}) {
  const cfg = {
    ...DEFAULT_FIREBASE_CONFIG,
    ...((typeof window !== 'undefined' && window.GCN_AUDIT_FIREBASE) || {}),
  };

  const payload = buildAuditReport(extra);
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/${cfg.collection}?key=${cfg.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          exported_at: { stringValue: payload.meta.exported_at },
          total_events: { integerValue: String(payload.meta.total_events) },
          source: { stringValue: payload.meta.source },
          report_json: { stringValue: JSON.stringify(payload) },
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Firebase save failed: ${res.status}`);
  }

  setAuditActionStatus('Audit log saved to Firebase.');
}

/**
 * Clear the log (for pipeline reset between runs).
 */
export function clearAuditLog() {
  _log.length    = 0;
  _buffer.length = 0;
  _logFailed     = false;
}

// ── Pipeline event helpers ────────────────────────────────────────────────────

export function logAgentStart(agentId, persona, channel) {
  auditLog({ agent: agentId, event: 'AGENT_START', persona: persona || null, channel: channel || null });
}

export function logAgentComplete(agentId, persona, outputHash) {
  auditLog({ agent: agentId, event: 'AGENT_COMPLETE', persona: persona || null, outputHash: outputHash || null });
}

export function logComplianceViolation(agentId, ruleId, circular, severity, violationType) {
  auditLog({ agent: agentId, event: 'COMPLIANCE_VIOLATION', ruleId, circular, severity, violationType });
}

export function logHumanGate(decision, approver, timeout) {
  auditLog({ agent: 'HumanGate', event: 'HUMAN_GATE_DECISION', decision, approver: approver || 'reviewer', timeout: timeout || false });
}

export function logPipelineBlock(reason, ruleId) {
  auditLog({ agent: 'Orchestrator', event: 'PIPELINE_BLOCKED', reason, ruleId });
}

// ── Render function ───────────────────────────────────────────────────────────

/**
 * Render the full audit log into #out-audit.
 */
export function renderAuditLog() {
  const el = document.getElementById('out-audit');
  if (!el) return;
  el.style.display = 'block';

  const entries = getAuditLog();
  if (entries.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:#444;padding:8px">No events logged yet.</div>';
    return;
  }

  const rows = entries.map(e => {
    const isBlock = e.severity === 'BLOCK' || e.event === 'PIPELINE_BLOCKED' || e.event === 'DISPATCH_BLOCKED';
    const isWarn  = e.event?.includes('VIOLATION') || e.event?.includes('FLAG');
    const color   = isBlock ? '#f04040' : isWarn ? '#f0a040' : '#555';

    return `
      <div style="display:grid;grid-template-columns:20px 160px 160px 1fr;gap:6px;padding:4px 0;border-bottom:1px solid #111;font-size:10px;align-items:start">
        <div style="color:#333">${e.id}</div>
        <div style="color:#444">${e.timestamp.replace('T', ' ').substring(0, 19)}</div>
        <div style="color:${color}">${e.agent || '—'}</div>
        <div style="color:${color}">${_summarise(e)}</div>
      </div>`;
  }).join('');

  const jsonExport = JSON.stringify(entries, null, 2);

  el.innerHTML = `
    <div class="out-grid">
      <div class="out-card full">
        <div class="out-lbl" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span>Audit Log — ${entries.length} event(s)</span>
          <span>
            <span class="tag ok">REGULATOR-READY</span>
            ${_logFailed ? '<span class="tag warn">BUFFER ACTIVE</span>' : ''}
          </span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin:0 0 12px 0;padding:10px 12px;background:#0b120d;border:1px solid #1f3325;border-radius:8px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="audit-download-btn" style="background:#12301d;color:#d9ffe8;border:1px solid #3d7a55;border-radius:6px;padding:8px 14px;font:12px monospace;font-weight:600;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)">Download Audit JSON</button>
            <button id="audit-firebase-btn" style="background:#33240e;color:#ffe2a8;border:1px solid #8a6430;border-radius:6px;padding:8px 14px;font:12px monospace;font-weight:600;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.03)">Save Audit to Firebase</button>
          </div>
          <span id="audit-export-status" style="font-size:11px;color:#7a7a7a;line-height:1.4">Export actions ready</span>
        </div>
        <div style="font-size:10px;color:#333;display:grid;grid-template-columns:20px 160px 160px 1fr;gap:6px;padding:4px 0;border-bottom:1px solid #1e1e1e;margin-bottom:4px">
          <div>#</div><div>Timestamp</div><div>Agent</div><div>Event</div>
        </div>
        ${rows}
      </div>
      <div class="out-card full">
        <div class="out-lbl" style="margin-bottom:6px">Raw JSON Export (RBI/TRAI/DPDPA inquiry ready)</div>
        <pre style="font-size:9px;color:#333;line-height:1.5;max-height:200px;overflow-y:auto">${_escapeHtml(jsonExport.substring(0, 3000))}${jsonExport.length > 3000 ? '\n…' : ''}</pre>
      </div>
    </div>`;

  const downloadBtn = document.getElementById('audit-download-btn');
  const firebaseBtn = document.getElementById('audit-firebase-btn');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      try {
        downloadAuditReport();
      } catch (err) {
        setAuditActionStatus(err.message, true);
      }
    };
  }
  if (firebaseBtn) {
    firebaseBtn.onclick = async () => {
      try {
        firebaseBtn.disabled = true;
        setAuditActionStatus('Saving to Firebase...');
        await saveAuditLogToFirebase();
      } catch (err) {
        setAuditActionStatus(err.message || 'Firebase save failed.', true);
      } finally {
        firebaseBtn.disabled = false;
      }
    };
  }
}

function _summarise(e) {
  const parts = [e.event];
  if (e.ruleId)       parts.push(`rule:${e.ruleId}`);
  if (e.circular)     parts.push(`circ:${e.circular}`);
  if (e.persona)      parts.push(`persona:${e.persona}`);
  if (e.channel)      parts.push(`ch:${e.channel}`);
  if (e.detail)       parts.push(e.detail);
  if (e.outputHash)   parts.push(`hash:${e.outputHash}`);
  if (e.confidence)   parts.push(`conf:${e.confidence.toFixed(2)}`);
  return parts.join(' · ');
}

function _escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function setAuditActionStatus(message, isError = false) {
  const el = document.getElementById('audit-export-status');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#f0a040' : '#555';
}
