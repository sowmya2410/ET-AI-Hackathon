/**
 * Stores analytics history for pattern detection
 */

let analyticsHistory = [];

export function saveAnalyticsBatch(batch) {
  analyticsHistory.push({
    timestamp: Date.now(),
    data: batch
  });

  // keep only last 10 runs (lightweight)
  if (analyticsHistory.length > 10) {
    analyticsHistory.shift();
  }
}

export function getAnalyticsHistory() {
  return analyticsHistory;
}