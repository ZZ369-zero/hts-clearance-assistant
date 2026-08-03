import { certificationCatalog } from "./certification-catalog.js?v=20260803-fcc-passive-1";

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

export function matchCertificationRules(row, context = {}) {
  const htsDigits = normalizeHtsDigits(row?.htsno);
  const contextText = Array.isArray(context)
    ? context.filter(Boolean).join(" ")
    : [context?.query, context?.productName, context?.description, context?.notes].filter(Boolean).join(" ");
  const haystack = normalizeCertificationText([
    row?.htsno,
    row?.description,
    row?.descriptionZh,
    contextText
  ].filter(Boolean).join(" "));

  const catalogMatches = certificationCatalog
    .map((item) => {
      const match = matchCertificationItem(item, htsDigits, haystack);
      return match ? { ...item, ...match } : null;
    })
    .filter(Boolean);
  const epaFlagMatches = matchEpaFlagRules(htsDigits, context?.epaFlags);
  const fdaFlagMatches = matchFdaFlagRules(htsDigits, context?.fdaFlags);

  return [...epaFlagMatches, ...fdaFlagMatches, ...catalogMatches]
    .filter((item, index, matches) => {
      const suppressedIds = new Set(matches.flatMap((match) => match.suppresses || []));
      return !suppressedIds.has(item.id);
    })
    .sort((a, b) => (a.sequence || 999) - (b.sequence || 999));
}

function matchEpaFlagRules(htsDigits, snapshot) {
  if (!htsDigits || !snapshot?.codes) {
    return [];
  }

  const records = snapshot.codes[htsDigits] || [];
  return records.map((record) => {
    const flag = String(record.flag || "").toUpperCase();
    const meta = snapshot.flags?.[flag] || {};
    const datasetDate = meta.datasetDate || snapshot.generatedAt?.slice(0, 10) || "";
    const listDescription = String(record.description || "").trim();
    const flagGuidance = getEpaFlagGuidance(flag, snapshot);

    return {
      id: `epa-flag-${flag.toLowerCase()}`,
      sequence: 4.8,
      agency: "EPA / CBP ACE",
      nameZh: meta.nameZh || `${flag} 可能需要 EPA 进口申报`,
      nameEn: meta.nameEn || `${flag} EPA Import Filing May Be Required`,
      category: "pga",
      status: meta.status || "review",
      suppresses: flag === "EP5" ? ["epa-pesticide-noa"] : [],
      summary: flagGuidance.summary,
      explanation: [
        meta.meaningZh || `${flag} 是 EPA/CBP ACE 的精确 HTS 监管标志。`,
        flagGuidance.explanation,
        listDescription ? `清单描述：${listDescription}` : "",
        flagGuidance.reviewNote
      ].filter(Boolean).join(" "),
      sourceName: flagGuidance.sourceName,
      sourceUrl: meta.officialUrl || flagGuidance.sourceUrl,
      matchedBy: [
        `${flag} HTS 精确代码 ${formatHtsForDisplay(htsDigits)}`,
        datasetDate ? `清单日期 ${datasetDate}` : ""
      ].filter(Boolean).join("；"),
      matchedExactCodes: [htsDigits],
      matchedPrefixes: [],
      matchedKeywords: []
    };
  });
}

function getEpaFlagGuidance(flag, snapshot) {
  if (flag === "EP3") {
    return {
      summary: "可能需要 EPA 车辆或发动机进口申报",
      explanation: "EP3 是车辆和发动机申报标志，不是产品认证结论；装有受监管发动机的设备可能涉及 EPA Form 3520-1 或 3520-21/ACE 数据。",
      reviewNote: "应确认设备是否带汽油、柴油、非道路、固定式或重型发动机，以及发动机型号、功率、排放标签和证书情况；纯电设备或依法排除的发动机可按事实申报或 disclaim。",
      sourceName: "EPA Importing Vehicles and Engines",
      sourceUrl: snapshot.source?.officialUrl || "https://www.epa.gov/importing-vehicles-and-engines"
    };
  }
  return {
    summary: "可能需要 EPA 农药及装置进口申报",
    explanation: "EP5 表示农药或农药装置 Notice of Arrival 数据可能需要，不等同于自动判定商品受 FIFRA 监管。",
    reviewNote: "应结合产品名称、用途、作用机理、标签宣称和成分判断；实际属于农药或农药装置时，即使 HTS 未标 EP5 也可能必须申报。",
    sourceName: "EPA Importing and Exporting Pesticides and Devices",
    sourceUrl: snapshot.source?.pesticideOfficialUrl || "https://www.epa.gov/compliance/importing-and-exporting-pesticides-and-devices"
  };
}

function matchFdaFlagRules(htsDigits, snapshot) {
  if (!htsDigits || !snapshot?.codes) {
    return [];
  }

  const records = snapshot.codes[htsDigits] || [];
  return records.map((record) => {
    const flag = String(record.flag || "").toUpperCase();
    const meta = snapshot.flags?.[flag] || {};
    const datasetDate = meta.datasetDate || snapshot.generatedAt?.slice(0, 10) || "";
    const listDescription = String(record.description || "").trim();
    const sourceNote = snapshot.source?.noteZh || "";

    return {
      id: `fda-flag-${flag.toLowerCase()}`,
      sequence: 4.9,
      agency: "FDA / CBP",
      nameZh: meta.nameZh || `${flag} FDA 入境数据提示`,
      nameEn: meta.nameEn || `${flag} FDA Entry Data Flag`,
      category: "pga",
      status: meta.status || "review",
      suppresses: [
        "fda-food-cosmetic-medical",
        "fda-prior-notice-fd4",
        "fda-biologics-fd1-fd2",
        "fda-drug-fd1-fd2",
        "fda-cosmetic-fd2-3304100000",
        "fda-cosmetic-fd1-fd2",
        "fda-device-fd1-fd2",
        "fda-radiation-fd1-fd2",
        "fda-veterinary-vme-fd1-fd2"
      ],
      summary: [
        meta.meaningZh || `${flag} FDA 入境申报标志。`,
        listDescription ? `清单描述：${listDescription}` : ""
      ].filter(Boolean).join(" "),
      explanation: [
        `${flag} 是 FDA/CBP 入境数据标志，不等同于产品认证证书。`,
        sourceNote,
        "最终是否申报、disclaim、提交 Prior Notice 或补充 FDA Product Code，仍需结合产品实际用途、成分、标签和进口资料确认。"
      ].filter(Boolean).join(" "),
      sourceName: "FDA Harmonized Tariff Schedule and FD Flags",
      sourceUrl: snapshot.source?.officialUrl || "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags",
      matchedBy: [
        `${flag} HTS 精确代码 ${formatHtsForDisplay(htsDigits)}`,
        datasetDate ? `清单日期 ${datasetDate}` : ""
      ].filter(Boolean).join("；"),
      matchedExactCodes: [htsDigits],
      matchedPrefixes: [],
      matchedKeywords: []
    };
  });
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
  const ratedParameterMatches = (rule.ratedParameterPatterns || [])
    .map((pattern) => matchPattern(haystack, pattern))
    .filter(Boolean);

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
  if (rule.ratedParameterCheck) {
    reasons.push(ratedParameterMatches.length
      ? `额定参数 ${ratedParameterMatches.slice(0, 3).join(" / ")}`
      : "额定参数待补充");
  }

  const result = {
    matchedBy: reasons.join("；"),
    matchedExactCodes: exactMatches,
    matchedPrefixes: prefixMatches,
    matchedKeywords: keywordMatches,
    matchedRatedParameters: ratedParameterMatches
  };
  if (rule.ratedParameterCheck && ratedParameterMatches.length === 0) {
    result.status = "need_input";
  }
  return result;
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
  if (/^[a-z0-9][a-z0-9\s']+[a-z0-9]$/.test(normalized)) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalized)}($|\\s)`, "i").test(haystack);
  }
  return haystack.includes(normalized);
}

function matchPattern(haystack, pattern) {
  try {
    return haystack.match(new RegExp(pattern, "i"))?.[0] || "";
  } catch {
    return "";
  }
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

function formatHtsForDisplay(value) {
  const digits = normalizeHtsDigits(value);
  if (digits.length === 10) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8)}`;
  }
  return digits;
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
