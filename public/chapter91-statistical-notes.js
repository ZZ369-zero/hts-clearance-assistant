const movement = ["10", "Movement", "机芯", ["No."]];
const caseComponent = ["20", "Case", "表壳", ["No."]];
const strap = ["30", "Strap, band or bracelet", "表带、带或表链", ["No."]];
const battery20 = ["20", "Battery", "电池", ["No."]];
const battery30 = ["30", "Battery", "电池", ["No."]];
const battery40 = ["40", "Battery", "电池", ["No."]];

const statisticalNoteGroups = [
  {
    note: "1(a)",
    subheadings: [
      "9101.11.40", "9101.11.80", "9101.19.40", "9101.19.80",
      "9102.11.10", "9102.11.25", "9102.11.30", "9102.11.45",
      "9102.11.50", "9102.11.65", "9102.11.70", "9102.11.95",
      "9102.19.20", "9102.19.40", "9102.19.60", "9102.19.80"
    ],
    components: [movement, caseComponent, strap, battery40]
  },
  {
    note: "1(b)",
    subheadings: ["9102.91.20", "9104.00.05", "9104.00.10", "9104.00.25", "9104.00.30", "9104.00.45"],
    components: [
      ["10", "Movement and case", "机芯及表壳", ["No. of movements"]],
      battery20
    ]
  },
  {
    note: "1(c)",
    subheadings: [
      "9101.21.50", "9101.29.90", "9101.99.20", "9101.99.40",
      "9101.99.60", "9101.99.80", "9102.29.04", "9102.99.20",
      "9102.99.40", "9102.99.60", "9102.99.80", "9104.00.60",
      "9105.29.10", "9105.29.20", "9105.99.20", "9105.99.30"
    ],
    components: [movement, caseComponent]
  },
  {
    note: "1(d)",
    subheadings: [
      "9101.21.80", "9101.29.10", "9101.29.20", "9101.29.30", "9101.29.40", "9101.29.50",
      "9102.21.10", "9102.21.25", "9102.21.30", "9102.21.50", "9102.21.70", "9102.21.90",
      "9102.29.10", "9102.29.15", "9102.29.20", "9102.29.25", "9102.29.30", "9102.29.35",
      "9102.29.40", "9102.29.45", "9102.29.50", "9102.29.55", "9102.29.60"
    ],
    components: [movement, caseComponent, strap]
  },
  {
    note: "1(e)",
    subheadings: ["9101.91.40", "9101.91.80", "9102.91.40", "9102.91.80", "9104.00.50"],
    components: [movement, caseComponent, battery30]
  },
  {
    note: "1(f)",
    subheadings: ["9103.10.20"],
    components: [
      ["10", "Travel clocks: Movement and case", "旅行钟：机芯及表壳", ["No. of movements"]],
      ["20", "Travel clocks: Battery", "旅行钟：电池", ["No."]],
      ["30", "Other clocks: Movement and case", "其他钟：机芯及表壳", ["No. of movements"]],
      ["40", "Other clocks: Battery", "其他钟：电池", ["No."]]
    ]
  },
  {
    note: "1(g)",
    subheadings: ["9103.10.40", "9103.10.80"],
    components: [
      ["10", "Travel clocks: Movement", "旅行钟：机芯", ["No."]],
      ["20", "Travel clocks: Case", "旅行钟：表壳", ["No."]],
      ["30", "Travel clocks: Battery", "旅行钟：电池", ["No."]],
      ["40", "Other clocks: Movement", "其他钟：机芯", ["No."]],
      ["50", "Other clocks: Case", "其他钟：表壳", ["No."]],
      ["60", "Other clocks: Battery", "其他钟：电池", ["No."]]
    ]
  },
  {
    note: "1(h)",
    subheadings: ["9103.90.00", "9105.19.10", "9105.19.20"],
    components: [
      ["10", "Travel clocks: Movement", "旅行钟：机芯", ["No."]],
      ["20", "Travel clocks: Case", "旅行钟：表壳", ["No."]],
      ["30", "Other clocks: Movement", "其他钟：机芯", ["No."]],
      ["40", "Other clocks: Case", "其他钟：表壳", ["No."]]
    ]
  },
  {
    note: "1(ij)",
    subheadings: ["9105.11.40"],
    components: [
      ["10", "Clocks capable of operating only on AC power", "仅能使用交流电源运行的钟", ["No."]],
      ["20", "Other, travel clocks: Movement and case", "其他旅行钟：机芯及表壳", ["No. of movements"]],
      ["30", "Other, travel clocks: Battery", "其他旅行钟：电池", ["No."]],
      ["40", "Other clocks: Movement and case", "其他钟：机芯及表壳", ["No. of movements"]],
      ["50", "Other clocks: Battery", "其他钟：电池", ["No."]]
    ]
  },
  {
    note: "1(k)",
    subheadings: ["9105.11.80"],
    components: [
      ["05", "Clocks capable of operating only on AC power: Movement", "仅能使用交流电源运行的钟：机芯", ["No."]],
      ["15", "Clocks capable of operating only on AC power: Case", "仅能使用交流电源运行的钟：表壳", ["No."]],
      ["20", "Other, travel clocks: Movement", "其他旅行钟：机芯", ["No."]],
      ["30", "Other, travel clocks: Case", "其他旅行钟：表壳", ["No."]],
      ["40", "Other, travel clocks: Battery", "其他旅行钟：电池", ["No."]],
      ["50", "Other clocks: Movement", "其他钟：机芯", ["No."]],
      ["60", "Other clocks: Case", "其他钟：表壳", ["No."]],
      ["70", "Other clocks: Battery", "其他钟：电池", ["No."]]
    ]
  },
  {
    note: "1(l)",
    subheadings: ["9105.19.30"],
    components: [
      ["10", "Travel clocks: Movement", "旅行钟：机芯", ["No.", "Jwls."]],
      ["20", "Travel clocks: Case", "旅行钟：表壳", ["No."]],
      ["30", "Other clocks: Movement", "其他钟：机芯", ["No.", "Jwls."]],
      ["40", "Other clocks: Case", "其他钟：表壳", ["No."]]
    ]
  },
  {
    note: "1(m)",
    subheadings: ["9105.21.40", "9105.91.40"],
    components: [
      ["10", "Clocks capable of operating only on AC power", "仅能使用交流电源运行的钟", ["No."]],
      ["20", "Other clocks: Movement and case", "其他钟：机芯及表壳", ["No. of movements"]],
      ["30", "Other clocks: Battery", "其他钟：电池", ["No."]]
    ]
  },
  {
    note: "1(n)",
    subheadings: ["9105.21.80", "9105.91.80"],
    components: [
      ["10", "Clocks capable of operating only on AC power: Movement", "仅能使用交流电源运行的钟：机芯", ["No."]],
      ["20", "Clocks capable of operating only on AC power: Case", "仅能使用交流电源运行的钟：表壳", ["No."]],
      ["30", "Other clocks: Movement", "其他钟：机芯", ["No."]],
      ["40", "Other clocks: Case", "其他钟：表壳", ["No."]],
      ["50", "Other clocks: Battery", "其他钟：电池", ["No."]]
    ]
  },
  {
    note: "1(o)",
    subheadings: ["9106.90.55"],
    components: [
      ["10", "Apparatus", "装置", ["No."]],
      battery20
    ]
  },
  {
    note: "1(p)",
    subheadings: ["9105.29.30", "9105.99.40"],
    components: [
      ["10", "Movement", "机芯", ["No.", "Jwls."]],
      caseComponent
    ]
  },
  {
    note: "1(q)",
    subheadings: ["9108.11.40", "9108.11.80", "9108.12.00", "9108.19.40", "9108.19.80"],
    components: [movement, battery20]
  },
  {
    note: "1(r)",
    subheadings: [
      "9109.10.10", "9109.10.20", "9109.10.30", "9109.10.40",
      "9109.10.50", "9109.10.60", "9109.10.70", "9109.10.80"
    ],
    components: [
      ["10", "Clock movements capable of operating only on AC power", "仅能使用交流电源运行的钟机芯", ["No."]],
      ["20", "Other clock movements: Movement", "其他钟机芯：机芯", ["No."]],
      ["30", "Other clock movements: Battery", "其他钟机芯：电池", ["No."]]
    ]
  }
];

const rulesBySubheading = new Map();

for (const group of statisticalNoteGroups) {
  for (const subheading of group.subheadings) {
    rulesBySubheading.set(normalizeHtsDigits(subheading), {
      note: group.note,
      components: group.components.map(([suffix, description, descriptionZh, units]) => ({
        suffix,
        description,
        descriptionZh,
        units
      }))
    });
  }
}

export const CHAPTER_91_STATISTICAL_BASE_COUNT = rulesBySubheading.size;
export const CHAPTER_91_STATISTICAL_REPORTING_COUNT = [...rulesBySubheading.values()]
  .reduce((total, rule) => total + rule.components.length, 0);

export function getChapter91StatisticalRule(htsno) {
  return rulesBySubheading.get(normalizeHtsDigits(htsno)) || null;
}

export function getChapter91StatisticalSubheadings() {
  return [...rulesBySubheading.keys()];
}

export function expandChapter91StatisticalRows(rows = []) {
  const existingCodes = new Set(rows.map((row) => normalizeHtsDigits(row?.htsno)).filter(Boolean));
  const expanded = [];

  for (const row of rows) {
    expanded.push(row);
    const parentDigits = normalizeHtsDigits(row?.htsno);
    const rule = rulesBySubheading.get(parentDigits);
    if (!rule || parentDigits.length !== 8) {
      continue;
    }

    for (const component of rule.components) {
      const reportingDigits = `${parentDigits}${component.suffix}`;
      if (existingCodes.has(reportingDigits)) {
        continue;
      }
      existingCodes.add(reportingDigits);
      expanded.push(buildStatisticalRow(row, parentDigits, reportingDigits, rule, component));
    }
  }

  return expanded;
}

function buildStatisticalRow(parent, parentDigits, reportingDigits, rule, component) {
  const parentHtsno = formatHtsDigits(parentDigits);
  const inheritedFields = [
    "general", "special", "other", "additionalDuties", "additionalDutyCodes",
    "quotaQuantity", "effectivePeriod", "footnotes"
  ].filter((field) => hasInheritedValue(parent[field]));

  return {
    ...parent,
    htsno: formatHtsDigits(reportingDigits),
    statisticalSuffix: component.suffix,
    description: component.description,
    descriptionEn: component.description,
    descriptionZh: component.descriptionZh,
    indent: Number(parent.indent || 0) + 1,
    units: [...component.units],
    superior: false,
    unique: false,
    inheritedFrom: parentHtsno,
    inheritedFields,
    derivedFromChapterNote: `Chapter 91 statistical note ${rule.note}`,
    statisticalComponent: {
      parentHtsno,
      suffix: component.suffix,
      note: rule.note,
      description: component.description,
      descriptionZh: component.descriptionZh
    }
  };
}

function normalizeHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatHtsDigits(digits) {
  const normalized = normalizeHtsDigits(digits);
  if (normalized.length <= 4) {
    return normalized;
  }
  const parts = [normalized.slice(0, 4)];
  for (let index = 4; index < normalized.length; index += 2) {
    parts.push(normalized.slice(index, index + 2));
  }
  return parts.join(".");
}

function hasInheritedValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return value !== undefined && value !== null && String(value).trim() !== "";
}
