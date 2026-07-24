import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const dataDir = path.join(publicDir, "data");
const chaptersDir = path.join(dataDir, "chapters");
const port = Number(process.env.STATIC_EXPORT_PORT || 4183);
const baseUrl = process.env.STATIC_EXPORT_BASE_URL || `http://127.0.0.1:${port}`;
const scope = getArgValue("--scope") || process.env.STATIC_EXPORT_SCOPE || "all";
const now = new Date().toISOString();
const forcedLabor301SourceUrl =
  "https://ustr.gov/sites/default/files/files/Press/Releases/2026/FLIP%20301%20Investigation%20Final%20Action%20FRN%207-23-26%20FINAL.pdf";

const forcedLabor301Snapshot = {
  generatedAt: now,
  sourceName: "USTR Section 301 Forced Labor Final Action",
  sourceUrl: forcedLabor301SourceUrl,
  effectiveFrom: "2026-07-24T04:01:00.000Z",
  country: "China",
  rate: 12.5,
  chapter99Rows: [
    {
      htsno: "9903.05.31",
      statisticalSuffix: "",
      description: "Except for products described in headings 9903.05.85-9903.05.92, articles the product of China, as provided for in U.S. note 52 to this subchapter",
      descriptionEn: "Except for products described in headings 9903.05.85-9903.05.92, articles the product of China, as provided for in U.S. note 52 to this subchapter",
      descriptionZh: "除 9903.05.85-9903.05.92 所列产品外，中国原产商品按美国注释 52 适用新301强迫劳动附加税。",
      indent: 0,
      units: [],
      general: "The duty provided in the applicable subheading + 12.5%",
      special: "The duty provided in the applicable subheading + 12.5%",
      other: "The duty provided in the applicable subheading + 12.5%",
      additionalDuties: "",
      additionalDutyCodes: [],
      quotaQuantity: "",
      effectivePeriod: "Effective for covered goods entered for consumption on or after 2026-07-24 00:01 EDT.",
      footnotes: [],
      superior: false,
      unique: false,
      status: "",
      sourceName: "USTR Section 301 Forced Labor Final Action",
      sourceUrl: forcedLabor301SourceUrl
    }
  ]
};

const syncSourceConfig = {
  hts: {
    ids: ["htsStatus", "chapter99"],
    minutes: 60
  },
  forcedLabor301: {
    ids: ["forcedLabor301"],
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
  translations: {
    ids: ["translations"],
    minutes: 10080
  }
};

const sourceLabels = {
  htsStatus: ["USITC HTS version", "USITC HTS", "Official HTS release and revision information.", "https://hts.usitc.gov/"],
  chapter99: ["Chapter 99 additional duties", "USITC HTS Chapter 99", "301, 122, 232 and other Chapter 99 rows.", "https://hts.usitc.gov/reststop/exportList?from=9900&to=9999&format=JSON&styles=false"],
  forcedLabor301: ["New 301 forced labor duty", "USTR Section 301 Forced Labor Final Action", "Supplemental 9903.05.31 rule while USITC Chapter 99 catches up.", forcedLabor301SourceUrl],
  section122: ["122 Annex II exclusions", "White House Section 122 Annex II", "Section 122 Annex II HTS exclusion prefixes used to avoid applying 9903.03.01 to excluded goods.", "https://www.whitehouse.gov/wp-content/uploads/2026/02/2026Section122.prc_.ANNEX2_.Final_.pdf"],
  section232: ["232 Metals HTS List", "CBP / GovDelivery Metals HTS List", "CBP Metals HTS List discovery and parsed entries.", "https://www.cbp.gov/trade/programs-administration/trade-remedies"],
  cotton: ["Cotton Import Assessment", "eCFR 7 CFR 1205", "Cotton import assessment table.", "https://www.ecfr.gov/current/title-7/subtitle-B/chapter-XI/part-1205/subpart-ECFR80efc31412f8612"],
  adcvdOfficial: ["AD/CVD official ACCESS", "ITA ACCESS AD/CVD", "Official ACCESS status monitor.", "https://access.trade.gov/adcvd"],
  adcvdLocal: ["AD/CVD HTS match dataset", "Local AD/CVD data snapshot", "HTS match snapshot used by the static site.", "https://access.trade.gov/adcvd"],
  translations: ["Description translation cache", "Generated cache", "Weekly helper cache for bilingual descriptions.", ""]
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
    if (selected.includes("forcedLabor301")) {
      await exportForcedLabor301(manifest);
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
    for (const row of rows) {
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
  const old = await readJsonSafe(path.join(dataDir, "section232.json"), null);
  const data = await fetchJson("/api/static/section-232-index?refresh=1").catch((error) => {
    if (old) {
      console.warn(`Section 232 export failed, keeping previous snapshot: ${error.message}`);
      return old;
    }
    throw error;
  });
  await writeJson(path.join(dataDir, "section232.json"), data);
  manifest.counts = { ...(manifest.counts || {}), section232Rows: data.entries?.length || 0 };
  setSourceState(manifest, "section232", {
    count: data.entries?.length || 0,
    url: data.sourceUrl || data.source?.url,
    effectiveNote: data.effectiveNote,
    fetchedAt: data.fetchedAt || now
  });
}

async function exportForcedLabor301(manifest) {
  console.log("Exporting forced labor Section 301 supplemental rule...");
  const data = {
    ...forcedLabor301Snapshot,
    generatedAt: now
  };
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
  console.log("Writing translation cache placeholder...");
  const old = await readJsonSafe(path.join(dataDir, "translations.json"), { generatedAt: "", values: {} });
  const data = {
    generatedAt: now,
    values: old.values || {}
  };
  await writeJson(path.join(dataDir, "translations.json"), data);
  manifest.counts = { ...(manifest.counts || {}), translations: Object.keys(data.values).length };
  setSourceState(manifest, "translations", { count: Object.keys(data.values).length, fetchedAt: now });
}

function expandScope(value) {
  if (!value || value === "all") {
    return ["hts", "forcedLabor301", "section122", "section232", "cotton", "adcvd", "translations"];
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
      byId.set(id, {
        id,
        name: current.name || labels[0],
        sourceName: current.sourceName || labels[1],
        url: current.url || labels[3] || "",
        description: current.description || labels[2],
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
    status: "ok",
    message: "Static snapshot updated",
    lastSyncAt: detail.fetchedAt || now,
    detail: {
      ...((source.state || {}).detail || {}),
      ...detail
    }
  };
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
  if (id === "forcedLabor301") return counts.forcedLabor301Rows || 0;
  if (id === "section122") return counts.section122Rows || 0;
  if (id === "section232") return counts.section232Rows || 0;
  if (id === "cotton") return counts.cottonRows || 0;
  if (id === "adcvdLocal") return counts.adcvdRows || 0;
  if (id === "translations") return counts.translations || 0;
  return 1;
}

function sourceOrder(id) {
  return ["htsStatus", "chapter99", "forcedLabor301", "section122", "section232", "cotton", "adcvdOfficial", "adcvdLocal", "translations"].indexOf(id);
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
