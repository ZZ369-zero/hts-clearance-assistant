import { chineseSearchCatalog, isMaterialCatalogEntry } from "../public/search-catalog.js";

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
