import { certificationCatalog } from "./certification-catalog.js?v=20260709-fda2";

const statusMeta = {
  high: {
    label: "高概率适用",
    className: "status-high",
    rank: 3
  },
  review: {
    label: "可能适用",
    className: "status-review",
    rank: 2
  },
  need_input: {
    label: "需补充参数",
    className: "status-need-input",
    rank: 1
  }
};

export function matchCertificationRules(row) {
  const htsDigits = normalizeHtsDigits(row?.htsno);
  const haystack = normalizeCertificationText([
    row?.htsno,
    row?.description,
    row?.descriptionZh
  ].filter(Boolean).join(" "));

  return certificationCatalog
    .map((item) => {
      const match = matchCertificationItem(item, htsDigits, haystack);
      return match ? { ...item, ...match } : null;
    })
    .filter(Boolean)
    .filter((item, index, matches) => {
      const suppressedIds = new Set(matches.flatMap((match) => match.suppresses || []));
      return !suppressedIds.has(item.id);
    })
    .sort((a, b) => (a.sequence || 999) - (b.sequence || 999));
}

export function getCertificationStatusMeta(status) {
  return statusMeta[status] || statusMeta.need_input;
}

export function summarizeCertificationMatches(matches = []) {
  if (!matches.length) {
    return "未命中明显认证提示";
  }

  const counts = matches.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const parts = [];
  if (counts.high) {
    parts.push(`${counts.high} 项高概率`);
  }
  if (counts.review) {
    parts.push(`${counts.review} 项可能适用`);
  }
  if (counts.need_input) {
    parts.push(`${counts.need_input} 项需补充参数`);
  }
  return parts.join(" · ") || `${matches.length} 项提示`;
}

function matchCertificationItem(item, htsDigits, haystack) {
  const rule = item.rule || {};
  const exactMatches = (rule.exactCodes || [])
    .map((code) => normalizeHtsDigits(code))
    .filter((code) => code && htsDigits === code);
  const prefixMatches = (rule.prefixes || [])
    .map((prefix) => normalizeHtsDigits(prefix))
    .filter((prefix) => prefix && htsDigits.startsWith(prefix));
  const keywordMatches = (rule.keywords || [])
    .filter((keyword) => matchesKeyword(haystack, keyword));

  const needsExact = Boolean(rule.exactCodes?.length);
  const needsPrefix = Boolean(rule.prefixes?.length);
  const needsKeyword = Boolean(rule.keywords?.length);
  const hasExact = exactMatches.length > 0;
  const hasPrefix = prefixMatches.length > 0;
  const hasKeyword = keywordMatches.length > 0;
  const mode = rule.mode || "any";

  if (mode === "all" && (!(!needsExact || hasExact) || !(!needsPrefix || hasPrefix) || !(!needsKeyword || hasKeyword))) {
    return null;
  }
  if (mode !== "all" && !hasExact && !hasPrefix && !hasKeyword) {
    return null;
  }

  const reasons = [];
  if (hasExact) {
    reasons.push(`HTS ${formatMatchedPrefixes(exactMatches)}`);
  }
  if (hasPrefix && !hasExact) {
    reasons.push(`HTS ${formatMatchedPrefixes(prefixMatches)}`);
  }
  if (hasKeyword) {
    reasons.push(`关键词 ${keywordMatches.slice(0, 3).join(" / ")}`);
  }

  return {
    matchedBy: reasons.join("；"),
    matchedExactCodes: exactMatches,
    matchedPrefixes: prefixMatches,
    matchedKeywords: keywordMatches
  };
}

function matchesKeyword(haystack, keyword) {
  const normalized = normalizeCertificationText(keyword);
  if (!normalized) {
    return false;
  }
  if (hasChineseText(normalized)) {
    return haystack.includes(normalized);
  }
  if (/^[a-z0-9]{1,3}$/.test(normalized)) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalized)}($|\\s)`, "i").test(haystack);
  }
  return haystack.includes(normalized);
}

function formatMatchedPrefixes(prefixes) {
  return [...new Set(prefixes)]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .slice(0, 3)
    .join(" / ");
}

function normalizeHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeCertificationText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[，。；：、（）【】()[\]{}]/g, " ")
    .replace(/[-_/|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
