import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchCertificationRules } from "../public/certification-rule-engine.js";
import {
  getPreferredDescriptionZh,
  isUsableChineseDescription
} from "../public/description-helper.js";
import {
  matchForcedLaborExemptions
} from "../public/forced-labor-exemption-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "public", "data");

const sentinels = [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const [manifest, searchIndex, chapter99, policyRules, forcedLabor301, forcedLaborExemptions, section122, section232, cotton, adCvd, epaFlags, fdaFlags] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readJson(path.join(dataDir, "hts-search-index.json")),
    readJson(path.join(dataDir, "chapter99.json")),
    readJson(path.join(dataDir, "policy-rules.json")),
    readJson(path.join(dataDir, "forced-labor-301.json")),
    readJson(path.join(dataDir, "forced-labor-exemptions.json")),
    readJson(path.join(dataDir, "section122-exclusions.json")),
    readJson(path.join(dataDir, "section232.json")),
    readJson(path.join(dataDir, "cotton.json")),
    readJson(path.join(dataDir, "adcvd.json")),
    readJson(path.join(dataDir, "epa-flags.json")),
    readJson(path.join(dataDir, "fda-flags.json"))
  ]);

  checkManifest(manifest);
  checkPolicyRules(policyRules);
  checkForcedLabor301(forcedLabor301);
  checkForcedLaborExemptions(forcedLaborExemptions);
  checkDescriptionHelpers();
  checkSection122Exclusions(section122);
  checkChapter99(chapter99);
  checkLaptop122Outcome(searchIndex, section122);
  checkRelatedAnnexIiElectronics(section122);
  checkTextile6307909891Outcome(searchIndex);
  checkCertificationPrompt(searchIndex, fdaFlags);
  checkFdaFd1PrinterPrompt(searchIndex, fdaFlags);
  checkEpaEp5AndDoeFtcPrompts(searchIndex, epaFlags);
  checkSection232Snapshot(section232);
  checkCottonSnapshot(cotton);
  checkAdCvdSnapshot(adCvd);

  console.table(sentinels.map(({ name, status, detail }) => ({ name, status, detail })));
  const failures = sentinels.filter((item) => item.status === "FAIL");
  if (failures.length) {
    console.error(`Policy sentinel failed: ${failures.map((item) => item.name).join(", ")}`);
    process.exitCode = 1;
  }
}

function checkManifest(manifest) {
  const section122 = (manifest.sources || []).find((source) => source.id === "section122");
  const policyRules = (manifest.sources || []).find((source) => source.id === "policyRules");
  const forcedLabor301 = (manifest.sources || []).find((source) => source.id === "forcedLabor301");
  const forcedLaborExemptions = (manifest.sources || []).find((source) => source.id === "forcedLaborExemptions");
  const fdaFlags = (manifest.sources || []).find((source) => source.id === "fdaFlags");
  record(
    "manifest includes section122 source",
    Boolean(section122 && section122.state?.detail?.count >= 1500),
    section122 ? `count=${section122.state?.detail?.count || 0}` : "missing"
  );
  record(
    "manifest includes policy rule monitor source",
    Boolean(policyRules && policyRules.state?.detail?.count >= 2),
    policyRules ? `count=${policyRules.state?.detail?.count || 0}; alerts=${policyRules.state?.detail?.alertCount || 0}` : "missing"
  );
  record(
    "manifest includes forced labor 301 supplemental source",
    Boolean(forcedLabor301 && forcedLabor301.state?.detail?.count >= 1),
    forcedLabor301 ? `count=${forcedLabor301.state?.detail?.count || 0}` : "missing"
  );
  record(
    "manifest includes forced labor 301 exclusion statistics",
    Boolean(
      forcedLaborExemptions
      && forcedLaborExemptions.state?.detail?.count >= 800
      && forcedLaborExemptions.state?.detail?.activeRules === 7
      && forcedLaborExemptions.state?.detail?.expiredRules === 1
      && forcedLaborExemptions.state?.detail?.expiredRule === "9903.05.85 截止 2026-07-28"
    ),
    forcedLaborExemptions
      ? `count=${forcedLaborExemptions.state?.detail?.count || 0}; active=${forcedLaborExemptions.state?.detail?.activeRules || 0}; expired=${forcedLaborExemptions.state?.detail?.expiredRules || 0}`
      : "missing"
  );
  record(
    "manifest includes FDA FD flag source",
    Boolean(fdaFlags && fdaFlags.state?.detail?.count >= 5000),
    fdaFlags ? `count=${fdaFlags.state?.detail?.count || 0}` : "missing"
  );
}

function checkPolicyRules(policyRules) {
  const rules = policyRules.rules || [];
  const forcedChina = rules.find((rule) => cleanHts(rule.code) === "99030531" && /^china$/i.test(rule.country || ""));
  const section122 = rules.find((rule) => cleanHts(rule.code) === "99030301");
  const referenceDate = new Date("2026-07-26T00:00:00Z");
  record(
    "policy-rules keeps China forced labor 301 active at +12.5%",
    Boolean(forcedChina && Number(forcedChina.rate) === 12.5 && ruleStatusAt(forcedChina, referenceDate) === "active"),
    forcedChina ? `code=${forcedChina.code}; rate=${forcedChina.rate}; status=${ruleStatusAt(forcedChina, referenceDate)}` : "missing"
  );
  record(
    "policy-rules expires Section 122 after July 24 2026",
    Boolean(section122 && ruleStatusAt(section122, referenceDate) === "expired"),
    section122 ? `code=${section122.code}; status=${ruleStatusAt(section122, referenceDate)}; effectiveTo=${section122.effectiveTo || "none"}` : "missing"
  );
}

function checkForcedLabor301(forcedLabor301) {
  const rows = forcedLabor301.chapter99Rows || [];
  const rule = rows.find((row) => cleanHts(row.htsno) === "99030531");
  record(
    "forced labor 301 supplemental rule keeps China 9903.05.31 at +12.5%",
    Boolean(rule && /\+ *12\.5%/.test(String(rule.general || "")) && forcedLabor301.country === "China"),
    `9903.05.31=${rule?.general || "missing"}; country=${forcedLabor301.country || "missing"}`
  );
}

function checkForcedLaborExemptions(snapshot) {
  const match = matchForcedLaborExemptions("8524911000", snapshot, {
    referenceDate: new Date("2026-07-29T00:00:00Z")
  });
  const transitRule = snapshot.rules?.["9903.05.85"];
  const currentRulesWithoutDates = Object.values(snapshot.rules || {})
    .filter((rule) => rule.code !== "9903.05.85" && rule.effectiveTo);

  record(
    "8524911000 automatically resolves to 9903.05.86 exclusion",
    Boolean(match.exact?.code === "9903.05.86" && match.exact.autoExempt),
    `exact=${match.exact?.code || "none"}; possible=${match.possible.map((item) => item.code).join(",") || "none"}`
  );
  record(
    "9903.05.85 keeps real July 28 expiry and is archived",
    Boolean(
      transitRule?.effectiveTo === "2026-07-28T04:01:00.000Z"
      && match.expired.some((item) => item.code === "9903.05.85")
    ),
    `effectiveTo=${transitRule?.effectiveTo || "missing"}; status=${transitRule?.status || "missing"}`
  );
  record(
    "open-ended forced labor exclusions do not use fake 2099 expiry",
    currentRulesWithoutDates.length === 0,
    `unexpectedExpiry=${currentRulesWithoutDates.map((rule) => `${rule.code}:${rule.effectiveTo}`).join(",") || "none"}`
  );
}

function checkDescriptionHelpers() {
  const printer = getPreferredDescriptionZh({
    htsno: "8443.31.00.00",
    description: "Machines which perform two or more of the functions of printing, copying or facsimile transmission, capable of connecting to an automatic data processing machine or to a network",
    descriptionZh: "机器具 perform two 及以上 functions of printing"
  });
  const displayModule = getPreferredDescriptionZh({
    htsno: "8524.91.10.00",
    description: "Flat panel display modules, other than flat panel display modules for articles of subheadings 8528.59, 8528.69, 8528.72 and 8528.73",
    descriptionZh: "LED显示屏，除...以外 LED显示屏供制品 of subheadings"
  });
  record(
    "8443310000 uses exact Chinese leaf description",
    isUsableChineseDescription(printer) && /打印、复印或传真/.test(printer),
    printer
  );
  record(
    "8524911000 uses flat panel display module terminology",
    isUsableChineseDescription(displayModule) && displayModule.startsWith("平板显示模组") && !displayModule.startsWith("LED显示屏"),
    displayModule
  );
}

function checkSection122Exclusions(section122) {
  const codes = normalizeCodeSet(section122.codes);
  const required = ["84713001", "84714101", "84714900", "84715001", "85171300", "85411000"];
  const missing = required.filter((code) => !codes.has(code));
  record(
    "section122 Annex II exclusion prefixes are loaded",
    (section122.count || codes.size) >= 1500 && missing.length === 0,
    `count=${section122.count || codes.size}; missing=${missing.join(",") || "none"}`
  );
}

function checkChapter99(chapter99) {
  const rows = chapter99.value || [];
  const rule122 = rows.find((row) => cleanHts(row.htsno) === "99030301");
  const annexExempt = rows.find((row) => cleanHts(row.htsno) === "99030303");
  record(
    "chapter99 keeps 122 base and Annex II exemption rows",
    Boolean(rule122 && annexExempt && /\+ *10%/.test(String(rule122.general || "")) && !/\+ *10%/.test(String(annexExempt.general || ""))),
    `9903.03.01=${rule122?.general || "missing"}; 9903.03.03=${annexExempt?.general || "missing"}`
  );
}

function checkLaptop122Outcome(searchIndex, section122) {
  const row = findRowByDigits(searchIndex, "8471300100");
  const excludedPrefix = findPrefix(section122.codes, "8471300100");
  const sourceCodes = new Set(row?.additionalDutyCodes || []);
  const wouldAutoApply122 = sourceCodes.has("9903.03.01") && !excludedPrefix;
  record(
    "8471.30.0100 resolves to Section 122 exemption, not +10%",
    Boolean(row && excludedPrefix && !wouldAutoApply122),
    `row=${row?.htsno || "missing"}; excludedBy=${formatHts(excludedPrefix)}; additionalDutyCodes=${[...sourceCodes].join(",") || "none"}`
  );
}

function checkRelatedAnnexIiElectronics(section122) {
  const sampleCodes = [
    "8471410100",
    "8471490000",
    "8471500100",
    "8471601000",
    "8471709000",
    "8517130000",
    "8517620000",
    "8541100000",
    "8541499500"
  ];
  const missing = sampleCodes.filter((code) => !findPrefix(section122.codes, code));
  record(
    "related Annex II electronics prefixes stay covered",
    missing.length === 0,
    `missing=${missing.map(formatHts).join(",") || "none"}`
  );
}

function checkTextile6307909891Outcome(searchIndex) {
  const row = findRowByDigits(searchIndex, "6307909891");
  const codes = new Set(row?.additionalDutyCodes || []);
  record(
    "6307.90.98.91 keeps current China 301 mapping without inherited 9903.91.01",
    Boolean(row && codes.has("9903.88.15") && codes.has("9903.88.69") && !codes.has("9903.91.01") && !codes.has("9903.91.07")),
    `row=${row?.htsno || "missing"}; additionalDutyCodes=${[...codes].join(",") || "none"}`
  );
}

function checkCertificationPrompt(searchIndex, fdaFlags) {
  const row = findRowByDigits(searchIndex, "3304100000") || {
    htsno: "3304.10.00.00",
    description: "Lip make-up preparations",
    descriptionZh: "lip makeup preparations"
  };
  const matches = matchCertificationRules(row, {
    query: "3304100000",
    productName: "lipstick lip balm cosmetics",
    fdaFlags
  });
  const ids = matches.map((match) => match.id);
  record(
    "3304100000 keeps AM7 and FD2 certification prompts",
    ids.includes("ams-organic-am7") && ids.includes("fda-flag-fd2"),
    `matches=${ids.join(",") || "none"}`
  );
}

function checkFdaFd1PrinterPrompt(searchIndex, fdaFlags) {
  const row = findRowByDigits(searchIndex, "8443310000") || {
    htsno: "8443.31.00.00",
    description: "Machines which perform two or more of the functions of printing, copying or facsimile transmission"
  };
  const matches = matchCertificationRules(row, { query: "8443310000", fdaFlags });
  const fd1 = matches.find((match) => match.id === "fda-flag-fd1");
  record(
    "8443310000 resolves to FDA FD1 exact HTS flag",
    Boolean(fd1 && fd1.matchedExactCodes?.includes("8443310000")),
    fd1 ? `matchedBy=${fd1.matchedBy}` : `matches=${matches.map((match) => match.id).join(",") || "none"}`
  );
}

function checkEpaEp5AndDoeFtcPrompts(searchIndex, epaFlags) {
  const applianceRow = findRowByDigits(searchIndex, "8509805095") || {
    htsno: "8509.80.50.95",
    description: "Other electromechanical domestic appliances"
  };
  const applianceMatches = matchCertificationRules(applianceRow, {
    query: "8509805095",
    epaFlags
  });
  const applianceIds = applianceMatches.map((match) => match.id);
  const ep5 = applianceMatches.find((match) => match.id === "epa-flag-ep5");
  record(
    "8509805095 resolves to exact EPA EP5 without broad DOE/FTC 8509 hit",
    Boolean(
      ep5
      && ep5.summary === "可能需要 EPA 进口申报"
      && ep5.matchedExactCodes?.includes("8509805095")
      && !applianceIds.includes("doe-energy-labeling")
    ),
    `matches=${applianceIds.join(",") || "none"}`
  );

  const ledRow = findRowByDigits(searchIndex, "8539510000") || {
    htsno: "8539.51.00.00",
    description: "Light-emitting diode (LED) modules"
  };
  const dualMatches = matchCertificationRules(ledRow, {
    query: "pesticidal LED lamp 9W for pest control",
    productName: "LED lamp",
    notes: "120V 9W pesticidal device",
    epaFlags
  });
  const dualIds = dualMatches.map((match) => match.id);
  record(
    "EPA EP5 and DOE/FTC prompts remain independent when both apply",
    dualIds.includes("epa-flag-ep5")
      && dualIds.includes("doe-energy-labeling")
      && dualMatches.find((match) => match.id === "doe-energy-labeling")?.matchedRatedParameters?.includes("9w"),
    `matches=${dualIds.join(",") || "none"}`
  );

  const refrigeratorMatches = matchCertificationRules({
    htsno: "8418.10.00.00",
    description: "Combined refrigerator-freezers"
  }, {
    query: "household refrigerator",
    epaFlags
  });
  const refrigeratorDoe = refrigeratorMatches.find((match) => match.id === "doe-energy-labeling");
  record(
    "DOE/FTC covered product without ratings asks for parameters",
    Boolean(refrigeratorDoe && refrigeratorDoe.status === "need_input"),
    refrigeratorDoe ? `status=${refrigeratorDoe.status}; matchedBy=${refrigeratorDoe.matchedBy}` : "missing"
  );
}

function checkSection232Snapshot(section232) {
  const entries = section232.entries || [];
  const hasVehicleOrDerivative = entries.some((entry) => /^8708/.test(cleanHts(entry.hts)) || /vehicle|derivative/i.test(entry.context || ""));
  record(
    "section232 snapshot is non-empty and includes vehicle/derivative coverage",
    entries.length >= 1000 && hasVehicleOrDerivative,
    `count=${entries.length}; source=${section232.sourceUrl || section232.source?.url || "unknown"}`
  );
}

function checkCottonSnapshot(cotton) {
  const rows = cotton.rows || [];
  const hasKnownCottonRate = rows.some((row) => cleanHts(row.hts) === "5201000500" && Number(row.usdPerKg) > 0);
  record(
    "cotton import assessment snapshot is non-empty",
    rows.length >= 2000 && hasKnownCottonRate,
    `count=${rows.length}; source=${cotton.source?.url || "unknown"}`
  );
}

function checkAdCvdSnapshot(adCvd) {
  const entries = adCvd.entries || [];
  const hasChinaCase = entries.some((entry) => (entry.caseNumbers || []).some((caseNumber) => /^A-570|^C-570/.test(caseNumber)));
  record(
    "AD/CVD snapshot is non-empty and keeps China case metadata",
    entries.length >= 500 && hasChinaCase,
    `count=${entries.length}`
  );
}

async function readJson(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(stripBom(text));
}

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function record(name, passed, detail) {
  sentinels.push({ name, status: passed ? "PASS" : "FAIL", detail });
}

function findRowByDigits(index, digits) {
  const target = cleanHts(digits);
  return (index.value || []).find((row) => cleanHts(row.htsno) === target);
}

function findPrefix(codes = [], hts) {
  const digits = cleanHts(hts);
  return [...normalizeCodeSet(codes)]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .find((prefix) => digits === prefix || digits.startsWith(prefix)) || "";
}

function ruleStatusAt(rule, date) {
  const start = parseDate(rule.effectiveFrom);
  const end = parseDate(rule.effectiveTo);
  if (start && date < start) return "upcoming";
  if (end && date >= end) return "expired";
  return "active";
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCodeSet(codes = []) {
  return new Set((codes || []).map(cleanHts).filter(Boolean));
}

function cleanHts(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatHts(value) {
  const digits = cleanHts(value);
  if (digits.length >= 10) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8, 10)}`;
  }
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
  }
  return digits;
}
