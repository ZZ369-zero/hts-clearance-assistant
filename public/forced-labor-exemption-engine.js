export function normalizeForcedLaborHts(value) {
  return String(value || "").replace(/\D/g, "");
}

export function getForcedLaborRuleStatus(rule, referenceDate = new Date()) {
  const date = toDate(referenceDate) || new Date();
  const start = toDate(rule?.effectiveFrom);
  const end = toDate(rule?.effectiveTo);
  if (start && date < start) {
    return "pending";
  }
  if (end && date >= end) {
    return "expired";
  }
  return "active";
}

export function formatForcedLaborExpiry(rule) {
  if (!rule?.effectiveTo) {
    return "未规定到期日";
  }
  return String(rule.effectiveTo).slice(0, 10);
}

export function matchForcedLaborExemptions(hts, snapshot = {}, options = {}) {
  const digits = normalizeForcedLaborHts(hts);
  const referenceDate = options.referenceDate || options.entryDate || new Date();
  if (digits.length < 8) {
    return { exact: null, possible: [], expired: [] };
  }

  const rules = Object.values(snapshot.rules || {});
  const activeRules = rules.filter((rule) => getForcedLaborRuleStatus(rule, referenceDate) === "active");
  const expiredRules = rules.filter((rule) => getForcedLaborRuleStatus(rule, referenceDate) === "expired");
  const exactRule = activeRules.find((rule) =>
    rule.matchType === "exact-hts" && (rule.codes || []).some((code) => matchesHts(digits, code))
  );

  const exact = exactRule
    ? {
        code: exactRule.code,
        titleZh: exactRule.titleZh,
        summaryZh: exactRule.summaryZh,
        sourceUrl: exactRule.sourceUrl || snapshot.sourceUrl,
        pdfUrl: exactRule.pdfUrl || snapshot.pdfUrl,
        expiryLabel: formatForcedLaborExpiry(exactRule),
        status: "active",
        autoExempt: true
      }
    : null;

  const possible = activeRules
    .filter((rule) => rule.matchType !== "exact-hts")
    .filter((rule) => isPossibleMatch(digits, rule))
    .map((rule) => ({
      code: rule.code,
      titleZh: rule.titleZh,
      summaryZh: rule.summaryZh,
      conditionZh: rule.conditionZh,
      expiryLabel: formatForcedLaborExpiry(rule),
      status: "active",
      autoExempt: false
    }));

  const expired = expiredRules.map((rule) => ({
    code: rule.code,
    titleZh: rule.titleZh,
    summaryZh: rule.summaryZh,
    expiryLabel: formatForcedLaborExpiry(rule),
    status: "expired",
    autoExempt: false
  }));

  return { exact, possible, expired };
}

function matchesHts(target, candidate) {
  const code = normalizeForcedLaborHts(candidate);
  return code.length >= 8 && (target === code || target.startsWith(code));
}

function isPossibleMatch(hts, rule) {
  const codes = rule.codes || [];
  if (codes.length && codes.some((code) => matchesHts(hts, code))) {
    return true;
  }

  const chapters = rule.chapters || [];
  return chapters.some((chapter) => hts.startsWith(normalizeForcedLaborHts(chapter)));
}

function toDate(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
