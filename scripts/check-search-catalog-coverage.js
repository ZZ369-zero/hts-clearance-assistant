import { readFileSync } from "node:fs";
import { chineseSearchCatalog, isMaterialCatalogEntry } from "../public/search-catalog.js";
import { buildChineseSearchPlan } from "../public/chinese-search-helper.js";
import {
  buildClassificationCandidates,
  expandHtsPrefixRows,
  getPreferredDescriptionZh,
  isUsableChineseDescription
} from "../public/description-helper.js";
import { chapterTitleCatalog, getChapterTitle } from "../public/chapter-titles.js";

const probeTerms = [
  "生物制品",
  "X 光/辐射设备",
  "纸",
  "热敏纸",
  "药品",
  "医疗器械",
  "电子产品",
  "集成电路",
  "电路板",
  "传感器",
  "智能手表",
  "LED显示屏",
  "内衣",
  "连衣裙",
  "地毯",
  "建材",
  "瓷砖",
  "钢管",
  "铝型材",
  "五金件",
  "摩托车",
  "刹车片",
  "面膜",
  "洗衣液",
  "农产品",
  "蔬菜",
  "水果",
  "坚果",
  "食用油",
  "调味品",
  "海鲜",
  "鸡肉",
  "机械",
  "发电机",
  "过滤器",
  "模具",
  "空气净化器",
  "医用耗材",
  "医用手套",
  "轮椅",
  "婴儿用品",
  "奶瓶",
  "化学品",
  "化肥",
  "涂料",
  "胶粘剂",
  "塑料袋",
  "塑料瓶",
  "胶带",
  "纸巾",
  "标签",
  "印刷品"
];

const failures = [];
const rows = probeTerms.map((query) => {
  const matches = matchCatalogEntries(query);
  if (!matches.length) {
    failures.push(query);
  }
  return {
    query,
    matchedTerms: matches.flatMap((entry) => entry.matchedTerms).join(" / "),
    queries: matches.flatMap((entry) => entry.queries).slice(0, 3).join(" / "),
    chapters: [...new Set(matches.flatMap((entry) => entry.chapters || []))].join(",")
  };
});

console.table(rows);

if (failures.length) {
  console.error(`Missing search catalog coverage: ${failures.join(", ")}`);
  process.exitCode = 1;
}

const compoundPlan = buildChineseSearchPlan("塑料玩具");
assert(compoundPlan.productLabels.includes("玩具"), "塑料玩具应保留玩具品类匹配");
assert(compoundPlan.materialLabels.includes("塑料"), "塑料玩具应保留塑料材质匹配");
assert(compoundPlan.relatedTerms.includes("statuettes"), "塑料玩具应包含关联商品候选词");
assert(compoundPlan.prefixBoosts.includes("9503"), "塑料玩具应优先 9503");

const translatedPlan = buildChineseSearchPlan("工业用液体分配装置", {
  translatedQuery: "industrial liquid dispensing apparatus"
});
assert(
  translatedPlan.translatedTerms.includes("industrial liquid dispensing apparatus"),
  "未收录中文品名应接受自动英译后的全品类检索词"
);

const hierarchy = buildClassificationCandidates([
  {
    htsno: "1704",
    indent: 0,
    description: "Sugar confectionery (including white chocolate), not containing cocoa:",
    descriptionZh: "糖果 (包括白色巧克力)，not 含有 cocoa："
  },
  {
    htsno: "1704.90",
    indent: 1,
    description: "Other:",
    descriptionZh: "其他："
  },
  {
    htsno: "1704.90.52.00",
    indent: 3,
    description: "Described in general note 15 of the tariff schedule and entered pursuant to its provisions",
    descriptionZh: "总注释所述 15 税则及根据其规定申报"
  }
]).at(-1).row;
assert(hierarchy.classificationPath.length === 2, "1704905200 应生成两级上级商品描述");
assert(
  getPreferredDescriptionZh(hierarchy).includes("总注释15"),
  "1704905200 应使用规范中文末级描述"
);
assert(
  !isUsableChineseDescription("糖果 (包括白色巧克力)，not 含有 cocoa："),
  "中英夹杂描述不得作为合格中文展示"
);

const preservedHierarchy = buildClassificationCandidates([
  {
    htsno: "4016.99.30.00",
    indent: 4,
    description: "Vibration control goods",
    classificationPath: [
      {
        htsno: "4016",
        description: "Other articles of vulcanized rubber other than hard rubber:",
        descriptionZh: "硬质橡胶除外的其他硫化橡胶制品："
      }
    ]
  }
]).at(0).row;
assert(
  preservedHierarchy.classificationPath.at(0)?.htsno === "4016",
  "静态检索索引已保存的官方分类路径不得被扁平索引再次计算覆盖"
);

const chapter85 = JSON.parse(readFileSync(new URL("../public/data/chapters/85.json", import.meta.url), "utf8"));
const sixDigitExpansion = expandHtsPrefixRows(chapter85.value || [], "852491");
const expandedCodes = sixDigitExpansion.rows.map((row) => String(row.htsno || "").replace(/\D/g, ""));
assert(sixDigitExpansion.expanded, "6 位 HTS CODE 应展开下级统计税号");
assert(expandedCodes.includes("8524911000"), "852491 应包含完整税号 8524911000");
assert(expandedCodes.includes("8524919000"), "852491 应包含完整税号 8524919000");
assert(expandedCodes.every((code) => code.length === 10), "父级编码展开结果必须全部为 10 位 HTS CODE");

assert(chapterTitleCatalog.length === 98, "HTS 章节目录应包含除第77章外的 98 个有效章节");
assert(!chapterTitleCatalog.some(([code]) => code === "77"), "HTS 章节目录不应包含保留的第77章");
for (const [code, titleZh, titleEn] of chapterTitleCatalog) {
  assert(Boolean(titleZh && titleEn), `第${code}章必须同时包含中英文标题`);
}
const chapter85Title = getChapterTitle("85");
assert(chapter85Title.titleZh === "电机、电气设备及其零件", "第85章应显示规范中文标题");
assert(chapter85Title.titleEn === "Electrical machinery and equipment", "第85章应保留英文标题");

function matchCatalogEntries(query) {
  const normalizedQuery = normalizeSearchText(query);
  const matches = chineseSearchCatalog
    .map((entry) => ({
      ...entry,
      matchedTerms: entry.terms.filter((term) => normalizedQuery.includes(normalizeSearchText(term)))
    }))
    .filter((entry) => entry.matchedTerms.length)
    .sort((a, b) => longestTermLength(b.matchedTerms) - longestTermLength(a.matchedTerms));

  const maxMatchedLength = Math.max(0, ...matches.flatMap((entry) => entry.matchedTerms).map((term) => [...term].length));
  const focusedMatches = maxMatchedLength > 1
    ? matches.filter((entry) => longestTermLength(entry.matchedTerms) > 1)
    : matches;
  const hasProductMatch = focusedMatches.some((entry) => !isMaterialCatalogEntry(entry));
  const nonMaterialMatches = hasProductMatch
    ? focusedMatches.filter((entry) => !isMaterialCatalogEntry(entry))
    : focusedMatches;
  const maxPrimaryLength = Math.max(0, ...nonMaterialMatches.map((entry) => longestTermLength(entry.matchedTerms)));
  return maxPrimaryLength > 1
    ? nonMaterialMatches.filter((entry) => longestTermLength(entry.matchedTerms) === maxPrimaryLength)
    : nonMaterialMatches;
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[，。；：、（）【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function longestTermLength(terms) {
  return Math.max(0, ...terms.map((term) => [...String(term || "")].length));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Search/description sentinel failed: ${message}`);
    process.exitCode = 1;
  }
}
