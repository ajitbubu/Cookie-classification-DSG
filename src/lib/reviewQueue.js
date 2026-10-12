/**
 * Cookies awaiting a human decision: unpublished cookies from each website's
 * latest stored scan, minus ones already approved in the review log. After
 * the E1 publish rule a model suggestion is not published until approved.
 * Framework-free; shared by the Dashboard and the Review Queue.
 */
import { latestPerDomain } from './dashboard';
import { ruleBasedClassify } from './classificationPolicy';

const UNPUBLISHED = new Set(['Unclassified', 'Uncategorized', 'Unknown']);
const APPROVALS_KEY = 'reviewQueueApprovals';

export function readApprovals() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APPROVALS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Decision 12A: the model abstained for lack of identity evidence.
export function needsManualCheck(cookie) {
  return cookie?.abstainReason === 'insufficient_evidence';
}

export function manualCheckPrompt(category) {
  return `The model had no name or vendor signal for this cookie. Approve ${category}?`;
}

export function recordApproval({ key, name, domain, originalCategory, approvedCategory, confidence }) {
  const log = readApprovals();
  log.push({ cookieKey: key, name, domain, originalCategory, approvedCategory, confidence, action: 'approved', timestamp: new Date().toISOString() });
  try {
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(log));
  } catch {
    // Storage full or blocked: the approval still applies for this session.
  }
  return log;
}

const confidenceOf = (cookie) => {
  const raw = cookie.mlConfidence ?? cookie.confidence ?? cookie.confidence_score ?? null;
  if (raw === null) return null;
  return raw > 1 ? raw / 100 : raw;
};

export function pendingReviews(history = [], approvals = []) {
  const approved = new Set(approvals.map((a) => a.cookieKey));
  const items = [];
  for (const scan of latestPerDomain(history).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))) {
    for (const cookie of scan.fullResults?.cookies || []) {
      if (cookie.category && !UNPUBLISHED.has(cookie.category)) continue;
      // Same key as the Review Queue's approval log: <website>:<cookie name>
      const key = `${scan.domain}:${cookie.name}`;
      if (approved.has(key)) continue;
      const suggestion = cookie.mlClassification && !UNPUBLISHED.has(cookie.mlClassification) ? cookie.mlClassification : null;
      items.push({
        key, scanId: scan.id, name: cookie.name, domain: cookie.domain, website: scan.domain, suggestion,
        confidence: confidenceOf(cookie), rule: ruleBasedClassify(cookie), manualCheck: needsManualCheck(cookie), cookie,
      });
    }
  }
  return items;
}
