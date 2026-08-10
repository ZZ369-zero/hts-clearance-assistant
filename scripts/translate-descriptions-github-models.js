import assert from "node:assert/strict";
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
const selfTest = process.argv.includes("--self-test");
const token = process.env.COPILOT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
const provider = "github-copilot-cli";
const copilotDefaultModel = "copilot-default";
const translationModel = process.env.COPILOT_TRANSLATION_MODEL || process.env.COPILOT_MODEL || copilotDefaultModel;
const reviewModel = process.env.COPILOT_REVIEW_MODEL || translationModel;
const copilotCommand = process.env.COPILOT_CLI_PATH || "copilot";
const batchLimit = positiveInteger(process.env.TRANSLATION_BATCH_LIMIT, 2000);
const batchSize = Math.min(40, positiveInteger(process.env.TRANSLATION_BATCH_SIZE, 40));
const qualityCycles = Math.min(3, positiveInteger(process.env.TRANSLATION_QUALITY_CYCLES, 2));
const requestRetries = Math.min(4, positiveInteger(process.env.COPILOT_REQUEST_RETRIES, 3));
const maxAiCredits = Math.max(30, positiveInteger(process.env.COPILOT_MAX_AI_CREDITS, 30));
const now = new Date().toISOString();
const execFileAsync = promisify(execFile);

if (selfTest) {
  runSelfTest();
  process.exit(0);
}

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
    Number(Boolean(values[left.description])) - Number(Boolean(values[right.description]))
      || Number(attempts[left.description] || 0) - Number(attempts[right.description] || 0)
      || left.description.localeCompare(right.description)
  )
  .slice(0, batchLimit);
const calibratedBefore = Object.values(methods).filter(isCalibratedMethod).length;

console.log(JSON.stringify({
  translationModel,
  reviewModel,
  maxAiCredits,
  qualityCycles,
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
let translated = 0;
let reviewed = 0;
let qualityRetries = 0;
for (let offset = 0; offset < pending.length; offset += batchSize) {
  const batch = pending.slice(offset, offset + batchSize);
  let result;
  try {
    result = await translateAndReviewBatch(batch);
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
  translated += result.translated;
  reviewed += result.reviewed;
  qualityRetries += result.qualityRetries;
  for (const item of batch) {
    const finalTranslation = result.accepted.get(item.description) || "";
    if (finalTranslation) {
      values[item.description] = finalTranslation;
      methods[item.description] = `copilot-cli:${translationModel}+review:${reviewModel}`;
      delete attempts[item.description];
      accepted += 1;
    } else {
      attempts[item.description] = Number(attempts[item.description] || 0) + 1;
      rejected += 1;
    }
  }
  console.log(
    `Processed ${Math.min(offset + batch.length, pending.length)}/${pending.length}; `
      + `accepted=${accepted}; rejected=${rejected}; reviewed=${reviewed}; qualityRetries=${qualityRetries}`
  );
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
  reviewMethod: "GitHub Copilot strong-model translation + independent strong-model review + HTS terminology, legal-boundary and numeric consistency checks",
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
    deferredThisRun: deferred,
    translatedThisRun: translated,
    reviewedThisRun: reviewed,
    qualityRetriesThisRun: qualityRetries
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
  translationSource.sourceName = "GitHub Copilot 双强模型自动校准";
  translationSource.description = "强模型翻译、独立强模型复核，并通过数字、范围、术语与法律限定词质量校验的商品描述静态缓存。";
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
      translatedThisRun: translated,
      reviewedThisRun: reviewed,
      qualityRetriesThisRun: qualityRetries,
      provider,
      translationModel,
      reviewModel,
      maxAiCredits,
      qualityCycles,
      fetchedAt: now
    }
  };
}
await writeJson(manifestPath, manifest);

async function translateAndReviewBatch(items) {
  const accepted = new Map();
  let remaining = [...items];
  let translated = 0;
  let reviewed = 0;
  let qualityRetries = 0;

  for (let cycle = 1; cycle <= qualityCycles && remaining.length; cycle += 1) {
    const translations = await translateBatch(remaining, cycle);
    translated += translations.size;

    const candidates = remaining
      .map((item) => ({
        item,
        zh: normalizeTariffTranslation(item.description, translations.get(item.description) || "")
      }))
      .filter(({ zh }) => zh);

    if (!candidates.length) {
      qualityRetries += remaining.length;
      continue;
    }

    const reviews = await reviewBatch(candidates, cycle);
    reviewed += reviews.size;

    const retry = [];
    for (const candidate of candidates) {
      const review = reviews.get(candidate.item.description);
      const reviewedTranslation = normalizeTariffTranslation(
        candidate.item.description,
        review?.zh || candidate.zh
      );
      const failures = automaticCheckFailures(candidate.item.description, reviewedTranslation);

      if (review?.approved === true && !failures.length) {
        accepted.set(candidate.item.description, reviewedTranslation);
      } else {
        retry.push(candidate.item);
      }
    }

    const missingReview = remaining.filter((item) =>
      !accepted.has(item.description) && !retry.some((candidate) => candidate.description === item.description)
    );
    retry.push(...missingReview);
    qualityRetries += retry.length;
    remaining = retry;

    if (remaining.length && cycle < qualityCycles) {
      await delay(cycle * 2000);
    }
  }

  return {
    accepted,
    translated,
    reviewed,
    qualityRetries
  };
}

async function translateBatch(items, cycle) {
  const numbered = items.map((item, index) => ({
    id: String(index),
    hts: item.htsno,
    parent: item.parent,
    en: item.description
  }));
  const parsed = await requestStructuredModel([
    "Act as a senior Chinese customs tariff translator.",
    "Translate official U.S. Harmonized Tariff Schedule classification fragments into precise Simplified Chinese, not marketing copy.",
    "Use each item's HTS number and parent description only to resolve classification context; translate only its en field.",
    `This is quality cycle ${cycle} of ${qualityCycles}. Return a fresh careful translation for every item.`,
    "Preserve every number, decimal, currency amount, percentage, HTS reference, material, use, exclusion, comparison boundary and trailing colon.",
    "Required terminology: electric motor=电动机; generator=发电机; generating set=发电机组; AC=交流; DC=直流; output=输出功率; W=瓦; kW=千瓦; parts=零件; accessories=附件; other=其他; whether or not=不论是否; excluding=不包括; provided for in=归入; not elsewhere specified or included=未列名或未包括.",
    "Do not explain, infer, omit, merge, summarize or add legal meaning. Do not leave English prose in zh.",
    "Return JSON only as {\"translations\":[{\"id\":\"0\",\"zh\":\"...\"}]} with exactly one result for every input id.",
    `INPUT_JSON=${JSON.stringify({ items: numbered })}`
  ].join("\n"), translationModel, (value) =>
    validateExactEntries(value, "translations", numbered.map((item) => item.id), ["zh"])
  );
  const result = new Map();
  for (const entry of parsed.translations || []) {
    const index = Number(entry.id);
    if (Number.isInteger(index) && items[index]) {
      result.set(items[index].description, String(entry.zh || "").trim());
    }
  }
  return result;
}

async function reviewBatch(candidates, cycle) {
  const numbered = candidates.map((candidate, index) => ({
    id: String(index),
    hts: candidate.item.htsno,
    parent: candidate.item.parent,
    en: candidate.item.description,
    candidateZh: candidate.zh
  }));
  const parsed = await requestStructuredModel([
    "Act as an independent senior HTS bilingual reviewer.",
    "Review each Chinese candidate against the English HTS classification fragment and parent context.",
    "Approve only if the final Chinese is exact, complete, legally faithful and fluent Simplified Chinese.",
    "If the candidate omits or adds meaning, mistranslates material/use/range/negation, leaves English prose, or loses numbers, return approved=false and provide a corrected zh.",
    "Keep every number, decimal, currency amount, percentage, HTS reference, material, use, exclusion, comparison boundary and trailing colon.",
    "Return JSON only as {\"reviews\":[{\"id\":\"0\",\"approved\":true,\"zh\":\"...\",\"issues\":[]}]} with exactly one result for every input id.",
    `This is quality cycle ${cycle} of ${qualityCycles}.`,
    `INPUT_JSON=${JSON.stringify({ items: numbered })}`
  ].join("\n"), reviewModel, (value) => {
    const entries = validateExactEntries(value, "reviews", numbered.map((item) => item.id), ["zh"]);
    for (const entry of entries) {
      if (typeof entry.approved !== "boolean") {
        throw new Error(`Review entry ${entry.id} is missing boolean approved.`);
      }
      if (entry.issues !== undefined && !Array.isArray(entry.issues)) {
        throw new Error(`Review entry ${entry.id} has non-array issues.`);
      }
    }
    return entries;
  });

  const result = new Map();
  for (const entry of parsed.reviews || []) {
    const index = Number(entry.id);
    if (Number.isInteger(index) && candidates[index]) {
      result.set(candidates[index].item.description, {
        approved: entry.approved === true,
        zh: String(entry.zh || "").trim(),
        issues: Array.isArray(entry.issues) ? entry.issues : []
      });
    }
  }
  return result;
}

async function requestStructuredModel(prompt, modelName, validate) {
  let lastError;
  for (let attempt = 1; attempt <= requestRetries; attempt += 1) {
    try {
      const response = await invokeCopilot(prompt, modelName);
      const parsed = parseModelJson(response);
      validate(parsed);
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isProviderUnavailableError(lastError)) {
        throw lastError;
      }
    }
    await delay(attempt * 4000);
  }
  throw lastError;
}

async function invokeCopilot(prompt, modelName) {
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
      `--max-ai-credits=${maxAiCredits}`,
      ...modelCliArgs(modelName)
    ], {
      env: {
        ...process.env,
        COPILOT_GITHUB_TOKEN: token
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 240000,
      windowsHide: true
    });
    if (!String(stdout || "").trim()) {
      throw new Error("Copilot CLI returned an empty response.");
    }
    return String(stdout);
  } catch (error) {
    const detail = [error?.stderr, error?.stdout, `exit=${error?.code || "unknown"}`]
      .filter(Boolean)
      .join(" ");
    throw new Error(`Copilot CLI request failed: ${stripAnsi(detail || "unknown error").slice(0, 1000)}`);
  }
}

function parseModelJson(value) {
  const text = stripAnsi(String(value || "")).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }
  if (text.startsWith("{")) {
    return JSON.parse(text);
  }
  const object = extractFirstJsonObject(text);
  if (!object) {
    throw new Error("Model response did not contain a JSON object.");
  }
  return JSON.parse(object);
}

function extractFirstJsonObject(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return "";
}

function validateExactEntries(parsed, key, expectedIds, requiredStringFields = []) {
  const entries = parsed?.[key];
  if (!Array.isArray(entries)) {
    throw new Error(`Model response is missing ${key} array.`);
  }

  const expected = new Set(expectedIds.map(String));
  const seen = new Set();
  for (const entry of entries) {
    const id = String(entry?.id ?? "");
    if (!expected.has(id)) {
      throw new Error(`Model response returned unexpected id ${id}.`);
    }
    if (seen.has(id)) {
      throw new Error(`Model response returned duplicate id ${id}.`);
    }
    seen.add(id);
    for (const field of requiredStringFields) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) {
        throw new Error(`Model response entry ${id} is missing string field ${field}.`);
      }
    }
  }

  if (seen.size !== expected.size) {
    const missing = [...expected].filter((id) => !seen.has(id));
    throw new Error(`Model response is missing ids: ${missing.join(",")}.`);
  }
  return entries;
}

function stripAnsi(value) {
  return String(value || "").replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function modelCliArgs(modelName) {
  return modelName && modelName !== copilotDefaultModel ? [`--model=${modelName}`] : [];
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

function automaticCheckFailures(english, translation) {
  const failures = [];
  if (!isUsableChineseDescription(translation)) {
    failures.push("unusable-chinese");
  }
  const sourceNumbers = extractNumericTokens(english);
  const targetNumbers = extractNumericTokens(translation);
  if (sourceNumbers.join("|") !== targetNumbers.join("|")) {
    failures.push(`numeric-mismatch:${sourceNumbers.join("|")}!=${targetNumbers.join("|")}`);
  }
  const legalBoundaries = [
    ["exclusion", /\b(?:except|excluding|other than)\b/i, /(?:除|不包括|以外)/],
    ["not-exceeding", /\bnot exceeding\b/i, /(?:不超过|不高于)/],
    ["not-over", /\bnot over\b/i, /(?:不超过|不多于)/],
    ["less-than", /\bless than\b/i, /(?:少于|低于|不足)/],
    ["at-least", /\b(?:at least|or more)\b/i, /(?:至少|以上|不少于)/],
    ["whether-or-not", /\bwhether or not\b/i, /(?:不论是否|无论是否|不管是否)/],
    ["without", /\bwithout\b/i, /(?:不含|无|没有)/],
    ["parts", /\bparts?\b/i, /(?:零件|部件|配件)/],
    ["accessories", /\baccessories\b/i, /(?:附件|配件)/]
  ];
  for (const [name, sourcePattern, targetPattern] of legalBoundaries) {
    if (sourcePattern.test(english) && !targetPattern.test(translation)) {
      failures.push(`legal-boundary:${name}`);
    }
  }
  return failures;
}

function passesAutomaticChecks(english, translation) {
  return automaticCheckFailures(english, translation).length === 0;
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

function runSelfTest() {
  assert.equal(
    parseModelJson("note\n```json\n{\"translations\":[{\"id\":\"0\",\"zh\":\"马：\"}]}\n```").translations[0].zh,
    "马："
  );
  assert.equal(
    parseModelJson("prefix {\"reviews\":[{\"id\":\"0\",\"approved\":true,\"zh\":\"其他：\",\"issues\":[]}]} suffix").reviews[0].approved,
    true
  );
  assert.throws(
    () => validateExactEntries({ translations: [{ id: "0", zh: "其他：" }] }, "translations", ["0", "1"], ["zh"]),
    /missing ids/
  );
  assert.equal(
    passesAutomaticChecks("Of an output exceeding 750 W but not exceeding 75 kW:", "输出功率超过750瓦但不超过75千瓦："),
    true
  );
  assert.equal(
    passesAutomaticChecks("Of an output exceeding 750 W but not exceeding 75 kW:", "输出功率超过750瓦："),
    false
  );
  assert.equal(
    normalizeTariffTranslation("Brushless", "无刷子"),
    "无刷式"
  );
  console.log("Translation pipeline self-test passed.");
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
