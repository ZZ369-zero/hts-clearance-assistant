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
  const exactHtsRule = activeRules.find((rule) =>
    rule.matchType === "exact-hts" && (rule.codes || []).some((code) => matchesHts(digits, code))
  );
  const overlapMatch = findTradeMeasureOverlap(options.appliedChapter99Rules || []);
  const overlapRule = overlapMatch
    ? activeRules.find((rule) => rule.code === "9903.05.90")
    : null;
  const exactRule = exactHtsRule || overlapRule;

  const exact = exactRule
    ? {
        code: exactRule.code,
        titleZh: exactRule.titleZh,
        summaryZh: overlapRule && exactRule === overlapRule
          ? `已选择适用 ${overlapMatch.label} ${overlapMatch.code}，按 9903.05.90 不再叠加新301强迫劳动附加税。`
          : exactRule.summaryZh,
        sourceUrl: exactRule.sourceUrl || snapshot.sourceUrl,
        pdfUrl: exactRule.pdfUrl || snapshot.pdfUrl,
        expiryLabel: formatForcedLaborExpiry(exactRule),
        status: "active",
        autoExempt: true,
        triggerCode: overlapMatch?.code || "",
        matchedBy: overlapMatch ? `${overlapMatch.label} ${overlapMatch.code}` : "HTS精确排除清单"
      }
    : null;

  const possible = activeRules
    .filter((rule) => rule.matchType !== "exact-hts")
    .filter((rule) => rule.code !== exact?.code)
    .filter((rule) => !(overlapMatch && rule.code === "9903.05.90"))
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

export function findTradeMeasureOverlap(appliedChapter99Rules = []) {
  for (const rule of appliedChapter99Rules) {
    if (!rule || rule.autoApply === false) {
      continue;
    }
    const code = String(rule.code || "");
    const category = getTradeMeasureCategory(rule);
    if (category) {
      return {
        code,
        label: rule.label || category.label,
        category: category.id
      };
    }
  }
  return null;
}

const explicitTradeMeasureCodes = new Map([
  ...codes("9903.94", ["01", "02", "03", "05", "06", "07", "31", "32", "33", "40", "41", "42", "43", "44", "45", "50", "51", "52", "53", "54", "55", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69"], "passenger-vehicle", "232乘用车/轻型车及零部件"),
  ...codes("9903.76", ["01", "02", "03", "20", "21", "22", "23", "24"], "wood-products", "232木制品"),
  ...codes("9903.74", ["01", "02", "03", "06", "08", "09", "10"], "mhdv", "232中重型车辆及零部件"),
  ["9903.79.01", { id: "semiconductor", label: "232半导体产品" }]
]);

function codes(prefix, suffixes, id, label) {
  return suffixes.map((suffix) => [`${prefix}.${suffix}`, { id, label }]);
}

function getTradeMeasureCategory(rule) {
  const code = String(rule.code || "");
  const explicit = explicitTradeMeasureCodes.get(code);
  if (explicit) {
    return explicit;
  }

  const materialText = [
    rule.material?.code,
    rule.material?.label,
    rule.material?.shortLabel,
    rule.material?.detailLabel,
    rule.label,
    rule.summaryZh
  ].filter(Boolean).join(" ").toLowerCase();
  if (/steel|iron|aluminum|aluminium|copper|钢|铁|铝|铜/.test(materialText)) {
    return { id: "metals", label: "232钢铝铜及衍生品" };
  }

  if (/^9903\.82\.(02|0[4-9]|1\d|2[0-6])$/.test(code)) {
    return { id: "metal-derivatives", label: "232钢铝衍生品" };
  }
  return null;
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
