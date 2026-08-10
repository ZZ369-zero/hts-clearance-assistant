import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  buildClassificationCandidates,
  getDeterministicDescriptionZh,
  getExactDescriptionZh,
  getPreferredDescriptionZh,
  isUsableChineseDescription
} from "../public/description-helper.js";
import { buildLegacyForcedLabor301Snapshot, buildPolicyRulesSnapshot } from "./policy-rule-monitor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(publicDir, "data");
const chaptersDir = path.join(dataDir, "chapters");
const port = Number(process.env.STATIC_EXPORT_PORT || 4183);
const baseUrl = process.env.STATIC_EXPORT_BASE_URL || `http://127.0.0.1:${port}`;
const scope = getArgValue("--scope") || process.env.STATIC_EXPORT_SCOPE || "all";
const now = new Date().toISOString();
const forcedLabor301SourceUrl = "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/421d887";
const execFileAsync = promisify(execFile);

const syncSourceConfig = {
  hts: {
    ids: ["htsStatus", "chapter99"],
    minutes: 60
  },
  policyRules: {
    ids: ["policyRules"],
    minutes: 60
  },
  forcedLabor301: {
    ids: ["forcedLabor301"],
    minutes: 60
  },
  forcedLaborExemptions: {
    ids: ["forcedLaborExemptions"],
    minutes: 60
  },
  section122: {
    ids: ["section122"],
    minutes: 1440
  },
  section232: {
    ids: ["section232"],
    minutes: 360
  },
  cotton: {
    ids: ["cotton"],
    minutes: 1440
  },
  adcvd: {
    ids: ["adcvdOfficial", "adcvdLocal"],
    minutes: 1440
  },
  epaFlags: {
    ids: ["epaFlags"],
    minutes: 1440
  },
  fdaFlags: {
    ids: ["fdaFlags"],
    minutes: 1440
  },
  translations: {
    ids: ["translations"],
    minutes: 1440
  }
};

const sourceLabels = {
  htsStatus: ["USITC HTS version", "USITC HTS", "Official HTS release and revision information.", "https://hts.usitc.gov/"],
  chapter99: ["Chapter 99 additional duties", "USITC HTS Chapter 99", "301, 122, 232 and other Chapter 99 rows.", "https://hts.usitc.gov/reststop/exportList?from=9900&to=9999&format=JSON&styles=false"],
  policyRules: ["Policy duty monitor", "USTR / CBP / Federal Register", "Automatically monitors new and expired policy duty rules.", "https://www.federalregister.gov/api/v1/documents.json"],
  forcedLabor301: ["New 301 forced labor duty", "CBP Section 301 Forced Labor Import Duties", "Compatibility snapshot derived from policy-rules.json for 9903.05.31.", forcedLabor301SourceUrl],
  forcedLaborExemptions: ["新301排除清单", "CBP Forced Labor HTS List", "解析9903.05.85-9903.05.92排除规则，统计有效、到期、精确HTS及条件类项目。", forcedLabor301SourceUrl],
  section122: ["122 Annex II exclusions", "White House Section 122 Annex II", "Section 122 Annex II HTS exclusion prefixes used to avoid applying 9903.03.01 to excluded goods.", "https://www.whitehouse.gov/wp-content/uploads/2026/02/2026Section122.prc_.ANNEX2_.Final_.pdf"],
  section232: ["232 金属与车辆零部件清单", "CBP / GovDelivery Section 232 HTS Lists", "CBP 金属、汽车零部件和中重型车辆零部件官方清单。", "https://www.cbp.gov/trade/programs-administration/trade-remedies"],
  cotton: ["Cotton Import Assessment", "eCFR 7 CFR 1205", "Cotton import assessment table.", "https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XI/part-1205/subpart-ECFR80efc31412f8612"],
  adcvdOfficial: ["AD/CVD official ACCESS", "ITA ACCESS AD/CVD", "Official ACCESS status monitor.", "https://access.trade.gov/adcvd"],
  adcvdLocal: ["AD/CVD HTS match dataset", "Local AD/CVD data snapshot", "HTS match snapshot used by the static site.", "https://access.trade.gov/adcvd"],
  epaFlags: ["EPA ACE EP3/EP5 HTS flags", "EPA / CustomsInfo public OGA lists", "EPA EP3 vehicle/engine and EP5 pesticide/device exact HTS filing prompts.", "https://www.epa.gov/importing-exporting"],
  fdaFlags: ["FDA FD1-FD4 HTS flags", "FDA / CustomsInfo public OGA lists", "FDA flag meanings and exact HTS code lists used for FD1-FD4 entry prompts.", "https://www.fda.gov/industry/import-basics/harmonized-tariff-schedule-and-fd-flags"],
  translations: ["商品中文描述缓存", "GitHub Copilot 强模型 + HTS术语校准", "强模型翻译并通过数字、范围与法律限定词校验的双语商品描述；访客浏览时不再逐条等待在线翻译。", ""]
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  await mkdir(chaptersDir, { recursive: true });

  let server = null;
  if (!process.env.STATIC_EXPORT_BASE_URL) {
    server = await startServer();
  }

  try {
    await waitForServer();
    const manifest = await readJsonSafe(path.join(dataDir, "manifest.json"), {
      generatedAt: "",
      chapters: [],
      release: null,
      counts: {},
      sources: []
    });
    const selected = expandScope(scope);
    console.log(`Static export scope: ${selected.join(", ")}`);

    if (selected.includes("hts")) {
      await exportHts(manifest);
    }
    if (selected.includes("policyRules")) {
      await exportPolicyRules(manifest);
    }
    if (selected.includes("forcedLabor301")) {
      await exportForcedLabor301(manifest);
    }
    if (selected.includes("forcedLaborExemptions")) {
      await exportForcedLaborExemptions(manifest);
    }
    if (selected.includes("section122")) {
      await exportSection122(manifest);
    }
    if (selected.includes("section232")) {
      await exportSection232(manifest);
    }
    if (selected.includes("cotton")) {
      await exportCotton(manifest);
    }
    if (selected.includes("adcvd")) {
      await exportAdCvd(manifest);
    }
    if (selected.includes("epaFlags")) {
      await exportEpaFlags(manifest);
    }
    if (selected.includes("fdaFlags")) {
      await exportFdaFlags(manifest);
    }
    if (selected.includes("translations")) {
      await exportTranslations(manifest);
    }

    manifest.generatedAt = now;
    manifest.staticMode = true;
    manifest.scope = selected;
    manifest.sources = mergeSources(manifest.sources || [], selected, manifest.counts || {});
    await writeJson(path.join(dataDir, "manifest.json"), manifest);
  } finally {
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

async function exportHts(manifest) {
  console.log("Exporting HTS release, chapters and search index...");
  const [status, chaptersData] = await Promise.all([
    fetchJson("/api/status?refresh=1"),
    fetchJson("/api/chapters")
  ]);

  manifest.release = status.release || null;
  manifest.htsFetchedAt = status.fetchedAt || now;
  manifest.chapters = chaptersData.chapters || [];

  const searchRows = [];
  let totalRows = 0;
  await rm(chaptersDir, { recursive: true, force: true });
  await mkdir(chaptersDir, { recursive: true });

  for (const [chapter] of manifest.chapters) {
    const data = await fetchJson(`/api/chapter?chapter=${encodeURIComponent(chapter)}&refresh=1`);
    const rows = data.value || [];
    totalRows += rows.length;
    await writeJson(path.join(chaptersDir, `${chapter}.json`), data);
    for (const { row } of buildClassificationCandidates(rows)) {
      if (row.htsno) {
        searchRows.push(row);
      }
    }
    console.log(`  chapter ${chapter}: ${rows.length}`);
  }

  const searchIndex = {
    generatedAt: now,
    count: searchRows.length,
    value: searchRows
  };
  await writeJson(path.join(dataDir, "hts-search-index.json"), searchIndex);

  const chapter99Path = path.join(chaptersDir, "99.json");
  const chapter99 = await readJsonSafe(chapter99Path, { value: [] });
  await writeJson(path.join(dataDir, "chapter99.json"), {
    generatedAt: now,
    count: chapter99.value?.length || 0,
    value: chapter99.value || []
  });

  manifest.counts = {
    ...(manifest.counts || {}),
    htsRows: totalRows,
    searchRows: searchRows.length,
    chapter99Rows: chapter99.value?.length || 0
  };
  setSourceState(manifest, "htsStatus", { count: 1, release: getReleaseLabel(status.release), fetchedAt: status.fetchedAt || now });
  setSourceState(manifest, "chapter99", { count: chapter99.value?.length || 0, fetchedAt: now });
}

async function exportSection232(manifest) {
  console.log("Exporting Section 232 index...");
  const vehiclePartsFile = path.join(dataDir, "section232-vehicle-parts.json");
  const oldVehicleParts = await readJsonSafe(vehiclePartsFile, null);
  let vehicleParts;

  try {
    const pythonCommand = process.env.PYTHON || "python";
    const parserPath = path.join(__dirname, "parse-section232-vehicle-parts.py");
    const result = await execFileAsync(pythonCommand, [parserPath], {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 4 * 60 * 1000
    });
    vehicleParts = JSON.parse(result.stdout);
  } catch (error) {
    if (!oldVehicleParts?.lists?.length) {
      throw error;
    }
    console.warn(`Section 232 vehicle-parts export failed, keeping previous snapshot: ${error.message}`);
    vehicleParts = {
      ...oldVehicleParts,
      retainedPreviousRows: true,
      warning: error.message
    };
  }

  const automobile = vehicleParts.lists?.find((list) => list.id === "automobile");
  const mhdv = vehicleParts.lists?.find((list) => list.id === "mhdv");
  if (!automobile?.codes?.some((entry) => entry.hts === "85122020") || !mhdv?.codes?.some((entry) => entry.hts === "85122020")) {
    throw new Error("Section 232 vehicle-parts export failed sentinel: 8512.20.20 must be in both official lists.");
  }
  await writeJson(vehiclePartsFile, vehicleParts);

  const old = await readJsonSafe(path.join(dataDir, "section232.json"), null);
  const data = await fetchJson("/api/static/section-232-index?refresh=1").catch((error) => {
    if (old) {
      console.warn(`Section 232 export failed, keeping previous snapshot: ${error.message}`);
      return old;
    }
    throw error;
  });
  await writeJson(path.join(dataDir, "section232.json"), data);
  const vehiclePartsRows = (vehicleParts.lists || []).reduce((sum, list) => sum + (list.codes?.length || 0), 0);
  manifest.counts = {
    ...(manifest.counts || {}),
    section232Rows: (data.entries?.length || 0) + vehiclePartsRows,
    section232VehiclePartRows: vehiclePartsRows
  };
  setSourceState(manifest, "section232", {
    count: (data.entries?.length || 0) + vehiclePartsRows,
    url: data.sourceUrl || data.source?.url,
    effectiveNote: `${data.effectiveNote || "CBP Metals HTS List"}；车辆零部件清单 ${vehiclePartsRows} 条。`,
    fetchedAt: vehicleParts.generatedAt || data.fetchedAt || now
  });
}

async function exportPolicyRules(manifest) {
  console.log("Exporting policy duty monitor rules...");
  const old = await readJsonSafe(path.join(dataDir, "policy-rules.json"), null);
  const data = await buildPolicyRulesSnapshot({ now: new Date(now), previous: old }).catch((error) => {
    if (old?.rules?.length) {
      console.warn(`Policy rule monitor failed, keeping previous snapshot: ${error.message}`);
      return {
        ...old,
        generatedAt: now,
        status: "warning",
        retainedPreviousRules: true,
        alerts: [
          ...(old.alerts || []),
          {
            severity: "warning",
            title: "政策税项监控抓取失败",
            message: error.message,
            sourceUrl: sourceLabels.policyRules[3]
          }
        ]
      };
    }
    throw error;
  });
  await writeJson(path.join(dataDir, "policy-rules.json"), data);
  manifest.counts = { ...(manifest.counts || {}), policyRuleRows: data.rules?.length || 0 };
  setSourceState(manifest, "policyRules", {
    status: data.status === "ok" ? "ok" : "warning",
    message: data.alerts?.length ? `发现 ${data.alerts.length} 条政策监控提示` : "Policy monitor updated",
    count: data.rules?.length || 0,
    alertCount: data.alerts?.length || 0,
    candidateCount: data.candidates?.length || 0,
    sourceCount: data.sources?.length || 0,
    fetchedAt: data.generatedAt || now
  });
}

async function exportForcedLabor301(manifest) {
  console.log("Exporting forced labor Section 301 supplemental rule...");
  const policyRules = await readJsonSafe(path.join(dataDir, "policy-rules.json"), null)
    || await buildPolicyRulesSnapshot({ now: new Date(now) });
  const data = buildLegacyForcedLabor301Snapshot(policyRules, { generatedAt: now });
  await writeJson(path.join(dataDir, "forced-labor-301.json"), data);
  manifest.counts = { ...(manifest.counts || {}), forcedLabor301Rows: data.chapter99Rows?.length || 0 };
  setSourceState(manifest, "forcedLabor301", {
    count: data.chapter99Rows?.length || 0,
    sourceUrl: data.sourceUrl,
    effectiveFrom: data.effectiveFrom,
    country: data.country,
    fetchedAt: data.generatedAt
  });
}

async function exportForcedLaborExemptions(manifest) {
  console.log("Exporting CBP forced-labor Section 301 exclusions...");
  const filePath = path.join(dataDir, "forced-labor-exemptions.json");
  const old = await readJsonSafe(filePath, null);
  let data;

  try {
    const pythonCommand = process.env.PYTHON || "python";
    const parserPath = path.join(__dirname, "parse-forced-labor-exemptions.py");
    const result = await execFileAsync(pythonCommand, [parserPath], {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      },
      maxBuffer: 32 * 1024 * 1024,
      timeout: 4 * 60 * 1000
    });
    data = JSON.parse(result.stdout);
  } catch (error) {
    if (!old?.rules?.["9903.05.86"]?.codes?.length) {
      throw error;
    }
    console.warn(`Forced-labor exclusion export failed, keeping previous snapshot: ${error.message}`);
    data = {
      ...old,
      retainedPreviousRows: true,
      warning: error.message
    };
  }

  if (!data.rules?.["9903.05.86"]?.codes?.includes("8524.91.10")) {
    throw new Error("Forced-labor exclusion export failed sentinel: 8524.91.10 is missing from 9903.05.86.");
  }
  if (data.rules?.["9903.05.85"]?.effectiveTo !== "2026-07-28T04:01:00.000Z") {
    throw new Error("Forced-labor exclusion export failed sentinel: 9903.05.85 expiry is incorrect.");
  }

  await writeJson(filePath, data);
  const stats = data.statistics || {};
  manifest.counts = {
    ...(manifest.counts || {}),
    forcedLaborExemptionCodes: stats.exactExclusionCodes || 0,
    forcedLaborExemptionActiveRules: stats.activeRules || 0,
    forcedLaborExemptionExpiredRules: stats.expiredRules || 0
  };
  setSourceState(manifest, "forcedLaborExemptions", {
    count: stats.exactExclusionCodes || 0,
    activeRules: stats.activeRules || 0,
    expiredRules: stats.expiredRules || 0,
    expiredRule: "9903.05.85 截止 2026-07-28",
    particularArticles: stats.particularArticles || 0,
    conditionalHtsCodes: stats.conditionalHtsCodes || 0,
    pdfUrl: data.pdfUrl,
    fetchedAt: data.generatedAt || now
  });
}

async function exportSection122(manifest) {
  console.log("Exporting Section 122 Annex II exclusion status...");
  const data = await readJsonSafe(path.join(dataDir, "section122-exclusions.json"), {
    generatedAt: now,
    sourceUrl: sourceLabels.section122[3],
    codes: []
  });
  const count = data.count || data.codes?.length || 0;
  manifest.counts = { ...(manifest.counts || {}), section122Rows: count };
  setSourceState(manifest, "section122", {
    count,
    fetchedAt: data.generatedAt || now,
    sourceUrl: data.sourceUrl || sourceLabels.section122[3]
  });
}

async function exportCotton(manifest) {
  console.log("Exporting cotton assessment index...");
  const old = await readJsonSafe(path.join(dataDir, "cotton.json"), null);
  const data = await fetchJson("/api/static/cotton-index?refresh=1").catch((error) => {
    if (old) {
      console.warn(`Cotton export failed, keeping previous snapshot: ${error.message}`);
      return old;
    }
    throw error;
  });
  if (!data.rows || data.rows.length === 0) {
    if (old?.rows?.length) {
      console.warn("Cotton export returned an empty table, keeping previous non-empty snapshot.");
      data.rows = old.rows;
      data.fetchedAt = old.fetchedAt;
      data.source = old.source || data.source;
      data.retainedPreviousRows = true;
    } else {
      throw new Error("Cotton export returned an empty table and no previous non-empty snapshot is available.");
    }
  }
  await writeJson(path.join(dataDir, "cotton.json"), data);
  manifest.counts = { ...(manifest.counts || {}), cottonRows: data.rows?.length || 0 };
  setSourceState(manifest, "cotton", { count: data.rows?.length || 0, fetchedAt: data.fetchedAt || now });
}

async function exportAdCvd(manifest) {
  console.log("Exporting AD/CVD snapshot...");
  const old = await readJsonSafe(path.join(dataDir, "adcvd.json"), null);
  let data = await fetchJson("/api/static/adcvd-index?refresh=1").catch((error) => {
    if (old) {
      console.warn(`AD/CVD export failed, keeping previous snapshot: ${error.message}`);
      return old;
    }
    throw error;
  });

  if ((!data.entries || data.entries.length === 0) && old?.entries?.length) {
    data = {
      ...data,
      entries: old.entries,
      updatedAt: old.updatedAt,
      retainedPreviousEntries: true
    };
  }

  data = sanitizeAdCvdSnapshot(data);

  await writeJson(path.join(dataDir, "adcvd.json"), data);
  manifest.counts = { ...(manifest.counts || {}), adcvdRows: data.entries?.length || 0 };
  setSourceState(manifest, "adcvdOfficial", {
    count: data.official ? 1 : 0,
    title: data.official?.title,
    fetchedAt: data.official?.fetchedAt || now
  });
  setSourceState(manifest, "adcvdLocal", {
    count: data.entries?.length || 0,
    updatedAt: data.updatedAt,
    fetchedAt: data.fetchedAt || now
  });
}

async function exportFdaFlags(manifest) {
  console.log("Exporting FDA FD1-FD4 HTS flag lists...");
  const filePath = path.join(dataDir, "fda-flags.json");
  const old = await readJsonSafe(filePath, null);
  let data;

  try {
    const pythonCommand = process.env.PYTHON || "python";
    const parserPath = path.join(__dirname, "parse-fda-flags.py");
    const result = await execFileAsync(pythonCommand, [parserPath], {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 4 * 60 * 1000
    });
    data = JSON.parse(result.stdout);
  } catch (error) {
    if (!old?.codes || Object.keys(old.codes).length === 0) {
      throw error;
    }
    console.warn(`FDA FD flag export failed, keeping previous snapshot: ${error.message}`);
    data = {
      ...old,
      generatedAt: now,
      retainedPreviousRows: true,
      warning: error.message
    };
  }

  if (!data.codes?.["8443310000"]?.some((record) => record.flag === "FD1")) {
    throw new Error("FDA FD flag export failed sentinel: 8443.31.0000 is not present in FD1.");
  }

  await writeJson(filePath, data);
  manifest.counts = {
    ...(manifest.counts || {}),
    fdaFlagRows: data.count || 0,
    fdaFlagCodes: data.uniqueCodeCount || Object.keys(data.codes || {}).length
  };
  setSourceState(manifest, "fdaFlags", {
    count: data.count || 0,
    uniqueCodeCount: data.uniqueCodeCount || Object.keys(data.codes || {}).length,
    datasetDates: Object.fromEntries(
      Object.entries(data.flags || {}).map(([flag, item]) => [flag, item.datasetDate || ""])
    ),
    providerName: data.source?.providerName,
    fetchedAt: data.generatedAt || now
  });
}

async function exportEpaFlags(manifest) {
  console.log("Exporting EPA ACE EP3/EP5 HTS flag lists...");
  const filePath = path.join(dataDir, "epa-flags.json");
  const old = await readJsonSafe(filePath, null);
  let data;

  try {
    const pythonCommand = process.env.PYTHON || "python";
    const parserPath = path.join(__dirname, "parse-epa-flags.py");
    const result = await execFileAsync(pythonCommand, [parserPath], {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8"
      },
      maxBuffer: 8 * 1024 * 1024,
      timeout: 4 * 60 * 1000
    });
    data = JSON.parse(result.stdout);
  } catch (error) {
    if (!old?.codes || Object.keys(old.codes).length === 0) {
      throw error;
    }
    console.warn(`EPA EP3/EP5 flag export failed, keeping previous snapshot: ${error.message}`);
    data = {
      ...old,
      generatedAt: now,
      retainedPreviousRows: true,
      warning: error.message
    };
  }

  if (!data.codes?.["8509805095"]?.some((record) => record.flag === "EP5")) {
    throw new Error("EPA EP5 flag export failed sentinel: 8509.80.5095 is not present in EP5.");
  }
  if (!data.codes?.["8428330000"]?.some((record) => record.flag === "EP3")) {
    throw new Error("EPA EP3 flag export failed sentinel: 8428.33.0000 is not present in EP3.");
  }

  await writeJson(filePath, data);
  manifest.counts = {
    ...(manifest.counts || {}),
    epaFlagRows: data.count || 0,
    epaFlagCodes: data.uniqueCodeCount || Object.keys(data.codes || {}).length
  };
  setSourceState(manifest, "epaFlags", {
    count: data.count || 0,
    uniqueCodeCount: data.uniqueCodeCount || Object.keys(data.codes || {}).length,
    datasetDates: Object.fromEntries(
      Object.entries(data.flags || {}).map(([flag, item]) => [flag, item.datasetDate || ""])
    ),
    providerName: data.source?.providerName,
    fetchedAt: data.generatedAt || now
  });
}

function sanitizeAdCvdSnapshot(data) {
  const source = { ...(data.source || {}) };
  delete source.csvPath;
  delete source.workbookPath;
  return {
    ...data,
    source: {
      ...source,
      name: source.name || "China AD/CVD HTS dataset",
      officialUrl: source.officialUrl || "https://access.trade.gov/adcvd"
    }
  };
}

async function exportTranslations(manifest) {
  console.log("Building verified description translation cache...");
  const old = await readJsonSafe(path.join(dataDir, "translations.json"), { generatedAt: "", values: {} });
  const index = await readJsonSafe(path.join(dataDir, "hts-search-index.json"), { value: [] });
  const chapterRows = [];
  for (const [chapter] of manifest.chapters || []) {
    const data = await readJsonSafe(path.join(chaptersDir, `${chapter}.json`), { value: [] });
    chapterRows.push(...(data.value || []));
  }
  const rows = chapterRows.length ? chapterRows : (index.value || []);
  const values = {};
  const methods = {};

  for (const [description, translation] of Object.entries(old.values || {})) {
    if (description && isUsableChineseDescription(translation)) {
      values[description] = String(translation).trim();
      methods[description] = old.methods?.[description] || "local-glossary";
    }
  }

  let coveredRows = 0;
  const descriptions = new Set();
  for (const row of rows) {
    const description = String(row.description || "").trim();
    if (!description) {
      continue;
    }
    descriptions.add(description);
    const exact = getExactDescriptionZh(row);
    const deterministic = getDeterministicDescriptionZh(row);
    const translation = exact || deterministic || values[description] || getPreferredDescriptionZh(row) || "";
    if (isUsableChineseDescription(translation)) {
      values[description] = translation;
      methods[description] = exact
        ? "curated"
        : (methods[description] || (deterministic && translation === deterministic ? "deterministic:chemical-structured" : "local-glossary"));
      coveredRows += 1;
    }
  }
  for (const description of Object.keys(values)) {
    if (!descriptions.has(description)) {
      delete values[description];
      delete methods[description];
    }
  }
  const calibratedDescriptions = Object.values(methods)
    .filter((method) => method === "curated"
      || method === "github-models"
      || String(method || "").startsWith("deterministic:")
      || String(method || "").startsWith("copilot-cli:")).length;
  const attempts = Object.fromEntries(
    Object.entries(old.attempts || {})
      .filter(([description, count]) => descriptions.has(description) && Number(count) > 0)
  );

  const data = {
    generatedAt: now,
    sourceGeneratedAt: index.generatedAt || "",
    coverage: {
      totalRows: rows.length,
      coveredRows,
      totalDescriptions: descriptions.size,
      cachedDescriptions: Object.keys(values).length,
      pendingDescriptions: Math.max(0, descriptions.size - Object.keys(values).length),
      calibratedDescriptions,
      pendingCalibration: Math.max(0, descriptions.size - calibratedDescriptions)
    },
    values,
    methods,
    attempts
  };
  await writeJson(path.join(dataDir, "translations.json"), data);
  manifest.counts = { ...(manifest.counts || {}), translations: Object.keys(data.values).length };
  setSourceState(manifest, "translations", {
    count: Object.keys(data.values).length,
    coveredRows,
    totalRows: rows.length,
    pendingDescriptions: data.coverage.pendingDescriptions,
    calibratedDescriptions,
    pendingCalibration: data.coverage.pendingCalibration,
    fetchedAt: now
  });
}

function expandScope(value) {
  if (!value || value === "all") {
    return ["hts", "policyRules", "forcedLabor301", "forcedLaborExemptions", "section122", "section232", "cotton", "adcvd", "epaFlags", "fdaFlags", "translations"];
  }
  return [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
}

function mergeSources(existing, selected, counts) {
  const byId = new Map((existing || []).map((source) => [source.id, source]));
  for (const selectedScope of selected) {
    const config = syncSourceConfig[selectedScope];
    if (!config) {
      continue;
    }
    for (const id of config.ids) {
      const labels = sourceLabels[id] || [id, id, ""];
      const current = byId.get(id) || {};
      const refreshConfiguredLabel = id === "section232";
      byId.set(id, {
        id,
        name: refreshConfiguredLabel ? labels[0] : current.name || labels[0],
        sourceName: refreshConfiguredLabel ? labels[1] : current.sourceName || labels[1],
        url: current.url || labels[3] || "",
        description: refreshConfiguredLabel ? labels[2] : current.description || labels[2],
        intervalMinutes: config.minutes,
        state: {
          ...(current.state || {}),
          id,
          status: "ok",
          message: "Static snapshot updated",
          lastSyncAt: now,
          nextSyncAt: new Date(Date.now() + config.minutes * 60 * 1000).toISOString(),
          detail: {
            ...((current.state || {}).detail || {}),
            count: countForSource(id, counts)
          }
        }
      });
    }
  }
  return [...byId.values()].sort((a, b) => sourceOrder(a.id) - sourceOrder(b.id));
}

function setSourceState(manifest, id, detail) {
  manifest.sources = manifest.sources || [];
  let source = manifest.sources.find((item) => item.id === id);
  if (!source) {
    const labels = sourceLabels[id] || [id, id, "", ""];
    source = {
      id,
      name: labels[0],
      sourceName: labels[1],
      url: labels[3] || "",
      description: labels[2] || "",
      intervalMinutes: intervalMinutesForSource(id),
      state: {}
    };
    manifest.sources.push(source);
  }
  source.state = {
    ...(source.state || {}),
    status: detail.status || "ok",
    message: detail.message || "Static snapshot updated",
    lastSyncAt: detail.fetchedAt || now,
    detail: {
      ...((source.state || {}).detail || {}),
      ...omitStateFields(detail)
    }
  };
}

function omitStateFields(detail) {
  const { status, message, ...rest } = detail || {};
  return rest;
}

function intervalMinutesForSource(id) {
  for (const config of Object.values(syncSourceConfig)) {
    if (config.ids.includes(id)) {
      return config.minutes;
    }
  }
  return 0;
}

function countForSource(id, counts) {
  if (id === "chapter99") return counts.chapter99Rows || 0;
  if (id === "policyRules") return counts.policyRuleRows || 0;
  if (id === "forcedLabor301") return counts.forcedLabor301Rows || 0;
  if (id === "forcedLaborExemptions") return counts.forcedLaborExemptionCodes || 0;
  if (id === "section122") return counts.section122Rows || 0;
  if (id === "section232") return counts.section232Rows || 0;
  if (id === "cotton") return counts.cottonRows || 0;
  if (id === "adcvdLocal") return counts.adcvdRows || 0;
  if (id === "epaFlags") return counts.epaFlagRows || 0;
  if (id === "fdaFlags") return counts.fdaFlagRows || 0;
  if (id === "translations") return counts.translations || 0;
  return 1;
}

function sourceOrder(id) {
  return ["htsStatus", "chapter99", "policyRules", "forcedLabor301", "forcedLaborExemptions", "section122", "section232", "cotton", "adcvdOfficial", "adcvdLocal", "epaFlags", "fdaFlags", "translations"].indexOf(id);
}

async function startServer() {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "production"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  child.on("exit", (code) => {
    if (code && process.exitCode == null) {
      process.exitCode = code;
    }
  });
  return child;
}

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 60000) {
    try {
      await fetchJson("/api/chapters");
      return;
    } catch {
      await delay(1000);
    }
  }
  throw new Error(`Server did not become ready at ${baseUrl}`);
}

async function fetchJson(route) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { accept: "application/json" }
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${route}: ${text.slice(0, 120)}`);
  }
  if (!response.ok) {
    throw new Error(data.error || `${route} failed with ${response.status}`);
  }
  return data;
}

async function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data)}\n`, "utf8");
}

function getReleaseLabel(release) {
  return release?.description || release?.title || release?.name || "USITC HTS";
}

function getArgValue(name) {
  const index = process.argv.lastIndexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
