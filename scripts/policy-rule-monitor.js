const CBP_FORCED_LABOR_301_URL = "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/421d887";
const CBP_SECTION_122_URL = "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/40b3b7b";
const USTR_FORCED_LABOR_301_URL =
  "https://ustr.gov/sites/default/files/files/Press/Releases/2026/FLIP%20301%20Investigation%20Final%20Action%20FRN%207-23-26%20FINAL.pdf";
const FEDERAL_REGISTER_USTR_301_URL =
  "https://www.federalregister.gov/api/v1/documents.json?per_page=10&conditions%5Bagencies%5D%5B%5D=trade-representative-office-of-united-states&conditions%5Bterm%5D=Section%20301%20additional%20duties&order=newest";

const SECTION_122_EFFECTIVE_FROM = "2026-02-24T05:01:00.000Z";
const SECTION_122_EFFECTIVE_TO = "2026-07-24T04:01:00.000Z";
const FORCED_LABOR_EFFECTIVE_FROM = "2026-07-24T04:01:00.000Z";

export async function buildPolicyRulesSnapshot(options = {}) {
  const now = normalizeDate(options.now) || new Date();
  const generatedAt = now.toISOString();
  const previous = options.previous || null;
  const fetchImpl = options.fetchImpl || fetch;
  const sources = [];
  const alerts = [];

  let forcedLaborRules = [];
  try {
    const html = await fetchText(CBP_FORCED_LABOR_301_URL, fetchImpl);
    const text = htmlToText(html);
    forcedLaborRules = parseForcedLabor301Rules(text, { generatedAt });
    const chinaRule = forcedLaborRules.find((rule) => isChinaCountry(rule.country));
    sources.push({
      id: "cbpForcedLabor301",
      name: "CBP Section 301 Forced Labor Import Duties",
      sourceName: "CBP CSMS #69326983",
      url: CBP_FORCED_LABOR_301_URL,
      status: forcedLaborRules.length ? "ok" : "warning",
      fetchedAt: generatedAt,
      detail: {
        count: forcedLaborRules.length,
        chinaCode: chinaRule?.code || "",
        chinaRate: chinaRule?.rate ?? null,
        effectiveFrom: FORCED_LABOR_EFFECTIVE_FROM
      }
    });
    if (!chinaRule) {
      alerts.push({
        severity: "warning",
        title: "CBP 强迫劳动301指南未解析到中国规则",
        sourceUrl: CBP_FORCED_LABOR_301_URL,
        message: "监控器会保留上一版或内置 9903.05.31 规则，但需要人工复核源页面结构是否变化。"
      });
    }
  } catch (error) {
    forcedLaborRules = recoverForcedLaborRules(previous, generatedAt);
    sources.push({
      id: "cbpForcedLabor301",
      name: "CBP Section 301 Forced Labor Import Duties",
      sourceName: "CBP CSMS #69326983",
      url: CBP_FORCED_LABOR_301_URL,
      status: "error",
      fetchedAt: generatedAt,
      message: error.message,
      detail: {
        count: forcedLaborRules.length,
        recovered: true
      }
    });
    alerts.push({
      severity: "warning",
      title: "CBP 强迫劳动301指南抓取失败",
      sourceUrl: CBP_FORCED_LABOR_301_URL,
      message: `${error.message}；已使用上一版或内置规则继续计算。`
    });
  }

  const federalRegisterCandidates = await fetchFederalRegisterCandidates(fetchImpl, generatedAt, alerts);
  sources.push(federalRegisterCandidates.source);
  alerts.push(...federalRegisterCandidates.alerts);

  const rules = [
    buildTemporary122Rule(generatedAt),
    ...dedupeRules(forcedLaborRules.length ? forcedLaborRules : recoverForcedLaborRules(previous, generatedAt))
  ].map((rule) => ({
    ...rule,
    status: resolveRuleStatus(rule, now)
  }));

  const supplementalChapter99Rows = dedupeChapter99Rows(
    rules
      .filter((rule) => rule.chapter99Row)
      .map((rule) => ({
        ...rule.chapter99Row,
        sourceName: rule.sourceName,
        sourceUrl: rule.sourceUrl
      }))
  );

  const actionableAlerts = alerts.filter((alert) => alert.severity !== "info");
  const status = sources.some((source) => source.status === "error") || actionableAlerts.length
    ? "warning"
    : "ok";

  return {
    generatedAt,
    status,
    version: 1,
    defaultOriginCountry: "China",
    description: "Policy rule monitor for newly added, active, and expired Chapter 99 duty rules.",
    sources,
    alerts,
    candidates: federalRegisterCandidates.candidates,
    rules,
    supplementalChapter99Rows
  };
}

export function buildLegacyForcedLabor301Snapshot(policyRules, options = {}) {
  const generatedAt = options.generatedAt || policyRules?.generatedAt || new Date().toISOString();
  const chinaRule = (policyRules?.rules || []).find(
    (rule) => rule.program === "section301" && rule.policyType === "forcedLabor" && isChinaCountry(rule.country)
  ) || buildForcedLaborChinaFallback(generatedAt);
  return {
    generatedAt,
    sourceName: chinaRule.sourceName || "CBP Section 301 Forced Labor Import Duties",
    sourceUrl: chinaRule.sourceUrl || CBP_FORCED_LABOR_301_URL,
    effectiveFrom: chinaRule.effectiveFrom || FORCED_LABOR_EFFECTIVE_FROM,
    country: chinaRule.country || "China",
    rate: chinaRule.rate ?? 12.5,
    chapter99Rows: [chinaRule.chapter99Row || buildForcedLaborChapter99Row(chinaRule)]
  };
}

export function resolveRuleStatus(rule, date = new Date()) {
  const reference = normalizeDate(date) || new Date();
  const start = normalizeDate(rule.effectiveFrom);
  const end = normalizeDate(rule.effectiveTo);
  if (start && reference < start) {
    return "upcoming";
  }
  if (end && reference >= end) {
    return "expired";
  }
  return "active";
}

function buildTemporary122Rule(generatedAt) {
  return {
    id: "section122-temporary-99030301",
    program: "section122",
    policyType: "temporarySurcharge",
    group: "122",
    label: "122-临时关税",
    shortLabel: "122",
    code: "9903.03.01",
    rate: 10,
    country: "Any",
    originCountries: ["Any"],
    defaultApply: true,
    autoApply: true,
    effectiveFrom: SECTION_122_EFFECTIVE_FROM,
    effectiveTo: SECTION_122_EFFECTIVE_TO,
    sourceName: "CBP CSMS Section 122 Guidance",
    sourceUrl: CBP_SECTION_122_URL,
    summaryZh: "122 临时关税，编码 9903.03.01，税率 +10%。",
    exemptionStatus: "条件豁免",
    note: "按申报日期自动判断生效/截止；截止后不计入估算。",
    generatedAt,
    chapter99Row: {
      htsno: "9903.03.01",
      statisticalSuffix: "",
      description: "Except for products described in headings 9903.03.02-9903.03.11, articles the product of any country, as provided for in subdivision (aa) of U.S. note 2 to this subchapter",
      descriptionEn: "Except for products described in headings 9903.03.02-9903.03.11, articles the product of any country, as provided for in subdivision (aa) of U.S. note 2 to this subchapter",
      descriptionZh: "除 9903.03.02-9903.03.11 所列产品外，任何国家原产商品按美国注释 2(aa) 适用 122 临时附加税。",
      indent: 0,
      units: [],
      general: "The duty provided in the applicable subheading + 10%",
      special: "The duty provided in the applicable subheading + 10%",
      other: "The duty provided in the applicable subheading + 10%",
      additionalDuties: "",
      additionalDutyCodes: [],
      quotaQuantity: "",
      effectivePeriod: "Effective from 2026-02-24 00:01 EST through 2026-07-24 00:01 EDT.",
      footnotes: [],
      superior: false,
      unique: false,
      status: ""
    }
  };
}

function parseForcedLabor301Rules(text, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const normalized = String(text || "")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const pattern = /\b(9903\.05\.\d{2})\s*:\s*Except for products described in headings\s+(.+?),\s*articles the product of\s+(.+?)\s+will be assessed an additional ad valorem (?:rate of duty|duty rate) of\s+(\d+(?:\.\d+)?)\s*%/gi;
  const rules = [];
  let match;
  while ((match = pattern.exec(normalized))) {
    const [, code, exemptionsText, rawCountry, rawRate] = match;
    const country = cleanupCountry(rawCountry);
    const rate = Number(rawRate);
    if (!code || !country || !Number.isFinite(rate)) {
      continue;
    }
    const rule = buildForcedLaborRule({ code, country, rate, exemptionsText, generatedAt });
    rules.push(rule);
  }
  return dedupeRules(rules);
}

function buildForcedLaborRule({ code, country, rate, exemptionsText, generatedAt }) {
  const china = isChinaCountry(country);
  const countryZh = china ? "中国" : country;
  const label = china ? "新301-强迫劳动" : `新301-强迫劳动-${country}`;
  const rule = {
    id: `section301-forced-labor-${slugify(country)}-${code.replace(/\./g, "")}`,
    program: "section301",
    policyType: "forcedLabor",
    group: "301",
    label,
    shortLabel: "新301",
    code,
    rate,
    country,
    originCountries: [country],
    defaultApply: china,
    autoApply: china,
    effectiveFrom: FORCED_LABOR_EFFECTIVE_FROM,
    effectiveTo: "",
    sourceName: "CBP CSMS #69326983",
    sourceUrl: CBP_FORCED_LABOR_301_URL,
    ustrSourceUrl: USTR_FORCED_LABOR_301_URL,
    summaryZh: china
      ? `新301强迫劳动最终行动，中国原产商品对应 ${code}，当前税率 +${formatRate(rate)}%。`
      : `新301强迫劳动最终行动，${country} 原产商品对应 ${code}，税率 +${formatRate(rate)}%。`,
    exemptionStatus: "条件适用",
    note: `适用于 2026-07-24 00:01 美东后申报的 ${countryZh}${china ? "" : " "}原产商品；${exemptionsText} 所列排除项需人工复核。`,
    exemptionsText,
    generatedAt
  };
  return {
    ...rule,
    chapter99Row: buildForcedLaborChapter99Row(rule)
  };
}

function buildForcedLaborChapter99Row(rule) {
  const countryZh = isChinaCountry(rule.country) ? "中国" : rule.country;
  const countryProductPhrase = isChinaCountry(rule.country) ? `${countryZh}原产商品` : `${countryZh} 原产商品`;
  return {
    htsno: rule.code,
    statisticalSuffix: "",
    description: `Except for products described in headings ${rule.exemptionsText || "9903.05.85-9903.05.92"}, articles the product of ${rule.country}, as provided for in U.S. note 52 to this subchapter`,
    descriptionEn: `Except for products described in headings ${rule.exemptionsText || "9903.05.85-9903.05.92"}, articles the product of ${rule.country}, as provided for in U.S. note 52 to this subchapter`,
    descriptionZh: `除 ${rule.exemptionsText || "9903.05.85-9903.05.92"} 所列产品外，${countryProductPhrase}按美国注释 52 适用新301强迫劳动附加税。`,
    indent: 0,
    units: [],
    general: `The duty provided in the applicable subheading + ${formatRate(rule.rate)}%`,
    special: `The duty provided in the applicable subheading + ${formatRate(rule.rate)}%`,
    other: `The duty provided in the applicable subheading + ${formatRate(rule.rate)}%`,
    additionalDuties: "",
    additionalDutyCodes: [],
    quotaQuantity: "",
    effectivePeriod: "Effective for covered goods entered for consumption on or after 2026-07-24 00:01 EDT.",
    footnotes: [],
    superior: false,
    unique: false,
    status: ""
  };
}

async function fetchFederalRegisterCandidates(fetchImpl, generatedAt, inheritedAlerts = []) {
  const alerts = [];
  try {
    const response = await fetchImpl(FEDERAL_REGISTER_USTR_301_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "hts-clearance-assistant-policy-monitor/1.0"
      }
    });
    if (!response.ok) {
      throw new Error(`Federal Register API returned ${response.status}`);
    }
    const data = await response.json();
    const candidates = (data.results || []).map((item) => ({
      title: item.title || "",
      publicationDate: item.publication_date || "",
      htmlUrl: item.html_url || "",
      pdfUrl: item.pdf_url || "",
      type: item.type || "",
      abstract: item.abstract || ""
    }));
    for (const candidate of candidates) {
      if (shouldFlagFederalRegisterCandidate(candidate)) {
        alerts.push({
          severity: "info",
          title: "发现 USTR/Federal Register Section 301 候选公告",
          sourceUrl: candidate.htmlUrl || candidate.pdfUrl,
          publicationDate: candidate.publicationDate,
          message: candidate.title
        });
      }
    }
    return {
      source: {
        id: "federalRegisterUstr301",
        name: "Federal Register USTR Section 301 Monitor",
        sourceName: "Federal Register API",
        url: FEDERAL_REGISTER_USTR_301_URL,
        status: "ok",
        fetchedAt: generatedAt,
        detail: {
          count: candidates.length,
          alertCount: alerts.length
        }
      },
      candidates,
      alerts
    };
  } catch (error) {
    return {
      source: {
        id: "federalRegisterUstr301",
        name: "Federal Register USTR Section 301 Monitor",
        sourceName: "Federal Register API",
        url: FEDERAL_REGISTER_USTR_301_URL,
        status: "error",
        fetchedAt: generatedAt,
        message: error.message,
        detail: {
          count: 0,
          inheritedAlertCount: inheritedAlerts.length
        }
      },
      candidates: [],
      alerts: [{
        severity: "warning",
        title: "Federal Register 监控失败",
        sourceUrl: FEDERAL_REGISTER_USTR_301_URL,
        message: error.message
      }]
    };
  }
}

function shouldFlagFederalRegisterCandidate(candidate) {
  const text = `${candidate.title || ""} ${candidate.abstract || ""}`.toLowerCase();
  if (!/section 301|tariff|additional dut|notice of action/.test(text)) {
    return false;
  }
  return !/second four-year review|request for comments/i.test(candidate.title || "");
}

function recoverForcedLaborRules(previous, generatedAt) {
  const previousRules = (previous?.rules || [])
    .filter((rule) => rule.program === "section301" && rule.policyType === "forcedLabor")
    .map((rule) => ({
      ...rule,
      generatedAt,
      chapter99Row: rule.chapter99Row || buildForcedLaborChapter99Row(rule)
    }));
  return previousRules.length ? previousRules : [buildForcedLaborChinaFallback(generatedAt)];
}

function buildForcedLaborChinaFallback(generatedAt) {
  return buildForcedLaborRule({
    code: "9903.05.31",
    country: "China",
    rate: 12.5,
    exemptionsText: "9903.05.85-9903.05.92",
    generatedAt
  });
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "hts-clearance-assistant-policy-monitor/1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "’")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupCountry(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+will\s+be.*$/i, "")
    .trim();
}

function dedupeRules(rules) {
  const byKey = new Map();
  for (const rule of rules || []) {
    if (!rule?.code) {
      continue;
    }
    const key = `${rule.program || ""}|${rule.policyType || ""}|${rule.code}|${rule.country || ""}`.toLowerCase();
    byKey.set(key, rule);
  }
  return [...byKey.values()].sort((a, b) => {
    const countryCompare = String(a.country || "").localeCompare(String(b.country || ""));
    return countryCompare || String(a.code || "").localeCompare(String(b.code || ""));
  });
}

function dedupeChapter99Rows(rows) {
  const byCode = new Map();
  for (const row of rows || []) {
    if (row?.htsno) {
      byCode.set(row.htsno, row);
    }
  }
  return [...byCode.values()].sort((a, b) => String(a.htsno).localeCompare(String(b.htsno)));
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isChinaCountry(country) {
  return /^(china|people'?s republic of china|prc|中国)$/i.test(String(country || "").trim());
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function formatRate(rate) {
  return String(Number(rate) || 0).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
