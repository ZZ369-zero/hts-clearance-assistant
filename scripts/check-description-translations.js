import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getPreferredDescriptionZh,
  isUsableChineseDescription
} from "../public/description-helper.js";

const knownCases = [
  ["8501", "Electric motors and generators (excluding generating sets):", "电动机和发电机（不包括发电机组）："],
  ["", "Other AC motors, multi-phase:", "其他多相交流电动机："],
  ["8501.52", "Of an output exceeding 750 W but not exceeding 75 kW:", "输出功率超过750瓦但不超过75千瓦："],
  ["8501.52.40.00", "Exceeding 750 W but not exceeding 14.92 kW", "输出功率超过750瓦但不超过14.92千瓦。"],
  ["", "Brushless", "无刷式。"]
];

for (const [htsno, description, expected] of knownCases) {
  assert.equal(getPreferredDescriptionZh({ htsno, description }), expected);
}

assert.equal(isUsableChineseDescription("电机及发生器（不包括 generating 套装）"), false);
assert.equal(isUsableChineseDescription("中文辅助生成中..."), false);
assert.equal(isUsableChineseDescription("马："), true);

const cache = JSON.parse(await readFile(new URL("../public/data/translations.json", import.meta.url), "utf8"));
for (const [description, translation] of Object.entries(cache.values || {})) {
  assert.ok(description, "Translation cache contains an empty English description.");
  assert.ok(
    isUsableChineseDescription(translation),
    `Translation cache contains an unverified value: ${description} -> ${translation}`
  );
  assert.ok(
    ["curated", "github-models", "local-glossary"].includes(cache.methods?.[description])
      || String(cache.methods?.[description] || "").startsWith("copilot-cli:"),
    `Translation cache is missing a valid method: ${description}`
  );
}

console.log(`Description translation checks passed (${Object.keys(cache.values || {}).length} cached descriptions).`);
