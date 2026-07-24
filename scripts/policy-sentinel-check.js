import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchCertificationRules } from "../public/certification-rule-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "public", "data");

const sentinels = [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const [manifest, searchIndex, chapter99, forcedLabor301, section122, section232, cotton, adCvd] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readJson(path.join(dataDir, "hts-search-index.json")),
    readJson(path.join(dataDir, "chapter99.json")),
    readJson(path.join(dataDir, "forced-labor-301.json")),
    readJson(path.join(dataDir, "section122-exclusions.json")),
    readJson(path.join(dataDir, "section232.json")),
    readJson(path.join(dataDir, "cotton.json")),
    readJson(path.join(dataDir, "adcvd.json"))
  ]);

  checkManifest(manifest);
  checkForcedLabor301(forcedLabor301);
  checkSection122Exclusions(section122);
  checkChapter99(chapter99);
  checkLaptop122Outcome(searchIndex, section122);
  checkRelatedAnnexIiElectronics(section122);
  checkTextile6307909891Outcome(searchIndex);
  checkCertificationPrompt(searchIndex);
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
  const forcedLabor301 = (manifest.sources || []).find((source) => source.id === "forcedLabor301");
  record(
    "manifest includes section122 source",
    Boolean(section122 && section122.state?.detail?.count >= 1500),
    section122 ? `count=${section122.state?.detail?.count || 0}` : "missing"
  );
  record(
    "manifest includes forced labor 301 supplemental source",
    Boolean(forcedLabor301 && forcedLabor301.state?.detail?.count >= 1),
    forcedLabor301 ? `count=${forcedLabor301.state?.detail?.count || 0}` : "missing"
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

function checkCertificationPrompt(searchIndex) {
  const row = findRowByDigits(searchIndex, "3304100000") || {
    htsno: "3304.10.00.00",
    description: "Lip make-up preparations",
    descriptionZh: "lip makeup preparations"
  };
  const matches = matchCertificationRules(row, { query: "3304100000", productName: "lipstick lip balm cosmetics" });
  const ids = matches.map((match) => match.id);
  record(
    "3304100000 keeps AM7 and FD2 certification prompts",
    ids.includes("ams-organic-am7") && ids.includes("fda-cosmetic-fd2-3304100000"),
    `matches=${ids.join(",") || "none"}`
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
