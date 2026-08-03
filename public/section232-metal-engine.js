const noAdditionalDutyCodes = new Set([
  "9903.82.01",
  "9903.82.03",
  "9903.82.08",
  "9903.82.11",
  "9903.82.13",
  "9903.82.21",
  "9903.82.24",
  "9903.82.26"
]);

export function selectSection232MetalCandidates(hts, entries = [], generalRateText = "") {
  const normalized = normalizeHtsDigits(hts);
  if (!normalized) {
    return [];
  }

  const directMatches = entries.filter((entry) => {
    const code = normalizeHtsDigits(entry.hts);
    return code && (normalized.startsWith(code) || code.startsWith(normalized));
  });
  if (!directMatches.length) {
    return [];
  }

  const maxLength = Math.max(...directMatches.map((entry) => Math.min(normalizeHtsDigits(entry.hts).length, normalized.length)));
  const seen = new Set();
  const baseRate = parseSimplePercent(generalRateText);
  const candidates = directMatches
    .filter((entry) => Math.min(normalizeHtsDigits(entry.hts).length, normalized.length) === maxLength)
    .filter((entry) => {
      const key = `${entry.chapter99}|${normalizeHtsDigits(entry.hts)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .filter((entry) => !isCountrySpecificSection232(entry))
    .filter((entry) => isRateBranchCompatible(entry.chapter99, baseRate))
    .map((entry) => ({
      entry,
      rank: rankSection232Match(entry, baseRate),
      rate: getSection232AdditionalRate(entry.chapter99, baseRate)
    }))
    .sort((a, b) => b.rank - a.rank
      || normalizeHtsDigits(b.entry.hts).length - normalizeHtsDigits(a.entry.hts).length
      || a.entry.chapter99.localeCompare(b.entry.chapter99));

  const preferredIndex = candidates.findIndex((candidate) => candidate.rank > 0);
  return candidates.map((candidate, index) => ({
    ...candidate,
    autoApply: index === preferredIndex
      && candidate.rank > 0
      && !noAdditionalDutyCodes.has(candidate.entry.chapter99)
  }));
}

export function describeSection232Condition(code, baseRateText = "") {
  const baseRate = parseSimplePercent(baseRateText);
  const baseLabel = baseRate == null ? "普通税率待确认" : `普通税率 ${formatRate(baseRate)}%`;
  const descriptions = {
    "9903.82.01": {
      label: "232-不含适用金属",
      summary: "商品不含适用的铝、钢或铜，232 附加税为 0%。",
      note: "须有产品材质资料支持，不应仅凭 HTS 自动判断。"
    },
    "9903.82.03": {
      label: "232-金属重量低于15%",
      summary: "第72、73、74、76章以外商品，如适用金属重量低于整件重量的 15%，232 附加税为 0%。",
      note: "申报时须报告适用金属总重量；达到或超过 15% 时应改用其他适用分支。"
    },
    "9903.82.07": {
      label: "232-美国金属来源条件",
      summary: `${baseLabel}，且至少 85% 的适用钢/铝满足美国熔炼、浇铸或铸造条件时，使普通税率与本项合计达到 10%。`,
      note: "这是有条件候选项，不因 HTS 命中而自动成立；须核对钢材 melt-and-pour 或铝材 smelt-and-cast 证明。"
    },
    "9903.82.08": {
      label: "232-美国金属来源条件",
      summary: "满足美国金属来源条件且普通税率不低于 10% 时，本项不另加税。",
      note: "须核对钢材 melt-and-pour 或铝材 smelt-and-cast 证明。"
    },
    "9903.82.09": {
      label: "232-金属衍生品",
      summary: "适用于美国注释16(c)(vi)-(viii)及(xi)范围的铜、铝或钢铁衍生品，附加税 25%。",
      note: "须以官方清单所属分项和实际材质确认；不能把相邻分项清单误挂到本税号。"
    },
    "9903.82.10": {
      label: "232-钢铝衍生品",
      summary: `${baseLabel}，未满足美国金属来源门槛且普通税率低于 15% 时，使普通税率与本项合计达到 15%。`,
      note: "当前按中国原产、金属重量不低于 15% 且未满足美国金属来源门槛的常见情形估算；须用材质比例及熔炼/浇铸来源资料复核。"
    },
    "9903.82.11": {
      label: "232-钢铝衍生品",
      summary: "未满足美国金属来源门槛且普通税率不低于 15% 时，本项不另加税。",
      note: "仍须确认商品属于美国注释16(c)(ix)-(x)及(f)范围。"
    }
  };
  return descriptions[code] || {
    label: "232-金属加征",
    summary: `命中 CBP Metals HTS List 的条件分支 ${code}。`,
    note: "须结合材质比例、金属来源、原产国和普通税率确认实际适用分支。"
  };
}

function isRateBranchCompatible(code, baseRate) {
  if (baseRate == null) {
    return !["9903.82.08", "9903.82.11"].includes(code);
  }
  if (code === "9903.82.07") return baseRate < 10;
  if (code === "9903.82.08") return baseRate >= 10;
  if (code === "9903.82.10") return baseRate < 15;
  if (code === "9903.82.11") return baseRate >= 15;
  return true;
}

function rankSection232Match(entry) {
  const ranks = new Map([
    ["9903.82.02", 100],
    ["9903.82.09", 95],
    ["9903.82.10", 90],
    ["9903.82.11", 90],
    ["9903.82.06", 85],
    ["9903.82.07", 80],
    ["9903.82.08", 80],
    ["9903.82.03", 10],
    ["9903.82.13", 5]
  ]);
  return ranks.get(entry.chapter99) ?? 50;
}

function getSection232AdditionalRate(code, baseRate) {
  if (noAdditionalDutyCodes.has(code)) {
    return 0;
  }
  if (code === "9903.82.07" && baseRate != null) {
    return Math.max(0, roundRate(10 - baseRate));
  }
  if (code === "9903.82.10" && baseRate != null) {
    return Math.max(0, roundRate(15 - baseRate));
  }
  return null;
}

function isCountrySpecificSection232(entry) {
  if (["9903.82.04", "9903.82.05", "9903.82.12", "9903.82.14", "9903.82.15", "9903.82.16", "9903.82.17", "9903.85.67", "9903.85.68"].includes(entry.chapter99)) {
    return true;
  }
  const text = `${entry.chapter99 || ""} ${entry.context || ""}`.toLowerCase();
  return /united kingdom|russia|russian|belarus|cuba|north korea|argentina|australia|brazil|canada|mexico|general note 3\(b\)/i.test(text);
}

function parseSimplePercent(value) {
  if (/^\s*free\s*$/i.test(String(value || ""))) {
    return 0;
  }
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function normalizeHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function roundRate(rate) {
  return Math.round((rate + Number.EPSILON) * 10000) / 10000;
}

function formatRate(rate) {
  return String(roundRate(rate)).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}
