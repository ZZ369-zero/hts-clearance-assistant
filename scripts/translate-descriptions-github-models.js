import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildClassificationCandidates,
  isUsableChineseDescription
} from "../public/description-helper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "public", "data");
const chaptersDir = path.join(dataDir, "chapters");
const translationsPath = path.join(dataDir, "translations.json");
const manifestPath = path.join(dataDir, "manifest.json");
const dryRun = process.argv.includes("--dry-run");
const token = process.env.GITHUB_TOKEN || "";
const model = process.env.GITHUB_MODELS_MODEL || "openai/gpt-4o-mini";
const batchLimit = positiveInteger(process.env.TRANSLATION_BATCH_LIMIT, 2000);
const batchSize = Math.min(40, positiveInteger(process.env.TRANSLATION_BATCH_SIZE, 20));
const now = new Date().toISOString();

const manifest = await readJson(manifestPath, { chapters: [], sources: [], counts: {} });
const cache = await readJson(translationsPath, { values: {}, coverage: {} });
const rows = [];

for (const [chapter] of manifest.chapters || []) {
  const data = await readJson(path.join(chaptersDir, `${chapter}.json`), { value: [] });
  rows.push(...buildClassificationCandidates(data.value || []).map(({ row }) => row));
}

const descriptions = new Map();
for (const row of rows) {
  const description = String(row.description || "").trim();
  if (!description || descriptions.has(description)) {
    continue;
  }
  descriptions.set(description, {
    description,
    htsno: String(row.htsno || ""),
    parent: String(row.classificationPath?.at(-1)?.description || "")
  });
}

const values = Object.fromEntries(
  Object.entries(cache.values || {})
    .filter(([description, translation]) =>
      descriptions.has(description) && isUsableChineseDescription(translation)
    )
);
const methods = Object.fromEntries(
  Object.keys(values).map((description) => [
    description,
    cache.methods?.[description] || "local-glossary"
  ])
);
const attempts = Object.fromEntries(
  Object.entries(cache.attempts || {})
    .filter(([description, count]) => descriptions.has(description) && Number(count) > 0)
);
const pending = [...descriptions.values()]
  .filter(({ description }) => !isCalibratedMethod(methods[description]))
  .sort((left, right) =>
    Number(attempts[left.description] || 0) - Number(attempts[right.description] || 0)
      || left.description.localeCompare(right.description)
  )
  .slice(0, batchLimit);
const calibratedBefore = Object.values(methods).filter(isCalibratedMethod).length;

console.log(JSON.stringify({
  model,
  totalDescriptions: descriptions.size,
  publishedDescriptions: Object.keys(values).length,
  calibratedDescriptions: calibratedBefore,
  pendingCalibration: descriptions.size - calibratedBefore,
  selectedForThisRun: pending.length,
  dryRun
}));

if (dryRun || !pending.length) {
  process.exit(0);
}
if (!token) {
  throw new Error("GITHUB_TOKEN is required for GitHub Models translation.");
}

let accepted = 0;
let rejected = 0;
for (let offset = 0; offset < pending.length; offset += batchSize) {
  const batch = pending.slice(offset, offset + batchSize);
  let translated;
  try {
    translated = await translateBatch(batch);
  } catch (error) {
    rejected += batch.length;
    for (const item of batch) {
      attempts[item.description] = Number(attempts[item.description] || 0) + 1;
    }
    console.warn(`Batch ${offset / batchSize + 1} deferred: ${error.message}`);
    await delay(4000);
    continue;
  }
  for (const item of batch) {
    const raw = translated.get(item.description) || "";
    const normalized = normalizeTariffTranslation(item.description, raw);
    if (passesAutomaticChecks(item.description, normalized)) {
      values[item.description] = normalized;
      methods[item.description] = "github-models";
      delete attempts[item.description];
      accepted += 1;
    } else {
      attempts[item.description] = Number(attempts[item.description] || 0) + 1;
      rejected += 1;
    }
  }
  console.log(`Translated ${Math.min(offset + batch.length, pending.length)}/${pending.length}; accepted=${accepted}; rejected=${rejected}`);
  await delay(750);
}

const coveredRows = rows.filter((row) => values[String(row.description || "").trim()]).length;
const sortedValues = Object.fromEntries(
  Object.entries(values).sort(([left], [right]) => left.localeCompare(right))
);
const sortedMethods = Object.fromEntries(
  Object.keys(sortedValues).map((description) => [
    description,
    methods[description] || "local-glossary"
  ])
);
const sortedAttempts = Object.fromEntries(
  Object.entries(attempts)
    .filter(([description, count]) => descriptions.has(description) && Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right))
);
const calibratedDescriptions = Object.values(sortedMethods).filter(isCalibratedMethod).length;
const updatedCache = {
  ...cache,
  generatedAt: now,
  reviewMethod: "GitHub Models translation + HTS terminology, Chinese-content and numeric consistency checks",
  coverage: {
    totalRows: rows.length,
    coveredRows,
    totalDescriptions: descriptions.size,
    cachedDescriptions: Object.keys(sortedValues).length,
    pendingDescriptions: Math.max(0, descriptions.size - Object.keys(sortedValues).length),
    calibratedDescriptions,
    pendingCalibration: Math.max(0, descriptions.size - calibratedDescriptions),
    acceptedThisRun: accepted,
    rejectedThisRun: rejected
  },
  values: sortedValues,
  methods: sortedMethods,
  attempts: sortedAttempts
};
await writeJson(translationsPath, updatedCache);

manifest.counts = {
  ...(manifest.counts || {}),
  translations: Object.keys(sortedValues).length
};
const translationSource = (manifest.sources || []).find((source) => source.id === "translations");
if (translationSource) {
  translationSource.name = "商品中文描述缓存";
  translationSource.sourceName = "GitHub Models + HTS术语校准";
  translationSource.description = "自动生成、术语统一并通过数字及中文质量校验的商品描述静态缓存。";
  translationSource.state = {
    ...(translationSource.state || {}),
    status: rejected ? "warning" : "ok",
    message: rejected
      ? `${accepted} 条通过，${rejected} 条转入下次重译`
      : `${accepted} 条自动校准完成`,
    lastSyncAt: now,
    detail: {
      count: Object.keys(sortedValues).length,
      totalDescriptions: descriptions.size,
      pendingDescriptions: updatedCache.coverage.pendingDescriptions,
      calibratedDescriptions,
      pendingCalibration: updatedCache.coverage.pendingCalibration,
      acceptedThisRun: accepted,
      rejectedThisRun: rejected,
      model,
      fetchedAt: now
    }
  };
}
await writeJson(manifestPath, manifest);

async function translateBatch(items) {
  const numbered = items.map((item, index) => ({
    id: String(index),
    hts: item.htsno,
    parent: item.parent,
    en: item.description
  }));
  const response = await requestModel({
    model,
    temperature: 0,
    max_tokens: 6000,
    messages: [
      {
        role: "system",
        content: [
          "You translate official U.S. Harmonized Tariff Schedule classification fragments into concise Simplified Chinese.",
          "Preserve every number, decimal, currency amount, percentage, HTS reference, exclusion, comparison boundary and colon.",
          "Use customs terminology: electric motor=电动机; generator=发电机; generating set=发电机组; AC=交流; DC=直流; output=输出功率; W=瓦; kW=千瓦; brushless=无刷式.",
          "Do not explain, infer, omit, merge or add legal meaning.",
          "Return JSON only as {\"translations\":[{\"id\":\"0\",\"zh\":\"...\"}]} with exactly one result for each input id."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({ items: numbered })
      }
    ]
  });
  const parsed = parseModelJson(response);
  const result = new Map();
  for (const entry of parsed.translations || []) {
    const index = Number(entry.id);
    if (Number.isInteger(index) && items[index]) {
      result.set(items[index].description, String(entry.zh || "").trim());
    }
  }
  return result;
}

async function requestModel(payload) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch("https://models.github.ai/inference/chat/completions", {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2026-03-10"
      },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      const data = await response.json();
      return String(data.choices?.[0]?.message?.content || "");
    }
    const detail = await response.text();
    lastError = new Error(`GitHub Models request failed (${response.status}): ${detail.slice(0, 500)}`);
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
      throw lastError;
    }
    await delay(attempt * 4000);
  }
  throw lastError;
}

function parseModelJson(value) {
  const text = String(value || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(text);
}

function normalizeTariffTranslation(english, translation) {
  let value = String(translation || "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/克瓦/g, "千瓦")
    .replace(/发电机组（不包括发电机组）/g, "发电机（不包括发电机组）")
    .replace(/无刷子/g, "无刷式")
    .replace(/\bAC\b/gi, "交流")
    .replace(/\bDC\b/gi, "直流")
    .replace(/\bkW\b/gi, "千瓦")
    .replace(/\bW\b/g, "瓦")
    .trim();

  if (/:\s*$/.test(english) && !/[：:]\s*$/.test(value)) {
    value += "：";
  }
  return value.replace(/:$/, "：");
}

function passesAutomaticChecks(english, translation) {
  if (!isUsableChineseDescription(translation)) {
    return false;
  }
  const sourceNumbers = english.match(/\d+(?:\.\d+)?/g) || [];
  const targetNumbers = translation.match(/\d+(?:\.\d+)?/g) || [];
  return sourceNumbers.every((number) => targetNumbers.includes(number));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isCalibratedMethod(method) {
  return method === "curated" || method === "github-models";
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value), "utf8");
}
