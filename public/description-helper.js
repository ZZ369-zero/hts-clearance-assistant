const htsDescriptionOverrides = new Map([
  [
    "8443310000",
    "可连接自动数据处理设备或网络，并能执行打印、复印或传真传输中两项或多项功能的机器。"
  ],
  [
    "8524911000",
    "平板显示模组，但第8528.59、8528.69、8528.72及8528.73子目所列平板显示模组除外。"
  ]
]);

const englishDescriptionOverrides = new Map([
  [
    "machines which perform two or more of the functions of printing, copying or facsimile transmission, capable of connecting to an automatic data processing machine or to a network",
    "可连接自动数据处理设备或网络，并能执行打印、复印或传真传输中两项或多项功能的机器。"
  ],
  [
    "flat panel display modules, other than flat panel display modules for articles of subheadings 8528.59, 8528.69, 8528.72 and 8528.73",
    "平板显示模组，但第8528.59、8528.69、8528.72及8528.73子目所列平板显示模组除外。"
  ]
]);

const allowedEnglishTokens = new Set([
  "ad",
  "cif",
  "cfr",
  "dvd",
  "fda",
  "hts",
  "htsus",
  "led",
  "nesoi",
  "rom",
  "usb"
]);

export function normalizeDescriptionHts(value) {
  return String(value || "").replace(/\D/g, "");
}

export function getExactDescriptionZh(row = {}) {
  const hts = normalizeDescriptionHts(row.htsno);
  if (htsDescriptionOverrides.has(hts)) {
    return htsDescriptionOverrides.get(hts);
  }

  const description = normalizeEnglishDescription(row.description || row.descriptionEn);
  return englishDescriptionOverrides.get(description) || "";
}

export function isUsableChineseDescription(value) {
  const text = String(value || "").trim();
  if (!/[\u3400-\u9fff]/.test(text) || /中文(?:释义|辅助)待(?:核|完善)/.test(text)) {
    return false;
  }

  const englishWords = text.match(/[A-Za-z][A-Za-z-]{1,}/g) || [];
  const unexplainedWords = englishWords.filter((word) => !allowedEnglishTokens.has(word.toLowerCase()));
  const chineseCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  return unexplainedWords.length <= 1 && chineseCount >= Math.max(2, unexplainedWords.join("").length);
}

export function getPreferredDescriptionZh(row = {}) {
  const exact = getExactDescriptionZh(row);
  if (exact) {
    return exact;
  }

  const candidate = String(row.descriptionZh || "").trim();
  return isUsableChineseDescription(candidate) ? candidate : "";
}

export function buildClassificationCandidates(rows = []) {
  const stack = [];
  return rows.map((row) => {
    const indent = Number(row.indent || 0);
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const classificationPath = stack.map(({ indent: _indent, ...item }) => ({ ...item }));
    const rowWithContext = {
      ...row,
      classificationPath
    };
    const ownText = `${row.description || ""} ${row.descriptionZh || ""}`;
    const parentText = classificationPath
      .map((item) => `${item.htsno || ""} ${item.description || ""} ${item.descriptionZh || ""}`)
      .join(" ");
    const searchText = `${row.htsno || ""} ${parentText} ${ownText}`;

    if (ownText.trim()) {
      stack.push({
        indent,
        htsno: row.htsno || "",
        description: row.description || "",
        descriptionZh: getPreferredDescriptionZh(row)
      });
    }

    return {
      row: rowWithContext,
      ownText,
      parentText,
      searchText
    };
  });
}

function normalizeEnglishDescription(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[.;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
