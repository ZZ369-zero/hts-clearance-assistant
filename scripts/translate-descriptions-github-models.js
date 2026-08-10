import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
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
const token = process.env.COPILOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
const provider = "github-copilot-cli";
const model = process.env.COPILOT_MODEL || "gpt-5.4";
const copilotCommand = process.env.COPILOT_CLI_PATH || "copilot";
const batchLimit = positiveInteger(process.env.TRANSLATION_BATCH_LIMIT, 2000);
const batchSize = Math.min(40, positiveInteger(process.env.TRANSLATION_BATCH_SIZE, 20));
const now = new Date().toISOString();
const execFileAsync = promisify(execFile);

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
  throw new Error("COPILOT_GITHUB_TOKEN or GITHUB_TOKEN is required for Copilot CLI translation.");
}

let accepted = 0;
let rejected = 0;
let deferred = 0;
for (let offset = 0; offset < pending.length; offset += batchSize) {
  const batch = pending.slice(offset, offset + batchSize);
  let translated;
  try {
    translated = await translateBatch(batch);
  } catch (error) {
    if (isProviderUnavailableError(error)) {
      deferred = pending.length - offset;
      console.warn(`Translation provider unavailable; ${deferred} items deferred: ${error.message}`);
      break;
    }
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
      methods[item.description] = `copilot-cli:${model}`;
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
  reviewMethod: "GitHub Copilot strong-model translation + HTS terminology, legal-boundary and numeric consistency checks",
  coverage: {
    totalRows: rows.length,
    coveredRows,
    totalDescriptions: descriptions.size,
    cachedDescriptions: Object.keys(sortedValues).length,
    pendingDescriptions: Math.max(0, descriptions.size - Object.keys(sortedValues).length),
    calibratedDescriptions,
    pendingCalibration: Math.max(0, descriptions.size - calibratedDescriptions),
    acceptedThisRun: accepted,
    rejectedThisRun: rejected,
    deferredThisRun: deferred
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
  translationSource.sourceName = "GitHub Copilot 强模型 + HTS术语校准";
  translationSource.description = "强模型自动翻译、术语统一并通过数字、范围与法律限定词质量校验的商品描述静态缓存。";
  translationSource.state = {
    ...(translationSource.state || {}),
    status: rejected || deferred ? "warning" : "ok",
    message: deferred
      ? `${accepted} 条通过，${rejected} 条质量校验未通过，${deferred} 条因模型服务不可用延期`
      : rejected
        ? `${accepted} 条通过，${rejected} 条质量校验未通过并转入下次重译`
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
      deferredThisRun: deferred,
      provider,
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
  const response = await requestModel([
    "Act as a senior Chinese customs tariff translator.",
    "Translate official U.S. Harmonized Tariff Schedule classification fragments into precise Simplified Chinese, not marketing copy.",
    "Use each item's HTS number and parent description only to resolve classification context; translate only its en field.",
    "Silently review every result a second time before returning it.",
    "Preserve every number, decimal, currency amount, percentage, HTS reference, material, use, exclusion, comparison boundary and trailing colon.",
    "Required terminology: electric motor=电动机; generator=发电机; generating set=发电机组; AC=交流; DC=直流; output=输出功率; W=瓦; kW=千瓦; parts=零件; accessories=附件; other=其他; whether or not=不论是否; excluding=不包括; provided for in=归入.",
    "Do not explain, infer, omit, merge, summarize or add legal meaning. Do not leave English prose in zh.",
    "Return JSON only as {\"translations\":[{\"id\":\"0\",\"zh\":\"...\"}]} with exactly one result for every input id.",
    `INPUT_JSON=${JSON.stringify({ items: numbered })}`
  ].join("\n"));
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

async function requestModel(prompt) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await execFileAsync(copilotCommand, [
        "--prompt", prompt,
        "--silent",
        "--stream=off",
        "--no-color",
        "--no-ask-user",
        "--no-custom-instructions",
        "--no-auto-update",
        "--no-remote",
        "--no-remote-export",
        "--max-ai-credits=1",
        `--model=${model}`
      ], {
        env: {
          ...process.env,
          COPILOT_GITHUB_TOKEN: token
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 180000,
        windowsHide: true
      });
      if (!String(stdout || "").trim()) {
        throw new Error("Copilot CLI returned an empty response.");
      }
      return String(stdout);
    } catch (error) {
      const detail = [error?.message, error?.stdout, error?.stderr].filter(Boolean).join(" ");
      lastError = new Error(`Copilot CLI request failed: ${detail.slice(0, 1000)}`);
      if (isProviderUnavailableError(lastError)) {
        throw lastError;
      }
    }
    await delay(attempt * 4000);
  }
  throw lastError;
}

function parseModelJson(value) {
  let text = String(value || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      text = text.slice(start, end + 1);
    }
  }
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
  const sourceNumbers = extractNumericTokens(english);
  const targetNumbers = extractNumericTokens(translation);
  if (sourceNumbers.join("|") !== targetNumbers.join("|")) {
    return false;
  }
  const legalBoundaries = [
    [/\b(?:except|excluding|other than)\b/i, /(?:除|不包括|以外)/],
    [/\bnot exceeding\b/i, /(?:不超过|不高于)/],
    [/\bnot over\b/i, /(?:不超过|不多于)/],
    [/\bless than\b/i, /(?:少于|低于|不足)/],
    [/\b(?:at least|or more)\b/i, /(?:至少|以上|不少于)/],
    [/\bwhether or not\b/i, /(?:不论是否|无论是否|不管是否)/],
    [/\bwithout\b/i, /(?:不含|无|没有)/],
    [/\bparts?\b/i, /(?:零件|部件|配件)/],
    [/\baccessories\b/i, /(?:附件|配件)/]
  ];
  return legalBoundaries.every(([sourcePattern, targetPattern]) =>
    !sourcePattern.test(english) || targetPattern.test(translation)
  );
}

function extractNumericTokens(value) {
  return (String(value || "").match(/\d[\d,]*(?:\.\d+)?/g) || [])
    .map((number) => number.replace(/,/g, ""))
    .sort();
}

function isProviderUnavailableError(error) {
  return /(?:401|403|404|410|authentication|authorization|not licensed|not available|billing|budget|quota|copilot requests|model is not supported|command not found|ENOENT)/i
    .test(String(error?.message || error || ""));
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isCalibratedMethod(method) {
  return method === "curated"
    || method === "github-models"
    || String(method || "").startsWith("copilot-cli:");
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
