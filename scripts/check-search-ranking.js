import { readFileSync, readdirSync } from "node:fs";
import { buildChineseSearchPlan } from "../public/chinese-search-helper.js";
import {
  buildClassificationCandidates,
  getPreferredDescriptionZh,
  isUsableChineseDescription
} from "../public/description-helper.js";
import { rankHtsSearchCandidates } from "../public/search-ranking.js";

const translations = readJson("../public/data/translations.json");
const cache = translations.values || {};
const chaptersDirectory = new URL("../public/data/chapters/", import.meta.url);
const candidates = readdirSync(chaptersDirectory)
  .filter((name) => /^\d{2}\.json$/.test(name))
  .sort()
  .flatMap((name) => {
    const chapter = JSON.parse(readFileSync(new URL(name, chaptersDirectory), "utf8"));
    const rows = (chapter.value || []).map((row) => ({
      ...row,
      descriptionZh: getPreferredDescriptionZh(row)
        || (isUsableChineseDescription(cache[row.description]) ? cache[row.description] : "")
    }));
    return buildClassificationCandidates(rows);
  });

const probes = [
  { query: "玩具", prefixes: ["9503"], topCount: 5 },
  { query: "无刷电机", prefixes: ["8501"], topCount: 2 },
  { query: "无人机", prefixes: ["8806"], topCount: 5 },
  { query: "钟表", prefixes: ["9101", "9102", "9103", "9105"], topCount: 5 },
  { query: "棉签", prefixes: ["5601"], topCount: 5 },
  { query: "滴剂", prefixes: ["3003", "3004", "3006"], topCount: 5 },
  { query: "服饰", prefixes: ["61", "62"], topCount: 8 },
  { query: "咖啡机", prefixes: ["8516"], topCount: 4 },
  { query: "鞋", prefixes: ["64"], topCount: 8 }
];

for (const probe of probes) {
  const plan = buildChineseSearchPlan(probe.query);
  const ranked = rankHtsSearchCandidates(candidates, plan, { limit: 20 });
  const top = ranked.slice(0, probe.topCount);
  console.log(
    `${probe.query}:`,
    top.map(({ row }) => `${normalizeHts(row.htsno)}(${row.searchMatch?.tier || "none"})`).join(", ")
  );
  assert(top.length > 0, `${probe.query} 应返回候选编码`);
  assert(
    top.every(({ row }) => normalizeHts(row.htsno).length === 10),
    `${probe.query} 前 ${probe.topCount} 条应优先显示完整 10 位税号`
  );
  assert(
    top.every(({ row }) => probe.prefixes.some((prefix) => normalizeHts(row.htsno).startsWith(prefix))),
    `${probe.query} 前 ${probe.topCount} 条应集中在 ${probe.prefixes.join("/")} 相关归类`
  );
  assert(
    top.every(({ row }) => ["exact", "direct"].includes(row.searchMatch?.tier)),
    `${probe.query} 前 ${probe.topCount} 条不应混入弱关联候选`
  );
}

const toyPlan = buildChineseSearchPlan("塑料玩具");
const toyRanked = rankHtsSearchCandidates(candidates, toyPlan, { limit: 10 });
console.log(
  "塑料玩具:",
  toyRanked.map(({ row }) => `${normalizeHts(row.htsno)}(${row.searchMatch?.reasons?.join("|") || ""})`).join(", ")
);
assert(
  toyRanked.slice(0, 5).every(({ row }) => normalizeHts(row.htsno).startsWith("9503")),
  "塑料玩具前 5 条应保持玩具品类优先，不应被普通塑料制品挤占"
);

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

function normalizeHts(value) {
  return String(value || "").replace(/\D/g, "");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Search ranking sentinel failed: ${message}`);
    process.exitCode = 1;
    throw new Error(message);
  }
}
