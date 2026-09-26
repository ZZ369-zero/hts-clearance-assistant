const LISTED_HTS = "3923210095";
const LISTED_HTS_DISPLAY = "3923.21.00.95";
const BASE_CODE = "9903.88.03";
const EXCLUSION_CODE = "9903.88.69";
const VALID_FROM = "2024-06-15";
const VALID_TO = "2026-11-09";
const OFFICIAL_SOURCES = [
  {
    label: "USTR 2024 排除清单：U.S. note 20(vvv)(iii)(8)",
    url: "https://ustr.gov/sites/default/files/89%20FRN%2046948%20%28May%2030%2C%202024%29.pdf"
  },
  {
    label: "USTR 延期通知：有效至 2026-11-09",
    url: "https://ustr.gov/sites/default/files/files/Press/Releases/2025/Extending%20Exclusions%20to%20Nov%202026%20-%20Final%20FRN%20for%20Posting.pdf"
  }
];
const ENTRY_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

// Entry dates are U.S. consumption-entry / withdrawal dates. Date-only inputs
// retain that legal date; timestamps use U.S. Eastern time, never host time.
export function normalizeUstrEntryDate(value) {
  if (typeof value === "string") {
    const text = value.trim();
    const dateOnly = text.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
    if (dateOnly) {
      const date = `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
      return isValidCalendarDate(date) ? date : "";
    }
    // Reject local-time and loosely parsed dates: they depend on the browser's
    // location or can silently roll an invalid calendar date into the next month.
    const timestamp = text.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i);
    if (!timestamp || !isValidCalendarDate(timestamp[1])) {
      return "";
    }
    value = new Date(text);
  }
  if (!(value instanceof Date) && typeof value !== "number") {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const parts = Object.fromEntries(ENTRY_DATE_FORMAT.formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isValidCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000 && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function applyChapter99ExclusionRules(rules, rowsByCode, subjectRow = null, context = {}) {
  const exclusionCodes = new Set(
    rules.map((rule) => rule.code).filter((code) => isUstr301ExclusionHeading(rowsByCode.get(code), code))
  );
  if (!exclusionCodes.size) {
    return rules;
  }

  const productDigits = String(subjectRow?.htsno || "").replace(/[.\s]/g, "");
  const entryDate = normalizeUstrEntryDate(
    context.entryDate !== undefined ? context.entryDate
      : context.referenceDate !== undefined ? context.referenceDate : new Date()
  );
  const isChinaOrigin = /^(China|CN|中国)$/i.test(String(context.originCountry || "").trim());
  const nextRules = [];
  for (const rule of rules) {
    const code = rule.code || "";
    const row = rowsByCode.get(code);
    if (exclusionCodes.has(code)) {
      continue;
    }
    // Prefer the known listed exclusion when several exclusion headings exist.
    const excludedBy = productDigits === LISTED_HTS && exclusionCodes.has(EXCLUSION_CODE)
      && hasHeadingReference(row, EXCLUSION_CODE)
      ? EXCLUSION_CODE : [...exclusionCodes].find((candidate) => hasHeadingReference(row, candidate));
    if (!excludedBy) {
      nextRules.push(rule);
      continue;
    }

    const autoExempt = productDigits === LISTED_HTS && code === BASE_CODE && excludedBy === EXCLUSION_CODE
      && hasVerifiedListedExclusionRelationship(row, rowsByCode.get(EXCLUSION_CODE))
      && isChinaOrigin && entryDate >= VALID_FROM && entryDate <= VALID_TO;
    if (autoExempt) {
      nextRules.push({
        ...rule,
        autoApply: false,
        exclusionApplies: true,
        possibleExemptions: (rule.possibleExemptions || []).filter((item) => item.code !== EXCLUSION_CODE),
        exemptionCode: EXCLUSION_CODE,
        exemptionMatchedHts: LISTED_HTS_DISPLAY,
        exemptionStatus: "已排除",
        exemptionEntryDate: entryDate,
        exemptionValidFrom: VALID_FROM,
        exemptionValidTo: VALID_TO,
        exemptionSourceUrl: OFFICIAL_SOURCES[0].url,
        exemptionSources: OFFICIAL_SOURCES.map((source) => ({ ...source })),
        summaryZh: `${LISTED_HTS_DISPLAY} 已列入 U.S. note 20(vvv)(iii)(8) 排除清单；按中国原产、美国消费入境/提取消费日期 ${entryDate}，适用 ${EXCLUSION_CODE}，${BASE_CODE} 的 25% 已排除，不计入估算。`,
        note: `${rule.note || "301 加征项"}；官方清单列名统计号 3923.21.0095，按归类正确、中国原产及有效日期计算。排除有效期 ${VALID_FROM} 至 ${VALID_TO}（含当日，按美国东部日期）；依据 USTR 89 FR 46948 及 2025 年延期通知。普通关税及其他适用税项仍分别计算。`
      });
      continue;
    }

    const prompt = buildUstr301ExclusionPrompt({ baseCode: code, exclusionCode: excludedBy, exclusionRow: rowsByCode.get(excludedBy), productDigits });
    nextRules.push({
      ...rule,
      possibleExemptions: [...(rule.possibleExemptions || []).filter((item) => item.code !== excludedBy), prompt],
      exemptionCode: excludedBy,
      exemptionStatus: "条件豁免",
      exemptionSourceUrl: prompt.sourceUrl,
      note: `${rule.note || "301 加征项"}；${excludedBy} 为可能适用的 USTR 产品排除项，需按商品描述、重量、原产国和美国消费入境/提取消费日期复核。`
    });
  }
  return nextRules;
}

function headingDescription(row) {
  return `${row?.description || ""} ${row?.descriptionEn || ""} ${row?.descriptionZh || ""}`;
}

function isUstr301ExclusionHeading(row, code) {
  if (!/^9903\.88\.\d{2}$/.test(String(code || ""))) {
    return false;
  }
  return /covered by an exclusion|exclusion granted by the U\.S\. Trade Representative|产品排除/i.test(headingDescription(row))
    && !/\+\s*\d+(?:\.\d+)?\s*%/.test(String(row?.general || ""));
}

function hasHeadingReference(row, code) {
  const escaped = code.replace(/\./g, "\\.");
  return new RegExp(`(?:^|[^0-9.])${escaped}(?![0-9.])`).test(headingDescription(row));
}

function hasVerifiedListedExclusionRelationship(baseRow, exclusionRow) {
  const baseDescription = `${baseRow?.description || ""} ${baseRow?.descriptionEn || ""}`;
  const exclusionDescription = `${exclusionRow?.description || ""} ${exclusionRow?.descriptionEn || ""}`;
  return baseRow?.htsno === BASE_CODE && exclusionRow?.htsno === EXCLUSION_CODE
    && /Except as provided in headings?[^;]*\b9903\.88\.69\b/i.test(baseDescription)
    && /product of China/i.test(exclusionDescription)
    && /U\.S\.\s*note\s*20\s*\(vvv\)/i.test(exclusionDescription)
    && /^The duty provided in the applicable subheading\.?$/i.test(String(exclusionRow?.general || "").trim());
}

function buildUstr301ExclusionPrompt({ baseCode, exclusionCode, exclusionRow, productDigits }) {
  const knownPrompt = getKnownUstr301ExclusionPrompt(productDigits, exclusionCode);
  return {
    code: exclusionCode,
    titleZh: knownPrompt?.titleZh || "产品排除",
    summaryZh: knownPrompt?.summaryZh
      || `${exclusionCode} 为 USTR 授予的 301 产品排除项；${baseCode} 描述中列明 “Except as provided” 的排除关系，命中时可申请不叠加对应 301 加征。`,
    conditionZh: knownPrompt?.conditionZh || "需确认商品描述、HTS 统计号、原产国、申报日期和 U.S. note 20 对应排除范围",
    expiryLabel: knownPrompt?.expiryLabel || normalizeUstrEntryDate(exclusionRow?.effectiveTo) || "未规定到期日",
    status: "possible",
    autoExempt: false,
    sourceUrl: productDigits === LISTED_HTS && exclusionCode === EXCLUSION_CODE
      ? OFFICIAL_SOURCES[0].url : `https://hts.usitc.gov/search?query=${encodeURIComponent(exclusionCode)}`
  };
}

function getKnownUstr301ExclusionPrompt(productDigits, exclusionCode) {
  if (productDigits === LISTED_HTS && exclusionCode === EXCLUSION_CODE) {
    return {
      titleZh: "清单列名排除",
      summaryZh: "统计申报号 3923.21.0095 明确列入 U.S. note 20(vvv)(iii)(8) 排除清单，符合条件时不叠加 9903.88.03 的 25%。",
      conditionZh: `需确认商品正确归入 ${LISTED_HTS_DISPLAY}、中国原产、美国消费入境/提取消费日期在 ${VALID_FROM} 至 ${VALID_TO}（含当日），且已取得官方基础条款及排除条款`,
      expiryLabel: VALID_TO
    };
  }
  if (productDigits === "8516290090" && exclusionCode === EXCLUSION_CODE) {
    return {
      titleZh: "产品排除",
      summaryZh: "电壁炉，重量不超过 55 公斤（归入统计申报号 8516.29.00.90）可能适用 USTR 301 产品排除。",
      conditionZh: "需确认商品为电壁炉、单件重量不超过 55 公斤、HTS 归类、中国原产及美国消费入境/提取消费日期",
      expiryLabel: VALID_TO
    };
  }
  return null;
}
