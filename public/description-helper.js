const htsDescriptionOverrides = new Map([
  [
    "8443310000",
    "可连接自动数据处理设备或网络，并能执行打印、复印或传真传输中两项或多项功能的机器。"
  ],
  [
    "8524911000",
    "平板显示模组，但第8528.59、8528.69、8528.72及8528.73子目所列平板显示模组除外。"
  ],
  [
    "1704905200",
    "根据《美国协调关税税则》总注释15的描述并按其规定申报的糖食。"
  ],
  [
    "8501",
    "电动机和发电机（不包括发电机组）："
  ],
  [
    "850152",
    "输出功率超过750瓦但不超过75千瓦："
  ],
  [
    "8501524000",
    "输出功率超过750瓦但不超过14.92千瓦。"
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
  ],
  [
    "sugar confectionery (including white chocolate), not containing cocoa",
    "糖食（包括白巧克力），不含可可。"
  ],
  [
    "described in general note 15 of the tariff schedule and entered pursuant to its provisions",
    "根据《美国协调关税税则》总注释15的描述并按其规定申报。"
  ],
  [
    "tricycles, scooters, pedal cars and similar wheeled toys; dollsʼ carriages; dolls, other toys; reduced-scale (“scaleˮ) models and similar recreational models, working or not; puzzles of all kinds; parts and accessories thereof",
    "三轮车、踏板车、脚踏汽车及类似带轮玩具；玩偶车；玩偶及其他玩具；缩小比例模型及类似娱乐模型（无论是否可工作）；各类拼图；以及上述商品的零件和附件。"
  ],
  [
    "under 3 years of age",
    "适用于3岁以下儿童。"
  ],
  [
    "3 to 12 years of age",
    "适用于3至12岁儿童。"
  ],
  [
    "electric motors and generators (excluding generating sets)",
    "电动机和发电机（不包括发电机组）："
  ],
  [
    "other alternating-current motors, multiphase",
    "其他多相交流电动机："
  ],
  [
    "other ac motors, multi-phase",
    "其他多相交流电动机："
  ],
  [
    "other ac motors, single-phase",
    "其他单相交流电动机："
  ],
  [
    "of an output exceeding 750 w but not exceeding 75 kw",
    "输出功率超过750瓦但不超过75千瓦："
  ],
  [
    "exceeding 750 w but not exceeding 14.92 kw",
    "输出功率超过750瓦但不超过14.92千瓦。"
  ],
  [
    "brushless",
    "无刷式。"
  ],
  [
    "electrically operated",
    "电动式："
  ],
  [
    "with opto-electronic display only",
    "仅带光电显示器。"
  ],
  [
    "dairy",
    "乳用："
  ],
  [
    "live bovine animals",
    "活牛科动物："
  ],
  [
    "apparatus",
    "装置"
  ],
  [
    "battery",
    "电池"
  ],
  [
    "movement",
    "机芯"
  ],
  [
    "movement and case",
    "机芯及表壳"
  ],
  [
    "windshield wipers",
    "挡风玻璃雨刮器"
  ],
  [
    "windshields",
    "挡风玻璃"
  ],
  [
    "wild",
    "野生"
  ],
  [
    "wild blueberries",
    "野生蓝莓"
  ],
  [
    "wild rice",
    "野生稻米"
  ],
  [
    "wild rye",
    "野黑麦"
  ],
  [
    "wind turbine hubs",
    "风力涡轮机轮毂"
  ],
  [
    "winding wire",
    "绕组线"
  ],
  [
    "wire",
    "线材"
  ],
  [
    "wire bars",
    "线锭"
  ],
  [
    "wired glass",
    "夹丝玻璃"
  ],
  [
    "wired sheets",
    "夹丝玻璃板"
  ],
  [
    "wirewound",
    "绕线式"
  ],
  [
    "with fittings",
    "带接头"
  ]
]);

const allowedEnglishTokens = new Set([
  "ac",
  "ad",
  "cif",
  "cfr",
  "dc",
  "dvd",
  "fda",
  "hts",
  "htsus",
  "lcd",
  "led",
  "nesoi",
  "oled",
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

export function getDeterministicDescriptionZh(row = {}) {
  const description = String(row.description || row.descriptionEn || "").replace(/\s+/g, " ").trim();
  if (!description || !isChemicalLikeDescription(description)) {
    return "";
  }

  const normalized = description
    .replace(/\bCAS Nos?\.\s*/gi, "CAS号 ")
    .replace(/\bpercent by weight\b/gi, "重量百分比")
    .replace(/\bmore than\b/gi, "超过")
    .replace(/\bover\b/gi, "超过")
    .replace(/\bnot less than\b/gi, "不少于")
    .replace(/\bnot more than\b/gi, "不超过")
    .replace(/\bcontaining\b/gi, "含有")
    .replace(/\bmixtures?\b/gi, "混合物")
    .replace(/\(provided (?:for )?in subn?heading ([\d.]+)\)/gi, "（归入子目 $1）")
    .replace(/\(provided (?:for )?in heading ([\d.]+)\)/gi, "（归入品目 $1）")
    .replace(/\s+([,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return `化学品/专用化合物：${normalized}`;
}

export function isUsableChineseDescription(value) {
  const text = String(value || "").trim();
  if (
    !/[\u3400-\u9fff]/.test(text)
    || /中文(?:释义|辅助|说明)(?:生成中|待(?:核|完善|校核))/.test(text)
    || /\b(?:generating|generator|sets?)\b/i.test(text)
  ) {
    return false;
  }

  const chineseCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  if (isStructuredChemicalChinese(text)) {
    return chineseCount >= 3;
  }

  const englishWords = text.match(/[A-Za-z][A-Za-z-]{1,}/g) || [];
  const unexplainedWords = englishWords.filter((word) => !allowedEnglishTokens.has(word.toLowerCase()));
  return unexplainedWords.length === 0 && chineseCount >= 1;
}

export function getPreferredDescriptionZh(row = {}) {
  const exact = getExactDescriptionZh(row);
  if (exact) {
    return exact;
  }

  const candidate = String(row.descriptionZh || "").trim();
  if (isUsableChineseDescription(candidate)) {
    return candidate;
  }

  return getDeterministicDescriptionZh(row);
}

function isChemicalLikeDescription(description) {
  const text = String(description || "");
  if (/\bCAS\s+Nos?\./i.test(text)) {
    return true;
  }
  const chemicalTerms = text.match(/\b(?:acid|amine|amide|azole|benz|bromo|carbam|chloride|chloro|cyano|diox|ester|ethyl|fluoro|hydroxy|methoxy|methyl|oxide|phenoxy|phenyl|phosph|propyl|sulfate|sulfide|sulfon|thiaz|triazo|yl)\b/gi) || [];
  return chemicalTerms.length >= 2 && /\(provided (?:for )?in subn?heading [\d.]+\)/i.test(text);
}

function isStructuredChemicalChinese(value) {
  return /(?:化学品|化合物|CAS号|归入子目|归入品目)/.test(String(value || ""));
}

export function buildClassificationCandidates(rows = []) {
  const stack = [];
  return rows.map((row) => {
    const indent = Number(row.indent || 0);
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const generatedPath = stack.map(({ indent: _indent, ...item }) => ({ ...item }));
    const classificationPath = Array.isArray(row.classificationPath)
      ? row.classificationPath.map(({ classificationPath: _nestedPath, ...item }) => ({ ...item }))
      : generatedPath;
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

export function expandHtsPrefixRows(rows = [], value, { limit = 300 } = {}) {
  const prefix = normalizeDescriptionHts(value);
  const candidates = buildClassificationCandidates(rows).map((candidate) => candidate.row);
  const exact = candidates.filter((row) => normalizeDescriptionHts(row.htsno) === prefix);
  if (prefix.length >= 10) {
    return {
      rows: exact.slice(0, limit),
      total: exact.length,
      expanded: false,
      truncated: exact.length > limit
    };
  }

  const descendants = candidates.filter((row) => {
    const digits = normalizeDescriptionHts(row.htsno);
    return digits.length === 10 && digits.startsWith(prefix);
  });
  if (descendants.length) {
    return {
      rows: descendants.slice(0, limit),
      total: descendants.length,
      expanded: true,
      truncated: descendants.length > limit
    };
  }

  const fallbackChildren = candidates.filter((row) => {
    const digits = normalizeDescriptionHts(row.htsno);
    return digits.length > prefix.length && digits.startsWith(prefix);
  });
  const deepestLength = Math.max(0, ...fallbackChildren.map((row) => normalizeDescriptionHts(row.htsno).length));
  const fallback = deepestLength
    ? fallbackChildren.filter((row) => normalizeDescriptionHts(row.htsno).length === deepestLength)
    : exact;
  return {
    rows: fallback.slice(0, limit),
    total: fallback.length,
    expanded: fallbackChildren.length > 0,
    truncated: fallback.length > limit
  };
}

function normalizeEnglishDescription(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[.;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
