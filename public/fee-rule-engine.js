import { activeFeeCatalog, deferredFeeCatalog, feeCatalog } from "./fee-catalog.js";

const manualAmountTargets = new Set(["excise", "user-fee"]);
const commodityTarget = "commodity";

export function matchFeeRules(row, context = {}) {
  const normalizedHts = normalizeHtsDigits(row?.htsno);
  const haystack = buildHaystack(row);

  return activeFeeCatalog
    .map((fee) => buildFeeMatch(fee, normalizedHts, haystack, context))
    .filter(Boolean)
    .sort((a, b) => a.sequence - b.sequence);
}

export function getDeferredFeeCatalog() {
  return deferredFeeCatalog;
}

export function getFeeCatalog() {
  return feeCatalog;
}

export function buildManualAssessmentState(matches = [], previous = {}) {
  const next = {};
  for (const match of matches) {
    if (!isManualAssessmentMatch(match)) {
      continue;
    }

    const prior = previous[match.id] || {};
    next[match.id] = {
      enabled: prior.enabled ?? match.defaultEnabled ?? false,
      rate: prior.rate ?? "",
      quantity: prior.quantity ?? "",
      amount: prior.amount ?? "",
      match
    };
  }
  return next;
}

export function calculateManualAssessments(manualState = {}) {
  return Object.values(manualState)
    .filter((entry) => entry.enabled)
    .map((entry) => calculateManualAssessment(entry))
    .filter((item) => item.amount > 0);
}

export function isManualAssessmentMatch(match) {
  const type = match.calculation?.type;
  const target = match.calculation?.target;
  return type === "unit-rate" && target === commodityTarget
    || type === "manual-amount" && manualAmountTargets.has(target);
}

export function formatFeeInputLabel(match) {
  if (match.calculation?.type === "unit-rate") {
    return `${match.calculation.unit || "unit"} × rate`;
  }
  return "fixed amount";
}

function buildFeeMatch(fee, normalizedHts, haystack, context) {
  const rule = fee.rule || {};
  if (rule.transportModes?.length && !rule.transportModes.includes(context.transportMode)) {
    return null;
  }
  if (rule.clearanceModes?.length && !rule.clearanceModes.includes(context.clearanceMode)) {
    return null;
  }

  const prefixMatch = findPrefixMatch(normalizedHts, rule.prefixes || []);
  const keywordMatch = findKeywordMatch(haystack, rule.keywords || []);

  if (!prefixMatch && !keywordMatch && (rule.prefixes?.length || rule.keywords?.length)) {
    return null;
  }

  if (!rule.prefixes?.length && !rule.keywords?.length && !rule.transportModes?.length && !rule.clearanceModes?.length) {
    return null;
  }

  const confidence = prefixMatch ? "hts" : keywordMatch ? "keyword" : "context";
  return {
    ...fee,
    confidence,
    matchedBy: prefixMatch ? `HTS ${prefixMatch}` : keywordMatch ? `keyword ${keywordMatch}` : "context",
    defaultEnabled: fee.implementation === "managed" && ["mpf", "hmf", "cotton"].includes(fee.managedBy)
  };
}

function calculateManualAssessment(entry) {
  const match = entry.match;
  const amount = Number(entry.amount) || 0;
  if (match.calculation?.type === "manual-amount") {
    return {
      id: match.id,
      code: match.code,
      category: match.category,
      target: match.calculation?.target || "",
      displayName: `${match.code} ${match.nameZh}`,
      title: match.nameZh,
      subtitle: `${match.code}-${match.nameEn}`,
      rateText: amount ? "固定金额" : "未录入",
      amount,
      note: match.note
    };
  }

  const rate = Number(entry.rate) || 0;
  const quantity = Number(entry.quantity) || 0;
  const calculated = rate * quantity;
  return {
    id: match.id,
    code: match.code,
    category: match.category,
    target: match.calculation?.target || "",
    displayName: `${match.code} ${match.nameZh}`,
    title: match.nameZh,
    subtitle: `${match.code}-${match.nameEn}`,
    rateText: `${formatDecimal(quantity, 3)} ${match.calculation?.unit || "unit"} × $${formatDecimal(rate, 6)}`,
    amount: calculated,
    note: match.note
  };
}

function findPrefixMatch(normalizedHts, prefixes) {
  if (!normalizedHts) {
    return "";
  }
  return prefixes.find((prefix) => {
    const normalizedPrefix = normalizeHtsDigits(prefix);
    return normalizedPrefix && normalizedHts.startsWith(normalizedPrefix);
  }) || "";
}

function findKeywordMatch(haystack, keywords) {
  return keywords.find((keyword) => {
    const text = String(keyword || "").toLowerCase();
    return text && haystack.includes(text);
  }) || "";
}

function buildHaystack(row) {
  return [
    row?.description,
    row?.descriptionZh,
    row?.additionalDuties,
    ...(row?.footnotes || []).map((note) => note.value)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatDecimal(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}
