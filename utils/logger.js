/**
 * GCN D2C Fintech — UI Logger & Pipeline State Helpers
 *
 * Shared by the Orchestrator (index.html) and all agent modules.
 * Provides:
 *   - agentLog()   — appends a line to an agent's log panel
 *   - setStatus()  — updates the agent status badge + title colour
 *   - setTrack()   — updates a pipeline track box state
 *   - riskTag()    — returns a coloured <span> for a compliance risk level
 *   - sleep()      — simple promise-based delay
 */

/**
 * Append a log line to an agent's log panel.
 * @param {string} agentId - 'a1' | 'a2' | etc.
 * @param {string} msg
 * @param {'active'|'warn'|undefined} type
 */
export function agentLog(agentId, msg, type) {
  const el = document.getElementById('log-' + agentId);
  if (!el) return;
  const line = document.createElement('div');
  line.className = type ? 'log-line ' + type : 'log-line';
  line.textContent = '> ' + msg;
  el.appendChild(line);
}

/**
 * Update the status badge and title colour for an agent panel.
 * @param {string} agentId
 * @param {'waiting'|'running'|'done'} status
 */
export function setStatus(agentId, status) {
  const badge = document.getElementById('status-' + agentId);
  const title = document.getElementById('title-' + agentId);
  if (badge) { badge.className = 'agent-status ' + status; badge.textContent = status.toUpperCase(); }
  if (title) { title.className = 'agent-title ' + status; }
}

/**
 * Update a pipeline track box state.
 * @param {string} trackId - DOM element id, e.g. 'track-a1'
 * @param {'active'|'running'|'done'|''} state
 */
export function setTrack(trackId, state) {
  const el = document.getElementById(trackId);
  if (el) el.className = 'pipe-box' + (state ? ' ' + state : '');
}

/**
 * Returns an HTML string: a coloured tag for a compliance risk level.
 * @param {'LOW'|'MEDIUM'|'HIGH'|'BLOCK-RISK'} level
 * @returns {string} HTML
 */
export function riskTag(level) {
  const cls = (level === 'HIGH' || level === 'BLOCK-RISK') ? 'block'
            : level === 'MEDIUM' ? 'warn'
            : 'ok';
  return `<span class="tag ${cls}">${level}</span>`;
}

/**
 * Promise-based delay.
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
