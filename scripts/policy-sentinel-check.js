import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { matchCertificationRules } from "../public/certification-rule-engine.js";
import {
  getPreferredDescriptionZh,
  isUsableChineseDescription
} from "../public/description-helper.js";
import {
  findTradeMeasureOverlap,
  matchForcedLaborExemptions
} from "../public/forced-labor-exemption-engine.js";
import {
  getSelectedVehicleChapter99Rules,
  NON_VEHICLE_DUTY_CHOICE,
  resolveVehiclePartsDutyChoice
} from "../public/vehicle-duty-choice-engine.js";
import { selectSection232MetalCandidates } from "../public/section232-metal-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "public", "data");

const sentinels = [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const [manifest, searchIndex, chapter99, chinaTariffs301, policyRules, forcedLabor301, forcedLaborExemptions, section122, section232, section232VehicleParts, cotton, adCvd, epaFlags, fdaFlags] = await Promise.all([
    readJson(path.join(dataDir, "manifest.json")),
    readJson(path.join(dataDir, "hts-search-index.json")),
    readJson(path.join(dataDir, "chapter99.json")),
    readJson(path.join(dataDir, "china-tariffs-301.json")),
    readJson(path.join(dataDir, "policy-rules.json")),
    readJson(path.join(dataDir, "forced-labor-301.json")),
    readJson(path.join(dataDir, "forced-labor-exemptions.json")),
    readJson(path.join(dataDir, "section122-exclusions.json")),
    readJson(path.join(dataDir, "section232.json")),
    readJson(path.join(dataDir, "section232-vehicle-parts.json")),
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
  checkChinaTariffs301(manifest, searchIndex, chinaTariffs301);
  checkLaptop122Outcome(searchIndex, section122);
  checkRelatedAnnexIiElectronics(section122);
  checkTextile6307909891Outcome(searchIndex);
  checkCertificationPrompt(searchIndex, fdaFlags);
  checkFdaFd1PrinterPrompt(searchIndex, fdaFlags);
  checkEpaEp5AndDoeFtcPrompts(searchIndex, epaFlags);
  checkSection232Snapshot(section232);
  checkWoodFurnitureDutyOutcome(searchIndex, policyRules, forcedLaborExemptions, section232);
  checkSection232VehiclePartsSnapshot(section232VehicleParts);
  checkVehicleDutyChoiceOutcomes(forcedLaborExemptions, section232VehicleParts, section232);
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
  const chinaTariffs301 = (manifest.sources || []).find((source) => source.id === "chinaTariffs301");
  const forcedLabor301 = (manifest.sources || []).find((source) => source.id === "forcedLabor301");
  const forcedLaborExemptions = (manifest.sources || []).find((source) => source.id === "forcedLaborExemptions");
  const fdaFlags = (manifest.sources || []).find((source) => source.id === "fdaFlags");
  record(
    "manifest includes section122 source",
    Boolean(section122 && section122.state?.detail?.count >= 1500),
    section122 ? `count=${section122.state?.detail?.count || 0}` : "missing"
  );
  record(
    "manifest includes China Tariffs 301 mapping source",
    Boolean(chinaTariffs301 && chinaTariffs301.state?.detail?.count >= 10000),
    chinaTariffs301
      ? `status=${chinaTariffs301.state?.status || "missing"}; count=${chinaTariffs301.state?.detail?.count || 0}; anomalies=${chinaTariffs301.state?.detail?.anomalyCount || 0}`
      : "missing"
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
    Boolean(
      match.exact?.code === "9903.05.86"
      && match.exact.autoExempt
      && match.exact.matchedHts === "8524.91.10"
    ),
    `exact=${match.exact?.code || "none"}; matchedHts=${match.exact?.matchedHts || "none"}; possible=${match.possible.map((item) => item.code).join(",") || "none"}`
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

function checkChinaTariffs301(manifest, searchIndex, snapshot) {
  const source = (manifest.sources || []).find((item) => item.id === "chinaTariffs301");
  const sourceDetail = source?.state?.detail || {};
  const sourceWarningSurfaced = source?.state?.status === "warning"
    && (
      Number(sourceDetail.anomalyCount || 0) > 0
      || /China Tariffs 301|3924\.90\.56|3924905650|9401\.61|9401\.69|9903\.88\.(04|15)/.test(`${source?.state?.message || ""} ${JSON.stringify(sourceDetail)}`)
    );
  const sourceCodes = new Set(snapshot.byHts?.["39249056"] || []);
  const row = findRowByDigits(searchIndex, "3924905650");
  const rowCodes = new Set(row?.additionalDutyCodes || []);
  const sourceHasSentinel = sourceCodes.has("9903.88.15");
  const rowHasSentinel = Boolean(row && rowCodes.has("9903.88.15"));

  record(
    "USITC China Tariffs maps 3924.90.56 to 9903.88.15",
    sourceHasSentinel || sourceWarningSurfaced,
    `sourceCodes=${[...sourceCodes].join(",") || "none"}; syncStatus=${source?.state?.status || "missing"}`
  );
  record(
    "3924.90.56.50 China 301 mapping reaches search index or sync center warning",
    rowHasSentinel || sourceWarningSurfaced,
    `row=${row?.htsno || "missing"}; additionalDutyCodes=${[...rowCodes].join(",") || "none"}; syncStatus=${source?.state?.status || "missing"}; message=${source?.state?.message || ""}`
  );

  const seatingIncludes = [
    ["9401614011", "9401.61.40.11 upholstered wooden household seats"],
    ["9401696011", "9401.69.60.11 wooden household seats"],
    ["9401710011", "9401.71.00 seating"],
    ["9401790011", "9401.79.00 seating"],
    ["9401802011", "9401.80.20 seating"],
    ["9401804006", "9401.80.40 seating"]
  ];
  const missingSeatingIncludes = seatingIncludes.filter(([digits]) => {
    const targetRow = findRowByDigits(searchIndex, digits);
    return !targetRow || !(targetRow.additionalDutyCodes || []).includes("9903.88.04");
  });
  record(
    "Chapter 99 note 20(g) seating inclusions reach search index as 9903.88.04",
    missingSeatingIncludes.length === 0 || sourceWarningSurfaced,
    `missing=${missingSeatingIncludes.map(([, label]) => label).join("; ") || "none"}; syncStatus=${source?.state?.status || "missing"}`
  );

  const seatingExclusions = [
    "9401614001",
    "9401696001",
    "9401710001",
    "9401790001",
    "9401802001",
    "9401804001"
  ];
  const unexpectedExclusions = seatingExclusions.filter((digits) => {
    const targetRow = findRowByDigits(searchIndex, digits);
    return targetRow && (targetRow.additionalDutyCodes || []).includes("9903.88.04");
  });
  record(
    "Chapter 99 note 20(g) seating statistical exclusions are not over-applied",
    unexpectedExclusions.length === 0,
    `unexpected=${unexpectedExclusions.map(formatHts).join(",") || "none"}`
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
  const conveyorRow = findRowByDigits(searchIndex, "8428330000") || {
    htsno: "8428.33.00.00",
    description: "Other continuous-action elevators and conveyors, belt type"
  };
  const conveyorMatches = matchCertificationRules(conveyorRow, {
    query: "8428330000",
    epaFlags
  });
  const ep3 = conveyorMatches.find((match) => match.id === "epa-flag-ep3");
  record(
    "8428330000 resolves to exact EPA EP3 vehicle or engine filing prompt",
    Boolean(
      ep3
      && ep3.summary === "可能需要 EPA 车辆或发动机进口申报"
      && ep3.matchedExactCodes?.includes("8428330000")
      && /车辆和发动机申报标志/.test(ep3.explanation || "")
    ),
    `matches=${conveyorMatches.map((match) => match.id).join(",") || "none"}`
  );

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
      && ep5.summary === "可能需要 EPA 农药及装置进口申报"
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

  const conveyorRawCodes = new Set(entries
    .filter((entry) => cleanHts(entry.hts) === "84283300")
    .map((entry) => entry.chapter99));
  const conveyorCandidates = selectSection232MetalCandidates("8428330000", entries, "Free");
  const applied = conveyorCandidates.find((candidate) => candidate.autoApply);
  const candidateCodes = new Set(conveyorCandidates.map((candidate) => candidate.entry.chapter99));
  record(
    "8428330000 uses grouped 232 branches and defaults to 9903.82.10 at 15%",
    conveyorRawCodes.has("9903.82.03")
      && conveyorRawCodes.has("9903.82.07")
      && conveyorRawCodes.has("9903.82.08")
      && conveyorRawCodes.has("9903.82.10")
      && conveyorRawCodes.has("9903.82.11")
      && !conveyorRawCodes.has("9903.82.09")
      && applied?.entry.chapter99 === "9903.82.10"
      && Number(applied.rate) === 15
      && candidateCodes.has("9903.82.03")
      && candidateCodes.has("9903.82.07"),
    `raw=${[...conveyorRawCodes].sort().join(",")}; candidates=${[...candidateCodes].sort().join(",")}; applied=${applied?.entry.chapter99 || "none"}; rate=${applied?.rate ?? "--"}`
  );

  const expectedWoodEntries = [
    ...[
      "4403.11.00",
      "4403.21.01",
      "4403.22.01",
      "4403.23.01",
      "4403.24.01",
      "4403.25.01",
      "4403.26.01",
      "4403.99.01",
      "4406.11.00",
      "4406.91.00",
      "4407.11.00",
      "4407.12.00",
      "4407.13.00",
      "4407.14.00",
      "4407.19.00"
    ].map((hts) => ["9903.76.01", cleanHts(hts)]),
    ...["9401.61.4011", "9401.61.4031", "9401.61.6011", "9401.61.6031"]
      .map((hts) => ["9903.76.02", cleanHts(hts)]),
    ...["9403.40.9060", "9403.60.8093", "9403.91.0080"]
      .flatMap((hts) => [["9903.76.03", cleanHts(hts)], ["9903.76.04", cleanHts(hts)]])
  ];
  const woodKeys = new Set(entries.map((entry) => `${entry.chapter99}|${cleanHts(entry.hts)}`));
  const missingWoodEntries = expectedWoodEntries.filter(([chapter99, hts]) => !woodKeys.has(`${chapter99}|${hts}`));
  const softwoodApplied = selectSection232MetalCandidates("4407110000", entries, "Free")
    .find((candidate) => candidate.autoApply);
  const cabinetCodes = ["9403409060", "9403608093", "9403910080"];
  const cabinetOutcomes = cabinetCodes.map((hts) => {
    const candidates = selectSection232MetalCandidates(hts, entries, "Free");
    const applied = candidates.find((candidate) => candidate.autoApply);
    return {
      hts,
      applied: applied?.entry.chapter99 || "",
      rate: applied?.rate,
      hasExclusionBranch: candidates.some((candidate) => candidate.entry.chapter99 === "9903.76.04" && !candidate.autoApply),
      countryBranchesFiltered: !candidates.some((candidate) => /^9903\.76\.(20|21|22|23|24)$/.test(candidate.entry.chapter99 || ""))
    };
  });
  record(
    "section232 wood-products snapshot covers all China-relevant timber, furniture and cabinet branches",
    missingWoodEntries.length === 0
      && softwoodApplied?.entry.chapter99 === "9903.76.01"
      && Number(softwoodApplied.rate) === 10
      && cabinetOutcomes.every((item) =>
        item.applied === "9903.76.03"
        && Number(item.rate) === 25
        && item.hasExclusionBranch
        && item.countryBranchesFiltered
      ),
    `missing=${missingWoodEntries.map(([chapter99, hts]) => `${chapter99}/${hts}`).join(",") || "none"}; softwood=${softwoodApplied?.entry.chapter99 || "none"}:${softwoodApplied?.rate ?? "--"}; cabinets=${cabinetOutcomes.map((item) => `${item.hts}:${item.applied || "none"}:${item.rate ?? "--"}:${item.hasExclusionBranch ? "has04" : "no04"}`).join(";")}`
  );

  const woodRawCodes = new Set(entries
    .filter((entry) => cleanHts(entry.hts) === "9401614011")
    .map((entry) => entry.chapter99));
  const woodCandidates = selectSection232MetalCandidates("9401614011", entries, "Free");
  const woodApplied = woodCandidates.find((candidate) => candidate.autoApply);
  const nonWoodCandidates = selectSection232MetalCandidates("9401696011", entries, "Free");
  record(
    "9401.61 upholstered wooden household seats hit 232 wood products while 9401.69 does not",
    woodRawCodes.has("9903.76.02")
      && woodApplied?.entry.chapter99 === "9903.76.02"
      && Number(woodApplied.rate) === 25
      && !nonWoodCandidates.some((candidate) => candidate.entry.chapter99 === "9903.76.02"),
    `9401614011 raw=${[...woodRawCodes].join(",") || "none"}; applied=${woodApplied?.entry.chapter99 || "none"}; rate=${woodApplied?.rate ?? "--"}; 9401696011 candidates=${nonWoodCandidates.map((candidate) => candidate.entry.chapter99).join(",") || "none"}`
  );
}

function checkWoodFurnitureDutyOutcome(searchIndex, policyRules, forcedLaborExemptions, section232) {
  const target = findRowByDigits(searchIndex, "9401614011");
  const dutyCodes = new Set(target?.additionalDutyCodes || []);
  const forcedLaborDefault = (policyRules.rules || []).find((rule) =>
    rule.code === "9903.05.31" && rule.defaultApply !== false && rule.autoApply !== false
  );
  const woodApplied = selectSection232MetalCandidates("9401614011", section232.entries || [], "Free")
    .find((candidate) => candidate.autoApply && candidate.entry.chapter99 === "9903.76.02");
  const forcedLaborExemption = matchForcedLaborExemptions("9401614011", forcedLaborExemptions, {
    referenceDate: new Date("2026-08-01T00:00:00Z"),
    appliedChapter99Rules: woodApplied
      ? [{
          code: woodApplied.entry.chapter99,
          label: "232-木制品",
          autoApply: true,
          material: { code: "wood-products", label: "木制品" }
        }]
      : []
  });
  const estimatedAdditionalRate = (dutyCodes.has("9903.88.04") ? 25 : 0)
    + (woodApplied ? Number(woodApplied.rate) : 0)
    + (forcedLaborDefault && !forcedLaborExemption.exact ? Number(forcedLaborDefault.rate || 12.5) : 0);

  record(
    "9401614011 tax stack prioritizes China 301 plus wood 232 and excludes forced-labor 301",
    dutyCodes.has("9903.88.04")
      && Boolean(forcedLaborDefault)
      && woodApplied?.entry.chapter99 === "9903.76.02"
      && Number(woodApplied.rate) === 25
      && forcedLaborExemption.exact?.code === "9903.05.90"
      && forcedLaborExemption.exact?.triggerCode === "9903.76.02"
      && estimatedAdditionalRate === 50,
    `codes=${[...dutyCodes].join(",") || "none"}; defaultForcedLabor=${forcedLaborDefault?.code || "none"}; wood=${woodApplied?.entry.chapter99 || "none"}; forcedLaborExclusion=${forcedLaborExemption.exact?.code || "none"}; estimated=${estimatedAdditionalRate}%`
  );

  const cabinetCodes = ["9403409060", "9403608093", "9403910080"];
  const cabinetOutcomes = cabinetCodes.map((hts) => {
    const row = findRowByDigits(searchIndex, hts);
    const codes = new Set(row?.additionalDutyCodes || []);
    const applied = selectSection232MetalCandidates(hts, section232.entries || [], row?.general || "Free")
      .find((candidate) => candidate.autoApply && candidate.entry.chapter99 === "9903.76.03");
    const exemption = matchForcedLaborExemptions(hts, forcedLaborExemptions, {
      referenceDate: new Date("2026-08-01T00:00:00Z"),
      appliedChapter99Rules: applied
        ? [{
            code: applied.entry.chapter99,
            label: "232-木制品",
            autoApply: true,
            material: { code: "wood-products", label: "木制品" }
          }]
        : []
    });
    const estimated = (codes.has("9903.88.03") ? 25 : 0)
      + (applied ? Number(applied.rate) : 0)
      + (forcedLaborDefault && !exemption.exact ? Number(forcedLaborDefault.rate || 12.5) : 0);
    return {
      hts,
      hasChina301: codes.has("9903.88.03"),
      wood: applied?.entry.chapter99 || "",
      rate: applied?.rate,
      exclusion: exemption.exact?.code || "",
      estimated
    };
  });
  record(
    "9403 cabinet and vanity wood-product codes default to China 301 plus 232 wood, excluding forced-labor 301",
    cabinetOutcomes.every((item) =>
      item.hasChina301
      && item.wood === "9903.76.03"
      && Number(item.rate) === 25
      && item.exclusion === "9903.05.90"
      && item.estimated === 50
    ),
    cabinetOutcomes.map((item) => `${item.hts}:301=${item.hasChina301 ? "yes" : "no"};wood=${item.wood || "none"};exclusion=${item.exclusion || "none"};estimated=${item.estimated}%`).join(" | ")
  );
}

function checkSection232VehiclePartsSnapshot(snapshot) {
  const automobile = snapshot.lists?.find((list) => list.id === "automobile");
  const mhdv = snapshot.lists?.find((list) => list.id === "mhdv");
  const automobileCodes = new Set((automobile?.codes || []).map((entry) => cleanHts(entry.hts)));
  const mhdvCodes = new Set((mhdv?.codes || []).map((entry) => cleanHts(entry.hts)));
  const target = "85122020";
  const allCodes = [...new Set([...automobileCodes, ...mhdvCodes])];
  const non8708 = allCodes.filter((code) => !code.startsWith("8708"));

  record(
    "section232 vehicle-parts lists include 8512.20.20 in both vehicle categories",
    automobileCodes.has(target) && mhdvCodes.has(target),
    `automobile=${automobileCodes.size}; mhdv=${mhdvCodes.size}; overlap=${snapshot.audit?.overlapCount || 0}`
  );
  record(
    "section232 vehicle-parts audit covers non-8708 official codes",
    non8708.length >= 100 && Number(snapshot.audit?.missedByLegacy8708RuleCount) === non8708.length,
    `non8708=${non8708.length}; examples=${non8708.slice(0, 5).join(",")}`
  );
}

function checkVehicleDutyChoiceOutcomes(forcedLaborExemptions, snapshot, section232) {
  const automobile = snapshot.lists?.find((list) => list.id === "automobile");
  const mhdv = snapshot.lists?.find((list) => list.id === "mhdv");
  const automobileCodes = new Set((automobile?.codes || []).map((entry) => cleanHts(entry.hts)));
  const mhdvCodes = new Set((mhdv?.codes || []).map((entry) => cleanHts(entry.hts)));
  const overlapCodes = [...automobileCodes].filter((code) => mhdvCodes.has(code));
  const sampleMatches = buildVehicleChoiceMatches("85122020", automobileCodes, mhdvCodes);

  const passengerChoice = resolveVehiclePartsDutyChoice(sampleMatches);
  const passengerExemption = matchForcedLaborExemptions("8512202080", forcedLaborExemptions, {
    referenceDate: new Date("2026-08-01T00:00:00Z"),
    appliedChapter99Rules: getSelectedVehicleChapter99Rules(passengerChoice)
  });
  record(
    "8512202080 defaults to passenger/light vehicle 232 and excludes new forced-labor 301",
    passengerChoice.selectedChoice === "9903.94.05"
      && passengerExemption.exact?.code === "9903.05.90"
      && passengerExemption.exact?.triggerCode === "9903.94.05",
    `selected=${passengerChoice.selectedChoice}; exclusion=${passengerExemption.exact?.code || "none"}; trigger=${passengerExemption.exact?.triggerCode || "none"}`
  );

  const mhdvChoice = resolveVehiclePartsDutyChoice(sampleMatches, "9903.74.08");
  const mhdvExemption = matchForcedLaborExemptions("8512202080", forcedLaborExemptions, {
    referenceDate: new Date("2026-08-01T00:00:00Z"),
    appliedChapter99Rules: getSelectedVehicleChapter99Rules(mhdvChoice)
  });
  record(
    "8512202080 MHDV choice excludes new forced-labor 301 without stacking vehicle remedies",
    getSelectedVehicleChapter99Rules(mhdvChoice).length === 1
      && mhdvExemption.exact?.code === "9903.05.90"
      && mhdvExemption.exact?.triggerCode === "9903.74.08",
    `selected=${mhdvChoice.selectedChoice}; applied=${getSelectedVehicleChapter99Rules(mhdvChoice).map((item) => item.code).join(",") || "none"}`
  );

  const nonVehicleChoice = resolveVehiclePartsDutyChoice(sampleMatches, NON_VEHICLE_DUTY_CHOICE);
  const nonVehicleExemption = matchForcedLaborExemptions("8512202080", forcedLaborExemptions, {
    referenceDate: new Date("2026-08-01T00:00:00Z"),
    appliedChapter99Rules: getSelectedVehicleChapter99Rules(nonVehicleChoice)
  });
  record(
    "8512202080 non-vehicle choice keeps vehicle 232 out and does not use 9903.05.90",
    getSelectedVehicleChapter99Rules(nonVehicleChoice).length === 0
      && nonVehicleExemption.exact?.code !== "9903.05.90",
    `selected=${nonVehicleChoice.selectedChoice}; exclusion=${nonVehicleExemption.exact?.code || "none"}`
  );

  const overlapFailures = overlapCodes.filter((code) => {
    const resolution = resolveVehiclePartsDutyChoice(buildVehicleChoiceMatches(code, automobileCodes, mhdvCodes));
    const exemption = matchForcedLaborExemptions(code, forcedLaborExemptions, {
      referenceDate: new Date("2026-08-01T00:00:00Z"),
      appliedChapter99Rules: getSelectedVehicleChapter99Rules(resolution)
    });
    return resolution.optionCount !== 3 || exemption.exact?.code !== "9903.05.90";
  });
  record(
    "all overlapping official vehicle-parts HTS candidates receive three-way choice logic",
    overlapCodes.length >= 80 && overlapFailures.length === 0,
    `overlap=${overlapCodes.length}; failures=${overlapFailures.slice(0, 8).join(",") || "none"}`
  );

  const nonVehicleMeasures = [
    { code: "9903.82.04", material: { code: "derivative-steel" } },
    { code: "9903.76.20" },
    { code: "9903.79.01" }
  ];
  const missingTradeMeasures = nonVehicleMeasures.filter((rule) => !findTradeMeasureOverlap([rule]));
  record(
    "9903.05.90 overlap engine covers metals, wood products and semiconductors",
    missingTradeMeasures.length === 0,
    `missing=${missingTradeMeasures.map((item) => item.code).join(",") || "none"}`
  );

  const vehicleUnion = new Set([...automobileCodes, ...mhdvCodes]);
  const metalOverlapCodes = [...vehicleUnion].filter((vehicleCode) =>
    (section232.entries || []).some((entry) => {
      const metalCode = cleanHts(entry.hts);
      return metalCode && (vehicleCode.startsWith(metalCode) || metalCode.startsWith(vehicleCode));
    })
  );
  const metalNonStackFailures = metalOverlapCodes.filter((code) => {
    const vehicleMatches = buildVehicleChoiceMatches(code, automobileCodes, mhdvCodes);
    const metalEntry = (section232.entries || []).find((entry) => {
      const metalCode = cleanHts(entry.hts);
      return metalCode && (code.startsWith(metalCode) || metalCode.startsWith(code));
    });
    const resolution = resolveVehiclePartsDutyChoice([
      ...vehicleMatches,
      {
        code: metalEntry?.chapter99 || "9903.82.04",
        autoApply: true,
        source: "CBP Metals HTS List",
        material: { code: "steel" }
      }
    ]);
    const selectedRules = resolution.matches.filter((match) => match.autoApply !== false);
    return selectedRules.some((match) => /9903\.(82|85)\./.test(match.code || ""));
  });
  record(
    "vehicle-parts choices suppress overlapping metals 232 instead of stacking both",
    metalOverlapCodes.length >= 20 && metalNonStackFailures.length === 0,
    `overlap=${metalOverlapCodes.length}; failures=${metalNonStackFailures.slice(0, 8).join(",") || "none"}`
  );
}

function buildVehicleChoiceMatches(hts, automobileCodes, mhdvCodes) {
  const digits = cleanHts(hts);
  const matches = [];
  if ([...automobileCodes].some((code) => digits.startsWith(code) || code.startsWith(digits))) {
    matches.push({
      code: "9903.94.05",
      rate: 25,
      autoApply: true,
      choiceGroup: "vehicle-parts-section232",
      choiceRank: 1,
      label: "232-汽车零配件"
    });
  }
  if ([...mhdvCodes].some((code) => digits.startsWith(code) || code.startsWith(digits))) {
    matches.push({
      code: "9903.74.08",
      rate: 25,
      autoApply: false,
      choiceGroup: "vehicle-parts-section232",
      choiceRank: 2,
      label: "232-重型汽车零配件"
    });
  }
  return matches;
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
