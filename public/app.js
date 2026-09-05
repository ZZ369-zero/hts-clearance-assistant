import {
  buildChineseSearchPlan,
  normalizeSearchText,
  splitSearchTerms
} from "./chinese-search-helper.js?v=20260729-full-category-search-3";
import {
  buildManualAssessmentState,
  calculateManualAssessments,
  formatFeeInputLabel,
  isManualAssessmentMatch,
  matchFeeRules
} from "./fee-rule-engine.js";
import {
  getCertificationStatusMeta,
  matchCertificationRules,
  summarizeCertificationMatches
} from "./certification-rule-engine.js?v=20260803-fcc-passive-1";
import { expandChapter91StatisticalRows } from "./chapter91-statistical-notes.js?v=20260804-statistical-suffixes-1";
import {
  buildClassificationCandidates,
  expandHtsPrefixRows,
  getPreferredDescriptionZh,
  isUsableChineseDescription
} from "./description-helper.js?v=20260804-chapter91-terms-1";
import {
  matchForcedLaborExemptions
} from "./forced-labor-exemption-engine.js?v=20260810-forced-labor-display-1";
import {
  getSelectedVehicleChapter99Rules,
  NON_VEHICLE_DUTY_CHOICE,
  resolveVehiclePartsDutyChoice,
  VEHICLE_REMEDY_CHOICE_GROUP
} from "./vehicle-duty-choice-engine.js?v=20260801-vehicle-choice-1";
import { getChapterTitle } from "./chapter-titles.js?v=20260729-bilingual-chapters";
import { rankHtsSearchCandidates } from "./search-ranking.js?v=20260729-relevance-ranking-1";
import {
  describeSection232Condition,
  selectSection232MetalCandidates
} from "./section232-metal-engine.js?v=20260826-wood-products-full-1";

const section122FallbackExclusionPrefixes = [
  "84713001",
  "84714101",
  "84714900",
  "84715001",
  "847141",
  "847149",
  "84716010",
  "84716020",
  "84716070",
  "84716080",
  "84716090",
  "84717010",
  "84717020",
  "84717030",
  "84717040",
  "84717050",
  "84717060",
  "84717090",
  "84718010",
  "84718040",
  "84718090",
  "84719000",
  "85171300",
  "85171400",
  "85176100",
  "85176200",
  "85176900",
  "85177100",
  "85411000",
  "85412100",
  "85412900",
  "85413000",
  "85414100",
  "85414910",
  "85414970",
  "85414980",
  "85414995",
  "85415100",
  "85415900",
  "85419000"
];

const state = {
  mode: "search",
  rows: [],
  visibleRows: [],
  selected: null,
  dataKind: "",
  additionalDutyRequestId: 0,
  additionalDutyBreakdown: [],
  compoundGeneralDuty: null,
  cottonAssessmentRequestId: 0,
  baseRateMessage: "",
  cottonAssessment: null,
  feeMatches: [],
  certificationMatches: [],
  manualAssessments: {},
  transportMode: "ocean",
  clearanceMode: "t01",
  syncExpanded: false,
  lastQuery: "",
  lastChapter: "01",
  policyRules: null,
  forcedLaborExemptions: null,
  epaFlags: null,
  fdaFlags: null,
  section122ExclusionPrefixes: [...section122FallbackExclusionPrefixes],
  section122ExclusionsSource: "内置 Annex II 兜底清单",
  descriptionTranslations: new Map(),
  descriptionTranslationCoverage: null,
  vehicleDutySelections: new Map(),
  chapters: []
};

const els = {
  releaseBadge: document.querySelector("#releaseBadge"),
  syncTime: document.querySelector("#syncTime"),
  refreshData: document.querySelector("#refreshData"),
  themeSwitcher: document.querySelector("#themeSwitcher"),
  syncCenter: document.querySelector("#syncCenter"),
  syncAutoStatus: document.querySelector("#syncAutoStatus"),
  syncToggle: document.querySelector("#syncToggle"),
  syncRefreshAll: document.querySelector("#syncRefreshAll"),
  syncSourceList: document.querySelector("#syncSourceList"),
  clearanceFee: document.querySelector("#clearanceFee"),
  searchTab: document.querySelector("#searchTab"),
  chapterTab: document.querySelector("#chapterTab"),
  searchForm: document.querySelector("#searchForm"),
  queryInput: document.querySelector("#queryInput"),
  quickQueries: document.querySelector("#quickQueries"),
  chapterTools: document.querySelector("#chapterTools"),
  chapterSelect: document.querySelector("#chapterSelect"),
  loadChapter: document.querySelector("#loadChapter"),
  chapterFilter: document.querySelector("#chapterFilter"),
  resultTitle: document.querySelector("#resultTitle"),
  resultCount: document.querySelector("#resultCount"),
  searchGuide: document.querySelector("#searchGuide"),
  resultsBody: document.querySelector("#resultsBody"),
  emptyState: document.querySelector("#emptyState"),
  selectedCode: document.querySelector("#selectedCode"),
  selectedDescription: document.querySelector("#selectedDescription"),
  classificationPath: document.querySelector("#classificationPath"),
  classificationPathList: document.querySelector("#classificationPathList"),
  classificationEnglishList: document.querySelector("#classificationEnglishList"),
  classificationDescriptionStatus: document.querySelector("#classificationDescriptionStatus"),
  miniHsCode: document.querySelector("#miniHsCode"),
  miniProductDescription: document.querySelector("#miniProductDescription"),
  effectiveRate: document.querySelector("#effectiveRate"),
  miniGeneralRate: document.querySelector("#miniGeneralRate"),
  miniGeneralRateNote: document.querySelector("#miniGeneralRateNote"),
  surchargeRate: document.querySelector("#surchargeRate"),
  surchargeBreakdown: document.querySelector("#surchargeBreakdown"),
  restrictionList: document.querySelector("#restrictionList"),
  detailGeneral: document.querySelector("#detailGeneral"),
  detailSpecial: document.querySelector("#detailSpecial"),
  detailOther: document.querySelector("#detailOther"),
  detailUnits: document.querySelector("#detailUnits"),
  additionalDutyList: document.querySelector("#additionalDutyList"),
  certificationPanel: document.querySelector("#certificationPanel"),
  certificationSummary: document.querySelector("#certificationSummary"),
  certificationList: document.querySelector("#certificationList"),
  detailNotes: document.querySelector("#detailNotes"),
  customsValue: document.querySelector("#customsValue"),
  generalRate: document.querySelector("#generalRate"),
  compoundDutyPanel: document.querySelector("#compoundDutyPanel"),
  compoundDutyFormula: document.querySelector("#compoundDutyFormula"),
  watchQuantity: document.querySelector("#watchQuantity"),
  watchCaseValue: document.querySelector("#watchCaseValue"),
  watchStrapValue: document.querySelector("#watchStrapValue"),
  watchBatteryValue: document.querySelector("#watchBatteryValue"),
  compoundDutyNotice: document.querySelector("#compoundDutyNotice"),
  additionalRate: document.querySelector("#additionalRate"),
  specificDuty: document.querySelector("#specificDuty"),
  mpfEnabled: document.querySelector("#mpfEnabled"),
  mpfRate: document.querySelector("#mpfRate"),
  mpfMin: document.querySelector("#mpfMin"),
  mpfMax: document.querySelector("#mpfMax"),
  hmfEnabled: document.querySelector("#hmfEnabled"),
  hmfRate: document.querySelector("#hmfRate"),
  cottonFeeEnabled: document.querySelector("#cottonFeeEnabled"),
  cottonFeeRate: document.querySelector("#cottonFeeRate"),
  cottonWeightKg: document.querySelector("#cottonWeightKg"),
  adCvdRate: document.querySelector("#adCvdRate"),
  exciseAmount: document.querySelector("#exciseAmount"),
  pgaFeeAmount: document.querySelector("#pgaFeeAmount"),
  feeMatchPanel: document.querySelector("#feeMatchPanel"),
  feeMatchList: document.querySelector("#feeMatchList"),
  manualAssessmentPanel: document.querySelector("#manualAssessmentPanel"),
  manualAssessmentList: document.querySelector("#manualAssessmentList"),
  baseDuty: document.querySelector("#baseDuty"),
  extraDuty: document.querySelector("#extraDuty"),
  additionalDutySplit: document.querySelector("#additionalDutySplit"),
  fees: document.querySelector("#fees"),
  specialAssessments: document.querySelector("#specialAssessments"),
  clearanceFeeOutput: document.querySelector("#clearanceFeeOutput"),
  totalDuty: document.querySelector("#totalDuty"),
  taxBreakdown: document.querySelector("#taxBreakdown"),
  assessmentNotice: document.querySelector("#assessmentNotice"),
  calcMessage: document.querySelector("#calcMessage")
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const staticRuntime = {
  enabled: false,
  checkedDynamicApi: false,
  cache: new Map()
};

const adCvdHtsAliasRules = [
  {
    source: "3907600030",
    aliases: ["39076100", "3907610010", "3907610050", "39076900", "3907690010", "3907690050"],
    note: "PET resin AD/CVD orders use current HTSUS 3907.61.00.00 / 3907.69.00.00; older local data used 3907.60.00.30."
  }
];

const searchHistoryStorageKey = "hts-clearance-search-history";
const searchHistoryLimit = 8;

const dutyRuleCatalog = {
  "9903.88.04": {
    group: "301",
    label: "301-对中加征",
    shortLabel: "301",
    rate: 25,
    autoApply: true,
    summaryZh: "301 对中国原产商品加征，编码 9903.88.04，当前税率 +25%。",
    exemptionStatus: "无豁免",
    note: "USITC Chapter 99 U.S. note 20(g) 覆盖的中国原产商品附加税；需确认排除统计号和原产国。"
  },
  "9903.88.15": {
    group: "301",
    label: "301-对中加征",
    shortLabel: "301",
    rate: 7.5,
    autoApply: true,
    summaryZh: "301 对中国原产商品加征，常见编码 9903.88.15，当前税率 +7.5%。",
    exemptionStatus: "无豁免",
    note: "中国原产商品常见加征规则，需确认排除清单和原产国。"
  },
  "9903.05.31": {
    group: "301",
    label: "新301-强迫劳动",
    shortLabel: "新301",
    rate: 12.5,
    autoApply: true,
    summaryZh: "新301强迫劳动最终行动，中国原产商品对应 9903.05.31，当前税率 +12.5%。",
    exemptionStatus: "条件适用",
    note: "适用于 2026-07-24 00:01 美东后申报的中国原产商品；9903.05.85-9903.05.92 所列排除项需人工复核。"
  },
  "9903.03.01": {
    group: "122",
    label: "122-临时关税",
    shortLabel: "122",
    rate: 10,
    autoApply: true,
    summaryZh: "122 临时关税，编码 9903.03.01，当前税率 +10%。",
    exemptionStatus: "条件豁免",
    note: "临时附加税规则，需按当前申报日期和豁免项复核。"
  },
  "232-steel-aluminum": {
    group: "232",
    label: "232-钢铁铝加征",
    shortLabel: "232",
    rate: null,
    autoApply: false,
    summaryZh: "232 钢铁/铝及衍生品加征，需按材质与具体 9903 编码确认税率。",
    exemptionStatus: "需确认",
    note: "钢、铝及衍生品存在多组 Chapter 99 编码，需按材质、原产国和具体子目确认。"
  }
};

const temporary122Policy = {
  code: "9903.03.01",
  effectiveFrom: "2026-02-24T05:01:00.000Z",
  effectiveTo: "2026-07-24T04:01:00.000Z",
  sourceName: "CBP CSMS #67844987",
  sourceUrl: "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/40b3b7b"
};

const forcedLabor301Policy = {
  code: "9903.05.31",
  effectiveFrom: "2026-07-24T04:01:00.000Z",
  country: "China",
  sourceName: "USTR Section 301 Forced Labor Final Action",
  sourceUrl: "https://ustr.gov/sites/default/files/files/Press/Releases/2026/FLIP%20301%20Investigation%20Final%20Action%20FRN%207-23-26%20FINAL.pdf"
};

const supplementalChapter99Rows = [
  {
    htsno: "9903.05.31",
    statisticalSuffix: "",
    description: "Except for products described in headings 9903.05.85-9903.05.92, articles the product of China, as provided for in U.S. note 52 to this subchapter",
    descriptionEn: "Except for products described in headings 9903.05.85-9903.05.92, articles the product of China, as provided for in U.S. note 52 to this subchapter",
    descriptionZh: "除 9903.05.85-9903.05.92 所列产品外，中国原产商品按美国注释 52 适用新301强迫劳动附加税。",
    indent: 0,
    units: [],
    general: "The duty provided in the applicable subheading + 12.5%",
    special: "The duty provided in the applicable subheading + 12.5%",
    other: "The duty provided in the applicable subheading + 12.5%",
    additionalDuties: "",
    additionalDutyCodes: [],
    quotaQuantity: "",
    effectivePeriod: "Effective for covered goods entered for consumption on or after 2026-07-24 00:01 EDT.",
    footnotes: [],
    superior: false,
    unique: false,
    status: "",
    sourceName: forcedLabor301Policy.sourceName,
    sourceUrl: forcedLabor301Policy.sourceUrl
  }
];

const fallbackPolicyRules = {
  generatedAt: "",
  status: "fallback",
  defaultOriginCountry: "China",
  rules: [
    {
      id: "section122-temporary-99030301",
      program: "section122",
      policyType: "temporarySurcharge",
      group: "122",
      label: "122-临时关税",
      shortLabel: "122",
      code: temporary122Policy.code,
      rate: dutyRuleCatalog[temporary122Policy.code].rate,
      country: "Any",
      originCountries: ["Any"],
      defaultApply: true,
      autoApply: true,
      effectiveFrom: temporary122Policy.effectiveFrom,
      effectiveTo: temporary122Policy.effectiveTo,
      sourceName: temporary122Policy.sourceName,
      sourceUrl: temporary122Policy.sourceUrl,
      summaryZh: dutyRuleCatalog[temporary122Policy.code].summaryZh,
      exemptionStatus: dutyRuleCatalog[temporary122Policy.code].exemptionStatus,
      note: dutyRuleCatalog[temporary122Policy.code].note,
      chapter99Row: null
    },
    {
      id: "section301-forced-labor-china-99030531",
      program: "section301",
      policyType: "forcedLabor",
      group: "301",
      label: "新301-强迫劳动",
      shortLabel: "新301",
      code: forcedLabor301Policy.code,
      rate: dutyRuleCatalog[forcedLabor301Policy.code].rate,
      country: forcedLabor301Policy.country,
      originCountries: [forcedLabor301Policy.country],
      defaultApply: true,
      autoApply: true,
      effectiveFrom: forcedLabor301Policy.effectiveFrom,
      effectiveTo: "",
      sourceName: forcedLabor301Policy.sourceName,
      sourceUrl: forcedLabor301Policy.sourceUrl,
      summaryZh: dutyRuleCatalog[forcedLabor301Policy.code].summaryZh,
      exemptionStatus: dutyRuleCatalog[forcedLabor301Policy.code].exemptionStatus,
      note: dutyRuleCatalog[forcedLabor301Policy.code].note,
      chapter99Row: supplementalChapter99Rows[0]
    }
  ],
  supplementalChapter99Rows
};

const vehiclePartsSection232Options = [
  {
    listId: "automobile",
    code: "9903.94.05",
    rate: 25,
    autoApply: true,
    choiceGroup: "vehicle-parts-section232",
    choiceRank: 1,
    label: "232-汽车零配件",
    materialCode: "automobile-parts",
    materialLabel: "汽车零配件",
    shortLabel: "汽车零配件",
    context: "Automobile parts, as provided for in U.S. note 33 to Chapter 99."
  },
  {
    listId: "automobile",
    code: "9903.94.06",
    rate: 0,
    autoApply: false,
    choiceGroup: "vehicle-parts-section232",
    choiceRank: 1.5,
    label: "232-汽车零配件条件免加征",
    materialCode: "automobile-parts-zero-duty",
    materialLabel: "USMCA/非乘用轻卡条件",
    shortLabel: "232免加征",
    context: "Articles provided for in U.S. note 33(h) to Chapter 99, including qualifying USMCA entries or listed articles not used as passenger automobile or light truck parts."
  },
  {
    listId: "mhdv",
    code: "9903.74.08",
    rate: 25,
    autoApply: false,
    choiceGroup: "vehicle-parts-section232",
    choiceRank: 2,
    label: "232-重型汽车零配件",
    materialCode: "heavy-duty-vehicle-parts",
    materialLabel: "重型汽车零配件",
    shortLabel: "重型车零配件",
    context: "Medium- and heavy-duty vehicle parts, as provided for in U.S. note 38 to Chapter 99."
  }
];

const vehiclePartsSection232CodeSet = new Set(vehiclePartsSection232Options.map((option) => option.code));

const china301Note20gSeatingOverrides = [
  {
    prefix: "94016140",
    code: "9903.88.04",
    exclude: ["9401614001"],
    note: "USITC Chapter 99 U.S. note 20(g) lists 9401.61.40, except statistical reporting number 9401.61.4001."
  },
  {
    prefix: "94016960",
    code: "9903.88.04",
    exclude: ["9401696001"],
    note: "USITC Chapter 99 U.S. note 20(g) lists 9401.69.60, except statistical reporting number 9401.69.6001."
  },
  {
    prefix: "94017100",
    code: "9903.88.04",
    exclude: ["9401710001", "9401710005", "9401710006", "9401710007"],
    note: "USITC Chapter 99 U.S. note 20(g) lists 9401.71.00 with statistical reporting number exclusions."
  },
  {
    prefix: "94017900",
    code: "9903.88.04",
    exclude: ["9401790001", "9401790002", "9401790003", "9401790004"],
    note: "USITC Chapter 99 U.S. note 20(g) lists 9401.79.00 with statistical reporting number exclusions."
  },
  {
    prefix: "94018020",
    code: "9903.88.04",
    exclude: ["9401802001"],
    note: "USITC Chapter 99 U.S. note 20(g) lists 9401.80.20, except statistical reporting number 9401.80.2001."
  },
  {
    prefix: "94018040",
    code: "9903.88.04",
    exclude: ["9401804001"],
    note: "USITC Chapter 99 U.S. note 20(g) lists 9401.80.40, except statistical reporting number 9401.80.4001."
  }
];

const section232WoodProductRules = [
  {
    code: "9903.76.01",
    rate: 10,
    prefixes: [
      "44031100",
      "44032101",
      "44032201",
      "44032301",
      "44032401",
      "44032501",
      "44032601",
      "44039901",
      "44061100",
      "44069100",
      "44071100",
      "44071200",
      "44071300",
      "44071400",
      "44071900"
    ],
    label: "232-木制品",
    material: {
      code: "softwood-timber-lumber",
      label: "软木/木材",
      shortLabel: "木材",
      detailLabel: "软木木材及木材产品"
    },
    context: "Softwood timber and lumber products, as provided for in U.S. note 37 to Chapter 99.",
    source: "CBP Timber and Lumber Section 232 HTS List",
    sourceUrl: "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/3f69699",
    summaryZh: "232 木制品 9903.76.01 命中软木木材及木材产品清单，适用于中国等来源时，税率 +10%。",
    note: "CBP CSMS #66492057 / Proclamation 10976 列明该软木木材清单；需按实际木材品类及原产国复核。"
  },
  {
    code: "9903.76.02",
    rate: 25,
    prefixes: ["9401614011", "9401614031", "9401616011", "9401616031"],
    label: "232-木制品",
    material: {
      code: "upholstered-wood-furniture",
      label: "软包木框家具",
      shortLabel: "木制品",
      detailLabel: "软包木框家具"
    },
    context: "Upholstered wooden furniture products, as provided for in U.S. note 37 to Chapter 99.",
    source: "CBP Timber and Lumber Section 232 HTS List",
    sourceUrl: "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/3f69699",
    summaryZh: "232 木制品 9903.76.02 命中软包木框家具清单，适用于中国等非英国、欧盟、日本来源时，税率 +25%。",
    note: "CBP CSMS #66492057 / Proclamation 10976 列明 9401.61.4011、9401.61.4031、9401.61.6011 和 9401.61.6031；英国、欧盟、日本来源需核对对应国家专属分支。"
  },
  {
    code: "9903.76.03",
    rate: 25,
    prefixes: ["9403409060", "9403608093", "9403910080"],
    label: "232-木制品",
    material: {
      code: "kitchen-cabinet-vanity-parts",
      label: "橱柜/浴室柜及零件",
      shortLabel: "木制品",
      detailLabel: "厨房橱柜、浴室柜及其零件"
    },
    context: "Completed kitchen cabinets and vanities and their parts, as provided for in U.S. note 37 to Chapter 99.",
    source: "CBP Timber and Lumber Section 232 HTS List",
    sourceUrl: "https://content.govdelivery.com/accounts/USDHSCBP/bulletins/3f69699",
    summaryZh: "232 木制品 9903.76.03 命中已完成厨房橱柜、浴室柜及其零件清单，适用于中国等非英国、欧盟、日本来源时，税率 +25%。",
    note: "CBP CSMS #66492057 / Proclamation 10976 列明 9403.40.9060、9403.60.8093 和 9403.91.0080；若商品并非已完成橱柜、浴室柜或其零件，应复核 9903.76.04 的 0% 条件分支。"
  }
];
const themeStorageKey = "hts-clearance-theme-v1";
const supportedThemes = new Set(["cloud", "lake", "mint"]);

init();

async function init() {
  initTheme();
  initSyncPanel();
  bindEvents();
  renderSearchHistory();
  els.hmfEnabled.checked = true;
  await Promise.all([
    loadStatus(),
    loadChapters(),
    loadSyncStatus(),
    loadPolicyRules(),
    loadForcedLaborExemptions(),
    loadEpaFlags(),
    loadFdaFlags(),
    loadSection122Exclusions(),
    loadDescriptionTranslations()
  ]);
  setInterval(loadSyncStatus, 60 * 1000);
  showSearchPrompt();
  calculate();
}

async function loadSection122Exclusions(force = false) {
  try {
    const data = await loadStaticData("section122-exclusions.json", force);
    const codes = (data.codes || [])
      .map(normalizeStaticHtsDigits)
      .filter((code) => code.length >= 4);
    if (!codes.length) {
      return;
    }
    state.section122ExclusionPrefixes = [...new Set([...section122FallbackExclusionPrefixes, ...codes])]
      .sort((a, b) => b.length - a.length || a.localeCompare(b));
    state.section122ExclusionsSource = data.sourceName || "Section 122 Annex II exclusion list";
  } catch (error) {
    console.warn(`Section 122 exclusion list unavailable: ${error.message}`);
  }
}

async function loadPolicyRules(force = false) {
  try {
    const data = await loadStaticData("policy-rules.json", force);
    state.policyRules = normalizePolicyRulesSnapshot(data);
  } catch (error) {
    console.warn(`Policy rule monitor unavailable: ${error.message}`);
    state.policyRules = normalizePolicyRulesSnapshot(fallbackPolicyRules);
  }
}

async function loadForcedLaborExemptions(force = false) {
  try {
    const data = await loadStaticData("forced-labor-exemptions.json", force);
    state.forcedLaborExemptions = data?.rules ? data : null;
  } catch (error) {
    state.forcedLaborExemptions = null;
    console.warn(`Forced-labor Section 301 exclusions unavailable: ${error.message}`);
  }
}

async function loadFdaFlags(force = false) {
  try {
    const data = await loadStaticData("fda-flags.json", force);
    state.fdaFlags = data?.codes ? data : null;
  } catch (error) {
    state.fdaFlags = null;
    console.warn(`FDA FD flag list unavailable: ${error.message}`);
  }
}

async function loadEpaFlags(force = false) {
  try {
    const data = await loadStaticData("epa-flags.json", force);
    state.epaFlags = data?.codes ? data : null;
  } catch (error) {
    state.epaFlags = null;
    console.warn(`EPA EP3/EP5 flag lists unavailable: ${error.message}`);
  }
}

function normalizePolicyRulesSnapshot(data = {}) {
  return {
    ...fallbackPolicyRules,
    ...data,
    rules: Array.isArray(data.rules) && data.rules.length ? data.rules : fallbackPolicyRules.rules,
    supplementalChapter99Rows: Array.isArray(data.supplementalChapter99Rows) && data.supplementalChapter99Rows.length
      ? data.supplementalChapter99Rows
      : fallbackPolicyRules.supplementalChapter99Rows
  };
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    search(els.queryInput.value.trim(), true);
  });

  els.quickQueries.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-history-delete]");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      removeSearchHistory(deleteButton.dataset.historyDelete);
      return;
    }

    const queryButton = event.target.closest("[data-history-query]");
    if (queryButton) {
      const query = queryButton.dataset.historyQuery;
      els.queryInput.value = query;
      setMode("search");
      search(query, true);
    }
  });

  els.searchTab.addEventListener("click", () => setMode("search"));
  els.chapterTab.addEventListener("click", () => setMode("chapter"));
  els.themeSwitcher?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme]");
    if (button) {
      setTheme(button.dataset.theme, { persist: true });
    }
  });
  els.loadChapter.addEventListener("click", () => loadChapter(els.chapterSelect.value, true));
  els.chapterSelect.addEventListener("change", () => loadChapter(els.chapterSelect.value, true));
  els.chapterFilter.addEventListener("input", filterChapterRows);
  els.refreshData.addEventListener("click", refreshData);
  els.syncToggle.addEventListener("click", () => setSyncExpanded(!state.syncExpanded, { persist: true }));
  els.syncRefreshAll.addEventListener("click", () => refreshSyncSource("all"));
  els.syncSourceList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sync-source]");
    if (button) {
      refreshSyncSource(button.dataset.syncSource);
    }
  });
  els.manualAssessmentList.addEventListener("input", handleManualAssessmentInput);
  els.manualAssessmentList.addEventListener("change", handleManualAssessmentInput);
  els.restrictionList.addEventListener("change", handleVehicleDutyChoiceChange);

  [
    els.customsValue,
    els.generalRate,
    els.watchQuantity,
    els.watchCaseValue,
    els.watchStrapValue,
    els.watchBatteryValue,
    els.additionalRate,
    els.specificDuty,
    els.mpfEnabled,
    els.mpfRate,
    els.mpfMin,
    els.mpfMax,
    els.hmfEnabled,
    els.hmfRate,
    els.cottonFeeEnabled,
    els.cottonFeeRate,
    els.cottonWeightKg,
    els.adCvdRate,
    els.exciseAmount,
    els.pgaFeeAmount,
    els.clearanceFee
  ].filter(Boolean).forEach((input) => input.addEventListener("input", calculate));
}

function initTheme() {
  let storedTheme = "cloud";
  try {
    storedTheme = localStorage.getItem(themeStorageKey) || "cloud";
  } catch {
    // Keep the default theme when browser storage is unavailable.
  }
  setTheme(supportedThemes.has(storedTheme) ? storedTheme : "cloud");
}

function setTheme(theme, { persist = false } = {}) {
  const nextTheme = supportedThemes.has(theme) ? theme : "cloud";
  document.documentElement.dataset.theme = nextTheme;
  els.themeSwitcher?.querySelectorAll("[data-theme]").forEach((button) => {
    const isActive = button.dataset.theme === nextTheme;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // Theme persistence is optional when browser storage is unavailable.
    }
  }
}

async function loadDescriptionTranslations(force = false) {
  try {
    const data = await loadStaticData("translations.json", force);
    state.descriptionTranslations = new Map(
      Object.entries(data.values || {})
        .filter(([, translation]) => isUsableChineseDescription(translation))
    );
    state.descriptionTranslationCoverage = data.coverage || null;
  } catch (error) {
    state.descriptionTranslations = new Map();
    state.descriptionTranslationCoverage = null;
    console.warn(`Description translation cache unavailable: ${error.message}`);
  }
}

function setMode(mode) {
  state.mode = mode;
  const isSearch = mode === "search";
  els.searchTab.classList.toggle("active", isSearch);
  els.chapterTab.classList.toggle("active", !isSearch);
  els.searchTab.setAttribute("aria-selected", String(isSearch));
  els.chapterTab.setAttribute("aria-selected", String(!isSearch));
  els.searchForm.classList.toggle("hidden", !isSearch);
  els.chapterTools.classList.toggle("hidden", isSearch);

  if (!isSearch && state.dataKind !== "chapter") {
    loadChapter(state.lastChapter, true);
  }
}

function initSyncPanel() {
  const saved = localStorage.getItem("hts-sync-expanded");
  setSyncExpanded(saved === "true", { persist: false });
}

function setSyncExpanded(expanded, options = {}) {
  state.syncExpanded = Boolean(expanded);
  els.syncCenter.classList.toggle("collapsed", !state.syncExpanded);
  els.syncToggle.textContent = state.syncExpanded ? "收起详情" : "展开详情";
  els.syncToggle.setAttribute("aria-expanded", String(state.syncExpanded));
  els.syncSourceList.setAttribute("aria-hidden", String(!state.syncExpanded));

  if (options.persist) {
    localStorage.setItem("hts-sync-expanded", String(state.syncExpanded));
  }
}

async function loadStatus(force = false) {
  const data = await api(`/api/status${force ? "?refresh=1" : ""}`);
  const release = data.release || {};
  els.releaseBadge.textContent = release.description || release.title || release.name || "USITC HTS";
  els.syncTime.textContent = `同步 ${formatTime(data.fetchedAt)}`;
}

async function loadSyncStatus() {
  try {
    const data = await api("/api/sync/status");
    renderSyncStatus(data);
  } catch (error) {
    els.syncAutoStatus.textContent = "自动更新：读取失败";
    els.syncSourceList.innerHTML = `<div class="sync-empty">同步状态读取失败：${escapeHtml(error.message)}</div>`;
  }
}

async function refreshSyncSource(source) {
  const label = source === "all" ? "全部数据源" : source;
  els.syncAutoStatus.textContent = `自动更新：正在刷新 ${label}`;
  try {
    const data = await api(`/api/sync/refresh?source=${encodeURIComponent(source)}`, { method: "POST" });
    renderSyncStatus(data);
    if (source === "all") {
      await loadStatus(true);
    }
  } catch (error) {
    els.syncAutoStatus.textContent = `自动更新：刷新失败`;
    els.syncSourceList.insertAdjacentHTML(
      "afterbegin",
      `<div class="sync-empty">刷新失败：${escapeHtml(error.message)}</div>`
    );
  }
}

function renderSyncStatus(data) {
  const sources = data.sources || [];
  els.syncAutoStatus.textContent = data.autoSync
    ? `自动更新：已开启，服务器时间 ${formatTime(data.serverTime)}`
    : "自动更新：未开启";

  if (!sources.length) {
    els.syncSourceList.innerHTML = `<div class="sync-empty">暂无同步源。</div>`;
    return;
  }

  els.syncSourceList.innerHTML = sources.map(renderSyncCard).join("");
}

function renderSyncCard(source) {
  const stateInfo = source.state || {};
  const detail = stateInfo.detail || {};
  const status = stateInfo.status || "pending";
  const statusText = {
    ok: "正常",
    warning: "待复核",
    running: "同步中",
    error: "异常",
    pending: "等待"
  }[status] || status;
  const link = detail.url || source.url;
  const count = detail.count != null ? `记录数：${detail.count}` : "";
  const ruleStats = detail.activeRules != null
    ? `有效规则：${detail.activeRules} / 已到期：${detail.expiredRules || 0}${detail.expiredRule ? `（${detail.expiredRule}）` : ""} / 特定商品：${detail.particularArticles || 0}`
    : "";
  const anomalyText = detail.anomalyCount
    ? `异常：${detail.anomalyCount}${Array.isArray(detail.anomalySamples) && detail.anomalySamples.length ? ` / ${detail.anomalySamples.join("；")}` : ""}`
    : "";
  const translationText = source.id === "translations" ? renderTranslationSyncSummary(detail) : "";
  const warningText = status !== "ok" && stateInfo.message ? stateInfo.message : "";
  const extra = anomalyText || translationText || ruleStats || detail.release || detail.title || detail.effectiveNote || detail.mode || warningText || "";

  return `
    <article class="sync-source-card">
      <header>
        <div>
          <h3>${escapeHtml(source.name)}</h3>
          <p>${escapeHtml(source.description || source.sourceName || "")}</p>
        </div>
        <span class="sync-status-pill ${escapeHtml(status)}">${escapeHtml(statusText)}</span>
      </header>
      <div class="sync-meta">
        <span>来源：${escapeHtml(source.sourceName || "--")}</span>
        <span>上次同步：${escapeHtml(formatTime(stateInfo.lastSyncAt || detail.fetchedAt))}</span>
        <span>下次自动：${escapeHtml(formatTime(stateInfo.nextSyncAt))}</span>
        <span>${escapeHtml([count, extra].filter(Boolean).join(" / ") || stateInfo.message || "--")}</span>
        ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">打开来源链接</a>` : ""}
        ${detail.pdfUrl ? `<a href="${escapeHtml(detail.pdfUrl)}" target="_blank" rel="noreferrer">打开CBP HTS排除清单</a>` : ""}
      </div>
      <div class="sync-card-actions">
        <small>周期：约 ${escapeHtml(String(source.intervalMinutes || "--"))} 分钟</small>
        <button class="secondary-button" type="button" data-sync-source="${escapeHtml(source.id)}">刷新</button>
      </div>
    </article>
  `;
}

function renderTranslationSyncSummary(detail) {
  if (detail.pendingDescriptions == null && detail.pendingCalibration == null) {
    return "";
  }
  const accepted = numberOrZero(detail.acceptedThisRun);
  const newTranslations = detail.newTranslationsThisRun != null
    ? numberOrZero(detail.newTranslationsThisRun)
    : accepted;
  const failed = detail.failedThisRun != null
    ? numberOrZero(detail.failedThisRun)
    : numberOrZero(detail.rejectedThisRun) + numberOrZero(detail.deferredThisRun);
  const remaining = [
    detail.pendingDescriptions != null ? `待翻译：${numberOrZero(detail.pendingDescriptions)}` : "",
    detail.pendingCalibration != null ? `待校准：${numberOrZero(detail.pendingCalibration)}` : ""
  ].filter(Boolean).join("，");
  const estimate = renderTranslationEstimate(detail);
  return [
    `本次新增：${newTranslations}`,
    `失败：${failed}`,
    remaining ? `剩余：${remaining}` : "",
    estimate
  ].filter(Boolean).join(" / ");
}

function renderTranslationEstimate(detail) {
  if (detail.estimatedCompletionRuns === 0 || detail.pendingCalibration === 0) {
    return "预计完成：已完成";
  }
  if (detail.estimatedCompletionAt) {
    const days = detail.estimatedCompletionDays != null ? `约 ${detail.estimatedCompletionDays} 天` : "";
    return `预计完成：${[days, formatTime(detail.estimatedCompletionAt)].filter(Boolean).join("，")}`;
  }
  return "预计完成：待累计更多成功样本";
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function loadChapters() {
  const data = await api("/api/chapters");
  state.chapters = data.chapters || [];
  els.chapterSelect.innerHTML = state.chapters
    .map(([code, titleEn, titleZh]) => {
      const title = getChapterTitle(code, titleEn, titleZh);
      return `<option value="${code}">${code} - ${escapeHtml(title.titleZh)} / ${escapeHtml(title.titleEn)}</option>`;
    })
    .join("");
  els.chapterSelect.value = state.lastChapter;
}

function getSearchHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(searchHistoryStorageKey) || "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seen = new Set();
    return parsed
      .map((item) => String(item || "").trim())
      .filter((item) => {
        const key = item.toLowerCase();
        if (!item || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, searchHistoryLimit);
  } catch {
    return [];
  }
}

function setSearchHistory(history) {
  try {
    localStorage.setItem(searchHistoryStorageKey, JSON.stringify(history.slice(0, searchHistoryLimit)));
  } catch {
    // localStorage can be unavailable in private or restricted browsing modes.
  }
}

function saveSearchHistory(query) {
  const cleaned = String(query || "").trim();
  if (!cleaned) {
    return;
  }
  const next = [
    cleaned,
    ...getSearchHistory().filter((item) => item.toLowerCase() !== cleaned.toLowerCase())
  ].slice(0, searchHistoryLimit);
  setSearchHistory(next);
}

function removeSearchHistory(query) {
  const cleaned = String(query || "").trim();
  const next = getSearchHistory().filter((item) => item !== cleaned);
  setSearchHistory(next);
  renderSearchHistory();
}

function renderSearchHistory() {
  const history = getSearchHistory();
  els.quickQueries.classList.toggle("hidden", history.length === 0);
  els.quickQueries.innerHTML = history
    .map((query) => `
      <span class="quick-query-item">
        <button class="quick-query-button" type="button" data-history-query="${escapeHtml(query)}">${escapeHtml(query)}</button>
        <button class="quick-query-delete" type="button" data-history-delete="${escapeHtml(query)}" aria-label="删除 ${escapeHtml(query)}">&times;</button>
      </span>
    `)
    .join("");
}

async function search(query, force = false) {
  if (!query || ([...query].length < 2 && !/[\u3400-\u9fff]/.test(query))) {
    showSearchPrompt("请输入至少 2 个字符，或输入中文品名 / HTS CODE。");
    return;
  }

  state.dataKind = "search";
  setMode("search");
  state.lastQuery = query;
  els.queryInput.value = query;
  setLoading(true);
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}${force ? "&refresh=1" : ""}`);
    state.rows = hydrateDescriptionTranslations(
      await attachClassificationPaths(data.value || [], force)
    );
    state.visibleRows = state.rows;
    state.dataKind = "search";
    saveSearchHistory(query);
    renderSearchHistory();
    const matchSummary = data.matchSummary;
    const summaryText = matchSummary && (matchSummary.highRelevance || matchSummary.relatedCandidates)
      ? `（精准 ${matchSummary.exactMatches || 0}，高相关 ${Math.max(0, matchSummary.highRelevance - (matchSummary.exactMatches || 0))}，关联候选 ${matchSummary.relatedCandidates}）`
      : "";
    els.resultTitle.textContent = data.translated
      ? `查询结果：${data.originalQuery} → ${data.query}${summaryText}`
      : `查询结果：${query}${summaryText}`;
    renderSearchGuide(data.hints || []);
    renderRows(state.visibleRows);
    selectFirstSelectable();
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
}

async function loadChapter(chapter, force = false) {
  state.lastChapter = chapter;
  els.chapterSelect.value = chapter;
  state.dataKind = "chapter";
  setMode("chapter");
  setLoading(true);
  try {
    const data = await api(`/api/chapter?chapter=${encodeURIComponent(chapter)}${force ? "&refresh=1" : ""}`);
    state.rows = buildStaticSearchCandidates(data.value || []).map((candidate) => candidate.row);
    state.visibleRows = state.rows;
    state.dataKind = "chapter";
    const chapterEntry = state.chapters.find(([code]) => code === chapter) || [];
    const title = getChapterTitle(chapter, chapterEntry[1], chapterEntry[2]);
    els.resultTitle.textContent = `${chapter} - ${title.titleZh} / ${title.titleEn}`;
    renderSearchGuide([]);
    els.chapterFilter.value = "";
    renderRows(state.visibleRows);
    selectFirstSelectable();
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
}

async function refreshData() {
  setLoading(true);
  try {
    await api("/api/refresh", { method: "POST" });
    await loadPolicyRules(true);
    await loadForcedLaborExemptions(true);
    await loadEpaFlags(true);
    await loadFdaFlags(true);
    await loadSection122Exclusions(true);
    await loadDescriptionTranslations(true);
    await loadStatus(true);
    await loadSyncStatus();
    if (state.mode === "chapter") {
      await loadChapter(state.lastChapter, true);
    } else {
      await search(state.lastQuery, true);
    }
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
}

function filterChapterRows() {
  const term = els.chapterFilter.value.trim().toLowerCase();
  state.visibleRows = term
    ? state.rows.filter((row) =>
        `${row.htsno} ${row.description} ${row.descriptionZh || ""} ${(row.additionalDutyCodes || []).join(" ")}`
          .toLowerCase()
          .includes(term)
      )
    : state.rows;
  renderRows(state.visibleRows);
  selectFirstSelectable();
}

function renderRows(rows) {
  els.resultCount.textContent = `${rows.length} 条`;
  els.emptyState.classList.toggle("hidden", rows.length > 0);
  els.resultsBody.innerHTML = rows
    .map((row, index) => {
      const hasCode = Boolean(row.htsno);
      const selected = state.selected && rowKey(row) === rowKey(state.selected) ? " selected" : "";
      return `
        <tr class="${selected}" data-index="${index}" ${hasCode ? "tabindex=\"0\"" : ""}>
          <td class="code-cell">${hasCode ? escapeHtml(row.htsno) : ""}</td>
          <td class="description-cell indent-${Math.min(row.indent || 0, 5)}">
            <span class="zh-line">${escapeHtml(displayZhDescription(row))}</span>
            <span class="en-line">${escapeHtml(row.description || "--")}</span>
            ${renderSearchMatchMeta(row.searchMatch)}
          </td>
          <td class="rate-cell">${renderGeneralRateCell(row)}</td>
          <td class="rate-cell additional-cell">${renderAdditionalCodes(row)}</td>
          <td class="rate-cell">${escapeHtml(formatRateDisplay(row.special))}</td>
          <td class="rate-cell">${escapeHtml(formatRateDisplay(row.other))}</td>
        </tr>
      `;
    })
    .join("");

  els.resultsBody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => selectRow(Number(tr.dataset.index)));
    tr.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectRow(Number(tr.dataset.index));
      }
    });
  });
}

function renderSearchGuide(hints) {
  const items = [...new Set((hints || []).map((item) => String(item || "").trim()).filter(Boolean))];
  if (!items.length) {
    els.searchGuide.classList.add("hidden");
    els.searchGuide.innerHTML = "";
    return;
  }

  els.searchGuide.classList.remove("hidden");
  els.searchGuide.innerHTML = `
    <span>检索提示</span>
    ${items.map((item) => `<b>${escapeHtml(item)}</b>`).join("")}
  `;
}

function renderAdditionalCodes(row) {
  const section232Matches = getSection232WoodProductMatches(row);
  const rules = mergeAdditionalDutyRules([
    ...buildAdditionalDutyRules(row, {
      section232Matches,
      appliedChapter99Rules: section232Matches.filter((match) => match.autoApply !== false && isSection232Code(match.code))
    }),
    ...section232Matches.map((match) => createSection232Rule(match))
  ]);
  if (rules.length) {
    return rules
      .slice(0, 3)
      .map((rule) => {
        if (rule.exempt) {
          const rate = rule.rate == null ? "" : ` ${formatRateNumber(rule.rate)}%`;
          return `<span class="code-tag">${escapeHtml(rule.shortLabel)} ${escapeHtml(rule.code || "")}${escapeHtml(rate)} 已豁免</span>`;
        }
        const rate = rule.exemptionStatus === "多选1" ? "多选1" : rule.rate == null ? "需判断" : `+${rule.rate}%`;
        return `<span class="code-tag">${escapeHtml(rule.shortLabel)} ${escapeHtml(rule.code || "")} ${escapeHtml(rate)}</span>`;
      })
      .join("");
  }
  return escapeHtml(row.additionalDuties || "");
}

function buildAdditionalDutyRules(row, context = {}) {
  const appliedChapter99Rules = getAppliedChapter99Rules(row, context);
  const sourceCodes = normalizeRuntimeAdditionalDutyCodes(row, [
    ...(row.additionalDutyCodes || []),
    ...getDefaultAdditionalDutyCodes(context)
  ]);
  return sourceCodes.map((code) => {
    if (isSection232Code(code)) {
      return createSection232Rule({
        code,
        htsMatch: "官方脚注",
        context: "USITC 商品脚注",
        autoApply: true,
        source: "USITC"
      });
    }
    const policyRule = getPolicyRuleByCode(code);
    const catalog = policyRuleToDutyCatalog(policyRule) || dutyRuleCatalog[code] || inferDutyRuleByCode(code);
    const policyInactive = getPolicyInactiveMeta(policyRule, context);
    const forcedLaborExemption = code === "9903.05.31" && !policyInactive
      ? matchForcedLaborExemptions(row.htsno, state.forcedLaborExemptions || {}, {
          referenceDate: getPolicyReferenceDate(context),
          appliedChapter99Rules
        })
      : null;
    const exactForcedLaborExemption = forcedLaborExemption?.exact || null;
    const isVehicleRemedyChoice = code === "9903.05.31" && Boolean(context.vehicleDutyChoice);
    const vehicleChoiceSelected = context.vehicleDutyChoice === NON_VEHICLE_DUTY_CHOICE;
    const temporary122Choice = code === "9903.03.01" && !policyInactive ? getTemporary122Choice(row, context) : null;
    const temporary122Exemption = code === "9903.03.01" && !temporary122Choice && !policyInactive
      ? getTemporary122Exemption(row, context)
      : null;
    return {
      code,
      group: catalog.group || catalog.shortLabel || "CH99",
      label: catalog.label || "Chapter 99 附加税",
      shortLabel: catalog.shortLabel || "CH99",
      rate: catalog.rate ?? null,
      autoApply: policyInactive || exactForcedLaborExemption || temporary122Choice || temporary122Exemption
        ? false
        : catalog.autoApply !== false && (!isVehicleRemedyChoice || vehicleChoiceSelected),
      choiceGroup: isVehicleRemedyChoice ? VEHICLE_REMEDY_CHOICE_GROUP : "",
      choiceValue: isVehicleRemedyChoice ? NON_VEHICLE_DUTY_CHOICE : "",
      choiceSelected: isVehicleRemedyChoice ? vehicleChoiceSelected : false,
      choiceRank: isVehicleRemedyChoice ? 1 : 0,
      summaryZh: policyInactive?.summaryZh || exactForcedLaborExemption?.summaryZh || temporary122Choice?.summaryZh || temporary122Exemption?.summaryZh || catalog.summaryZh,
      exemptionStatus: policyInactive?.exemptionStatus || (exactForcedLaborExemption ? "自动豁免" : "") || temporary122Choice?.exemptionStatus || (temporary122Exemption ? "不计入" : catalog.exemptionStatus || "需确认"),
      note: policyInactive?.note || (exactForcedLaborExemption
        ? `${exactForcedLaborExemption.titleZh}；截止日：${exactForcedLaborExemption.expiryLabel}。`
        : "") || temporary122Choice?.note || temporary122Exemption?.note || catalog.note || "来自 USITC 脚注或常见附加税规则，需复核适用条件。",
      exempt: Boolean(exactForcedLaborExemption || temporary122Exemption),
      exemptionCode: exactForcedLaborExemption?.code || temporary122Exemption?.code || "",
      exemptionMatchedHts: exactForcedLaborExemption?.matchedHts || "",
      exemptionSourceUrl: exactForcedLaborExemption?.sourceUrl || "",
      possibleExemptions: forcedLaborExemption?.possible || []
    };
  });
}

function getAppliedChapter99Rules(row, context = {}) {
  return mergeSection232Matches([
    ...getSection232WoodProductMatches(row),
    ...(Array.isArray(context.section232Matches) ? context.section232Matches : []),
    ...(Array.isArray(context.appliedChapter99Rules) ? context.appliedChapter99Rules : [])
  ]).filter((match) => match.autoApply !== false && isSection232Code(match.code));
}

function renderSearchMatchMeta(match) {
  if (!match?.reasons?.length) {
    return "";
  }
  const tierLabel = match.tier === "exact"
    ? "精准匹配"
    : match.tier === "related"
      ? "关联候选"
      : "高相关";
  return `
    <div class="search-match-meta" aria-label="检索匹配依据">
      <span class="match-tier ${match.tier === "related" ? "related" : match.tier === "exact" ? "exact" : "direct"}">${tierLabel}</span>
      ${match.reasons.slice(0, 3).map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}
    </div>
  `;
}

function getDefaultAdditionalDutyCodes(context = {}) {
  const referenceDate = getPolicyReferenceDate(context);
  return getPolicyRules()
    .filter((rule) => rule.defaultApply !== false && rule.autoApply !== false)
    .filter((rule) => isPolicyActive(rule, referenceDate))
    .filter((rule) => matchesDefaultOriginCountry(rule))
    .map((rule) => rule.code)
    .filter(Boolean);
}

function getPolicyRules() {
  return (state.policyRules?.rules?.length ? state.policyRules.rules : fallbackPolicyRules.rules) || [];
}

function getPolicyRuleByCode(code) {
  return getPolicyRules().find((rule) => rule.code === code) || null;
}

function getSupplementalChapter99Rows(policyRules = state.policyRules || fallbackPolicyRules) {
  const byCode = new Map();
  for (const row of [
    ...((policyRules && policyRules.supplementalChapter99Rows) || []),
    ...supplementalChapter99Rows
  ]) {
    if (row?.htsno) {
      byCode.set(row.htsno, row);
    }
  }
  return [...byCode.values()];
}

function policyRuleToDutyCatalog(rule) {
  if (!rule) {
    return null;
  }
  return {
    group: rule.group || rule.program || "policy",
    label: rule.label || "政策附加税",
    shortLabel: rule.shortLabel || rule.group || "政策",
    rate: rule.rate ?? null,
    autoApply: rule.autoApply !== false,
    summaryZh: rule.summaryZh || `${rule.label || "政策附加税"} ${rule.code || ""}，税率 ${rule.rate == null ? "需判断" : `+${formatRateNumber(rule.rate)}%`}。`,
    exemptionStatus: rule.exemptionStatus || "条件适用",
    note: rule.note || `${rule.sourceName || "官方政策源"}；请按申报日期、原产国和排除项复核。`
  };
}

function matchesDefaultOriginCountry(rule) {
  const origin = state.policyRules?.defaultOriginCountry || fallbackPolicyRules.defaultOriginCountry || "China";
  const countries = rule.originCountries || [rule.country || ""];
  return countries.some((country) => !country || /^any$/i.test(country) || String(country).toLowerCase() === String(origin).toLowerCase());
}

function getPolicyInactiveMeta(rule, context = {}) {
  if (!rule) {
    return null;
  }
  const referenceDate = getPolicyReferenceDate(context);
  const start = parsePolicyDate(rule.effectiveFrom);
  const end = parsePolicyDate(rule.effectiveTo);
  if (start && referenceDate < start) {
    return {
      exemptionStatus: "未生效",
      summaryZh: `${rule.label || "政策税项"} ${rule.code || ""} 尚未生效，当前不计入估算。`,
      note: `${rule.sourceName || "官方政策源"} 显示生效时间为 ${formatPolicyDate(rule.effectiveFrom)}。`
    };
  }
  if (end && referenceDate >= end) {
    return {
      exemptionStatus: "已截止",
      summaryZh: `${rule.label || "政策税项"} ${rule.code || ""} 适用期已截止，当前不计入估算。`,
      note: `${rule.sourceName || "官方政策源"} 显示截止时间为 ${formatPolicyDate(rule.effectiveTo)}。`
    };
  }
  return null;
}

function getPolicyReferenceDate(context = {}) {
  const value = context.entryDate || context.referenceDate || "";
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parsePolicyDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPolicyDate(value) {
  const date = parsePolicyDate(value);
  return date ? date.toISOString().replace("T", " ").replace(".000Z", " UTC") : "--";
}

function isPolicyEffective(policy, date = new Date()) {
  const start = new Date(policy.effectiveFrom);
  return !Number.isNaN(start.getTime()) && date >= start;
}

function isPolicyActive(policy, date = new Date()) {
  if (!isPolicyEffective(policy, date)) {
    return false;
  }
  if (!policy.effectiveTo) {
    return true;
  }
  const end = new Date(policy.effectiveTo);
  return Number.isNaN(end.getTime()) || date < end;
}

function getTemporary122Inactive(context = {}) {
  const referenceDate = getPolicyReferenceDate(context);
  if (isPolicyActive(temporary122Policy, referenceDate)) {
    return null;
  }
  const end = new Date(temporary122Policy.effectiveTo);
  if (Number.isNaN(end.getTime()) || referenceDate < end) {
    return null;
  }
  return {
    exemptionStatus: "已截止",
    summaryZh: "122 临时关税适用期已截止，当前不自动计入 +10%。",
    note: `${temporary122Policy.sourceName} 显示 9903.03.01 适用至 2026-07-24 00:01 美东；当前估算改按新301强迫劳动规则复核。`
  };
}

function getTemporary122Choice(row, context = {}) {
  const section232Matches = context.section232Matches || [];
  if (!hasVehiclePartsSection232Match(section232Matches) && !isPotentialVehiclePartsSection232(row)) {
    return null;
  }

  return {
    exemptionStatus: "多选1",
    summaryZh: "122 临时关税与车辆零配件 232 项存在多选一关系；当前列出 9903.03.01 但不自动计入，请按实际车型/零配件适用项选择。",
    note: "如适用 232-汽车零配件 9903.94.05、9903.94.06 或 232-重型汽车零配件 9903.74.08，不应同时叠加 122 临时关税；如车辆 232 项不适用，可人工选择 122。"
  };
}

function getTemporary122Exemption(row, context = {}) {
  const section232Matches = context.section232Matches || [];
  const hasSection232Match = section232Matches.some((match) => match.autoApply !== false && isSection232Code(match.code));
  const exclusion = getTemporary122Exclusion(row, { hasSection232Match });
  if (!exclusion) {
    return null;
  }

  const exemptionCode = exclusion.code || "9903.03.06";
  return {
    code: exemptionCode,
    summaryZh: `122 临时关税有关联，但该商品属于 ${exclusion.label}，当前不计入 +10%。`,
    note: `9903.03.01 排除 9903.03.02-9903.03.11 所列商品；${exclusion.note}`
  };
}

function getTemporary122Exclusion(row, context = {}) {
  const annexIiMatch = findTemporary122AnnexIiExclusion(row);
  if (annexIiMatch) {
    return {
      code: "9903.03.03",
      label: `Annex II 排除清单 ${formatStaticHtsDigits(annexIiMatch)}`,
      note: `${state.section122ExclusionsSource}列明 ${formatStaticHtsDigits(annexIiMatch)}，122 临时关税不自动加征。`
    };
  }

  if (context.hasSection232Match || isPotentialTemporary122Section232Exempt(row)) {
    return {
      label: "9903.03.06 所列钢、铝、铜、车辆零配件或其他 232 排除范围",
      note: "当前 HTS 命中 232/金属/车辆类排除规则，122 临时关税不自动加征。"
    };
  }

  if (isPotentialTemporary122SemiconductorExempt(row)) {
    return {
      label: "9903.03.06 所列半导体相关商品排除范围",
      note: "当前 HTS 为 8524.91 平板显示模块，按 9903.03.06 半导体相关商品排除范围处理，122 临时关税不自动加征。"
    };
  }

  return null;
}

function findTemporary122AnnexIiExclusion(row) {
  const hts = normalizeStaticHtsDigits(row.htsno);
  if (!hts) {
    return "";
  }
  return (state.section122ExclusionPrefixes || [])
    .find((prefix) => prefix && (hts === prefix || hts.startsWith(prefix))) || "";
}

function isPotentialTemporary122Section232Exempt(row) {
  const hts = normalizeHtsCode(row.htsno);
  const description = `${row.description || ""} ${row.descriptionZh || ""}`.toLowerCase();
  return /^(72|73|74|76|83)/.test(hts) || /steel|iron|aluminum|aluminium|copper|铝|钢|铁|铜/.test(description);
}

function isPotentialTemporary122SemiconductorExempt(row) {
  const hts = normalizeHtsCode(row.htsno);
  const description = `${row.description || ""} ${row.descriptionZh || ""}`.toLowerCase();
  return /^852491/.test(hts) || /flat panel display module|liquid crystal|liquid crystals|semiconductor|平板显示|液晶|半导体/.test(description);
}

function hasVehiclePartsSection232Match(matches = []) {
  return matches.some((match) => isVehiclePartsSection232Code(match.code));
}

function isPotentialVehiclePartsSection232(row) {
  const hts = normalizeHtsCode(row.htsno);
  return /^8708/.test(hts);
}

function inferDutyRuleByCode(code) {
  if (/^9903\.(88|91|92)\.\d{2}$/.test(code)) {
    return {
      group: "301",
      label: "301-对中加征",
      shortLabel: "301",
      autoApply: true,
      summaryZh: `301 中国原产商品附加税，编码 ${code}，税率按 USITC Chapter 99 实时读取。`,
      exemptionStatus: "需复核",
      note: "来自商品脚注的中国原产商品附加税，请结合原产国、排除清单和申报日期确认。"
    };
  }
  if (/^9903\.90\.\d{2}$/.test(code)) {
    return {
      group: "other",
      label: "其他国家附加税",
      shortLabel: "其他",
      autoApply: false,
      summaryZh: `其他国家或特殊条件附加税，编码 ${code}。`,
      exemptionStatus: "条件适用",
      note: "该类编码通常受原产国或 Column 2 条件限制，默认不计入中国原产商品估算。"
    };
  }
  return {};
}

function getSection232WoodProductMatches(row) {
  const digits = normalizeStaticHtsDigits(row?.htsno);
  if (!digits) {
    return [];
  }
  return section232WoodProductRules
    .filter((rule) => (rule.prefixes || []).some((prefix) => digits.startsWith(prefix)))
    .map((rule) => {
      const matchedPrefix = (rule.prefixes || []).find((prefix) => digits.startsWith(prefix)) || digits;
      return {
        code: rule.code,
        htsMatch: formatStaticHtsDigits(matchedPrefix),
        normalizedMatch: matchedPrefix,
        context: rule.context,
        material: rule.material,
        label: rule.label,
        confidence: matchedPrefix === digits ? "exact" : "prefix",
        rate: rule.rate,
        autoApply: true,
        alternatives: 1,
        source: rule.source,
        sourceUrl: rule.sourceUrl,
        summaryZh: rule.summaryZh,
        note: rule.note
      };
    });
}

function mergeSection232Matches(matches = []) {
  const merged = new Map();
  for (const match of matches) {
    if (!match?.code) {
      continue;
    }
    const key = `${match.code}|${normalizeStaticHtsDigits(match.normalizedMatch || match.htsMatch || "") || normalizeStaticHtsDigits(match.hts || "")}`;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, ...match } : match);
  }
  return [...merged.values()];
}

function buildSection232Rules(row, data) {
  if (data?.value?.length) {
    return data.value.map((match) => createSection232Rule(match, data.source));
  }

  const sourceText = data?.source?.fetchedAt ? `已查询 CBP Metals HTS List，更新时间 ${data.source.fetchedAt}。` : "已查询 CBP Metals HTS List。";
  return [{
    code: "232-no-match",
    group: "232",
    label: dutyRuleCatalog["232-steel-aluminum"].label,
    shortLabel: "232",
    rate: null,
    autoApply: false,
    summaryZh: "CBP 232 Metals HTS List 未命中此 HTS，当前不自动计入 232。",
    exemptionStatus: isPotentialSteelAluminum(row) ? "需复核" : "不计入",
    note: `${sourceText} 如产品含钢/铝/铜成分或以套装申报，请人工复核材质和 9903 编码。`,
    source: "section232"
  }];
}

function createSection232Rule(match, source = {}) {
  const sourceName = source?.name || match.source || "CBP Metals HTS List";
  const matchedHts = match.htsMatch ? `匹配 ${match.htsMatch}` : "匹配官方清单";
  const alternatives = match.alternatives > 1 ? `；同一 HTS 存在 ${match.alternatives} 个条件项，需按实际货物选择` : "";
  const material = match.material || {
    code: "metal-unspecified",
    label: "金属制品",
    shortLabel: "金属",
    detailLabel: "金属制品"
  };
  const materialLabel = material.detailLabel || material.label || "金属制品";
  const nonStackedNote = match.nonStackedBy
    ? `当前已选择车辆零部件税项 ${match.nonStackedBy}；依据车辆232非叠加规则，本项金属232不重复计入。`
    : "";
  return {
    code: match.code || "232-no-match",
    group: "232",
    label: match.label || `232-${materialLabel}加征`,
    shortLabel: "232",
    rate: match.rate ?? null,
    autoApply: match.autoApply !== false,
    choiceGroup: match.choiceGroup || "",
    choiceValue: match.choiceValue || match.code || "",
    choiceSelected: Boolean(match.choiceSelected),
    choiceRank: match.choiceRank || 0,
    summaryZh: `${match.summaryZh || `${sourceName} ${matchedHts}，材质归类为${materialLabel}，对应 ${match.code || "未命中"}。`}${nonStackedNote ? ` ${nonStackedNote}` : ""}`,
    exemptionStatus: match.nonStackedBy ? "不重复计入" : match.autoApply === false ? "需复核" : "官方匹配",
    note: `${match.note || match.context || "Section 232 metals list"}${alternatives}${nonStackedNote ? `；${nonStackedNote}` : ""}`,
    material,
    source: "section232"
  };
}

function mergeAdditionalDutyRules(rules) {
  const merged = new Map();
  for (const rule of rules) {
    const key = /^99\d{2}\.\d{2}\.\d{2}$/.test(rule.code || "")
      ? rule.code
      : `${rule.label}|${rule.code}`;
    const existing = merged.get(key);
    if (!existing || rule.source === "section232") {
      merged.set(key, existing ? { ...existing, ...rule } : rule);
    }
  }
  return [...merged.values()];
}

function mergeAdditionalDutyBreakdown(items) {
  const merged = new Map();
  for (const item of items) {
    const key = `${item.group || item.shortLabel || "CH99"}|${item.code || ""}`;
    const existing = merged.get(key);
    if (existing) {
      existing.rate = roundRate(existing.rate + item.rate);
    } else {
      merged.set(key, { ...item, rate: roundRate(item.rate) });
    }
  }
  return [...merged.values()];
}

function isSection232Code(code) {
  return isVehiclePartsSection232Code(code) || /^9903\.(76|80|81|82|83|84|85)\.\d{2}$/.test(String(code || ""));
}

function isVehiclePartsSection232Code(code) {
  return vehiclePartsSection232CodeSet.has(String(code || ""));
}

function isPotentialSteelAluminum(row) {
  const hts = String(row.htsno || "").replace(/\./g, "");
  const description = `${row.description || ""} ${row.descriptionZh || ""}`.toLowerCase();
  return /^(72|73|76|83)/.test(hts) || /steel|iron|aluminum|aluminium|铝|钢|铁/.test(description);
}

function getSection232CodeHint(row) {
  const hts = String(row.htsno || "").replace(/\./g, "");
  if (/^(72|73)/.test(hts)) {
    return "9903.81/9903.82 钢铁及衍生品";
  }
  if (/^76/.test(hts)) {
    return "9903.85/9903.82 铝及衍生品";
  }
  return "多组 9903 编码";
}

function formatRateDisplay(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (/^free$/i.test(text)) {
    return "Free (0%)";
  }
  if (/^no change\.?$/i.test(text)) {
    return "No change";
  }
  return text;
}

function formatMiniRateDisplay(value) {
  const text = String(value || "").trim();
  if (/^free$/i.test(text)) {
    return "Free";
  }
  return formatRateDisplay(value);
}

function normalizeRuntimeAdditionalDutyCodes(row, codes = []) {
  const digits = normalizeStaticHtsDigits(row?.htsno);
  const values = new Set((Array.isArray(codes) ? codes : [codes]).filter(Boolean).map(String));
  if (!digits) {
    return [...values].sort();
  }

  for (const rule of china301Note20gSeatingOverrides) {
    if (!digits.startsWith(rule.prefix)) {
      continue;
    }
    if ((rule.exclude || []).some((excluded) => digits.startsWith(excluded))) {
      values.delete(rule.code);
    } else {
      values.add(rule.code);
    }
  }
  return [...values].sort();
}

function getCompoundGeneralDutyParts(compound) {
  if (!compound) {
    return [];
  }

  return [
    compound.fixedEach
      ? `每件固定税 ${money.format(compound.fixedEach)}`
      : "",
    compound.caseRate
      ? `机芯/外壳 ${formatRateNumber(compound.caseRate)}%`
      : "",
    compound.strapRate
      ? `表带/表链 ${formatRateNumber(compound.strapRate)}%`
      : "",
    compound.batteryRate
      ? `电池 ${formatRateNumber(compound.batteryRate)}%`
      : ""
  ].filter(Boolean);
}

function getCompoundGeneralDutyUsageParts(compound) {
  if (!compound) {
    return [];
  }

  return [
    compound.fixedEach
      ? `每件按 ${money.format(compound.fixedEach)} 固定税`
      : "",
    compound.caseRate
      ? `机芯/外壳价值适用 ${formatRateNumber(compound.caseRate)}%`
      : "",
    compound.strapRate
      ? `表带/表链价值适用 ${formatRateNumber(compound.strapRate)}%`
      : "",
    compound.batteryRate
      ? `电池价值适用 ${formatRateNumber(compound.batteryRate)}%`
      : ""
  ].filter(Boolean);
}

function getGeneralRateNote(row, mode = "detail") {
  const compound = parseCompoundGeneralDuty(row?.general);
  if (!compound) {
    return "";
  }

  const parts = getCompoundGeneralDutyUsageParts(compound).join("，");
  if (mode === "table") {
    return `复合普通税率：${parts}；不含对应部件时该部分按 0。`;
  }

  return `官方基础普通税率按部件价值拆分：${parts}。商品不含对应部件或该部件价值为 0 时，该部分税额按 0 估算。`;
}

function renderGeneralRateCell(row) {
  const rate = formatRateDisplay(row?.general) || "--";
  const note = getGeneralRateNote(row, "table");
  return `
    <span>${escapeHtml(rate)}</span>
    ${note ? `<small class="rate-note table-rate-note">${escapeHtml(note)}</small>` : ""}
  `;
}

function renderGeneralRateDetail(row) {
  const rate = formatRateDisplay(row?.general) || "--";
  const note = getGeneralRateNote(row, "detail");
  return `
    <span>${escapeHtml(rate)}</span>
    ${note ? `<small class="rate-note detail-rate-note">${escapeHtml(note)}</small>` : ""}
  `;
}

function renderMiniGeneralRateNote(row) {
  if (!els.miniGeneralRateNote) {
    return;
  }

  const note = getGeneralRateNote(row, "detail");
  els.miniGeneralRateNote.textContent = note;
  els.miniGeneralRateNote.classList.toggle("hidden", !note);
}

function selectFirstSelectable() {
  const index = state.visibleRows.findIndex((row) => row.htsno);
  if (index >= 0) {
    selectRow(index);
  } else {
    state.selected = null;
    renderDetail(null);
  }
}

function selectRow(index) {
  const row = state.visibleRows[index];
  if (!row || !row.htsno) {
    return;
  }

  state.selected = row;
  renderRows(state.visibleRows);
  renderDetail(row);
  updateFeeRuleMatches(row);
  applyRate(row);
  loadAdditionalDuties(row);
  loadCottonAssessment(row);
}

function renderDetail(row) {
  if (!row) {
    state.additionalDutyRequestId += 1;
    state.additionalDutyBreakdown = [];
    state.compoundGeneralDuty = null;
    state.feeMatches = [];
    state.certificationMatches = [];
    state.manualAssessments = {};
    renderCompoundDutyPanel(null);
    renderFeeRulePanels();
    els.generalRate.readOnly = false;
    state.cottonAssessmentRequestId += 1;
    resetCottonAssessment("选择 HTS CODE 后自动检查棉费；其他专项费用可按官方或报关资料手动录入。");
    els.selectedCode.textContent = "未选择";
    els.selectedDescription.textContent = "从左侧结果选择一行。";
    renderClassificationPath(null);
    els.miniHsCode.textContent = "--";
    els.miniProductDescription.textContent = "从左侧结果选择一行。";
    els.effectiveRate.textContent = "--";
    els.miniGeneralRate.textContent = "--";
    renderMiniGeneralRateNote(null);
    els.surchargeRate.textContent = "--";
    els.surchargeBreakdown.textContent = "构成：未选择；不含普通关税及 MPF/HMF";
    els.restrictionList.textContent = "未选择商品";
    els.detailGeneral.innerHTML = "--";
    els.detailSpecial.textContent = "--";
    els.detailOther.textContent = "--";
    els.detailUnits.textContent = "--";
    els.additionalDutyList.textContent = "未选择商品";
    renderCertificationPanel(null);
    els.detailNotes.innerHTML = "";
    return;
  }

  els.selectedCode.textContent = row.htsno;
  els.selectedDescription.innerHTML = `<span class="zh-line">${escapeHtml(displayZhDescription(row))}</span>`;
  renderClassificationPath(row);
  els.miniHsCode.textContent = normalizeHtsCode(row.htsno);
  els.miniProductDescription.textContent = displayZhDescription(row);
  els.effectiveRate.textContent = formatMiniRateDisplay(row.general) || "--";
  els.miniGeneralRate.textContent = formatMiniRateDisplay(row.general) || "--";
  renderMiniGeneralRateNote(row);
  els.surchargeRate.textContent = "读取中";
  els.surchargeBreakdown.textContent = "正在核对 Chapter 99 附加税项";
  els.restrictionList.innerHTML = `<div class="restriction-empty">正在读取附加税项...</div>`;
  els.detailGeneral.innerHTML = renderGeneralRateDetail(row);
  els.detailSpecial.textContent = formatRateDisplay(row.special) || "--";
  els.detailOther.textContent = formatRateDisplay(row.other) || "--";
  els.detailUnits.textContent = row.units?.length ? row.units.join(", ") : "--";
  state.certificationMatches = matchCertificationRules(row, {
    query: getCertificationContextQuery(),
    epaFlags: state.epaFlags,
    fdaFlags: state.fdaFlags
  });
  renderCertificationPanel(row);

  const notes = [];
  if (row.additionalDuties) {
    notes.push(`Additional duties: ${row.additionalDuties}`);
  }
  if (row.quotaQuantity) {
    notes.push(`Quota: ${row.quotaQuantity}`);
  }
  if (row.effectivePeriod) {
    notes.push(`Effective: ${row.effectivePeriod}`);
  }
  for (const note of row.footnotes || []) {
    notes.push([note.columns, note.value].filter(Boolean).join(": "));
  }

  els.detailNotes.innerHTML = notes.map((note) => `<div class="note">${escapeHtml(note)}</div>`).join("");
}

function renderClassificationPath(row) {
  if (!els.classificationPath || !els.classificationPathList || !els.classificationEnglishList) {
    return;
  }

  const hierarchy = row ? [...(row.classificationPath || []), row] : [];
  const missingCount = hierarchy.filter((item) => !getPreferredDescriptionZh(item)).length;
  const translatedCount = hierarchy.length - missingCount;
  els.classificationPath.classList.toggle("hidden", !row);
  if (els.classificationDescriptionStatus) {
    els.classificationDescriptionStatus.textContent = missingCount
      ? `已显示 ${translatedCount} 项校核中文，${missingCount} 项保留官方英文`
      : `已整理 ${hierarchy.length} 级归类说明`;
    els.classificationDescriptionStatus.classList.remove("is-loading");
  }
  els.classificationPathList.innerHTML = hierarchy
    .map((item, index) => {
      const zh = getPreferredDescriptionZh(item) || "暂无校核中文译文（请参阅英文官方原文）";
      return `
        <li class="${index === hierarchy.length - 1 ? "is-leaf" : ""}">
          <span class="description-level-code">${escapeHtml(item.htsno || `第 ${index + 1} 级`)}</span>
          <strong>${escapeHtml(zh)}</strong>
        </li>
      `;
    })
    .join("");
  els.classificationEnglishList.innerHTML = hierarchy
    .map((item) => `
      <li>
        <span>${escapeHtml(item.htsno || "上级分类")}</span>
        <small>${escapeHtml(item.description || "--")}</small>
      </li>
    `)
    .join("");
}

function getCertificationContextQuery() {
  if (state.dataKind === "search") {
    return state.lastQuery;
  }
  return els.chapterFilter?.value?.trim() || "";
}

function renderCertificationPanel(row) {
  if (!els.certificationPanel || !els.certificationSummary || !els.certificationList) {
    return;
  }

  const matches = row ? state.certificationMatches || [] : [];
  els.certificationPanel.classList.toggle("hidden", !row);
  els.certificationSummary.textContent = summarizeCertificationMatches(matches);
  els.certificationList.innerHTML = matches.length
    ? matches.map(renderCertificationItem).join("")
    : `<div class="certification-empty">未命中明显认证/监管提示；仍建议按产品用途、材质、标签宣称和美国进口商要求复核。</div>`;
}

function renderCertificationItem(match, index) {
  const meta = getCertificationStatusMeta(match.status);
  return `
    <details class="certification-item ${escapeHtml(meta.className)}">
      <summary>
        <span>
          <strong>${escapeHtml(index + 1)}. ${escapeHtml(match.nameZh)}</strong>
          <small>${escapeHtml(match.agency)} · ${escapeHtml(match.nameEn)}</small>
        </span>
        <em>${escapeHtml(meta.label)}</em>
      </summary>
      <div class="certification-detail">
        <p>${escapeHtml(match.summary)}</p>
        <p>${escapeHtml(match.explanation)}</p>
        <small>命中依据：${escapeHtml(match.matchedBy || "HTS/关键词规则")}</small>
        <a href="${escapeHtml(match.sourceUrl)}" target="_blank" rel="noopener noreferrer">官方来源：${escapeHtml(match.sourceName)}</a>
      </div>
    </details>
  `;
}

async function loadAdditionalDuties(row) {
  const requestId = ++state.additionalDutyRequestId;
  let rules = buildAdditionalDutyRules(row);
  state.additionalDutyBreakdown = [];
  els.additionalRate.value = "0";
  els.additionalDutyList.innerHTML = `<div class="empty-mini">正在读取附加税规则...</div>`;
  els.surchargeRate.textContent = "读取中";
  els.surchargeBreakdown.textContent = "正在核对 Chapter 99 附加税项";
  els.restrictionList.innerHTML = `<div class="restriction-empty">正在读取附加税规则...</div>`;

  try {
    const section232 = await api(
      `/api/section-232?hts=${encodeURIComponent(row.htsno)}&general=${encodeURIComponent(row.general || "")}`
    );
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }
    const runtimeWoodMatches = getSection232WoodProductMatches(row);
    const rowSelectionKey = rowKey(row);
    const vehicleChoice = resolveVehiclePartsDutyChoice(
      section232.value || [],
      state.vehicleDutySelections.get(rowSelectionKey) || ""
    );
    if (vehicleChoice.hasVehicleChoices) {
      state.vehicleDutySelections.set(rowSelectionKey, vehicleChoice.selectedChoice);
    }
    const section232Matches = mergeSection232Matches([
      ...runtimeWoodMatches,
      ...(vehicleChoice.matches || [])
    ]);
    const appliedChapter99Rules = getAppliedChapter99Rules(row, {
      section232Matches,
      appliedChapter99Rules: getSelectedVehicleChapter99Rules(vehicleChoice)
    });
    const policyContext = {
      section232Matches,
      vehicleDutyChoice: vehicleChoice.selectedChoice,
      appliedChapter99Rules
    };
    rules = mergeAdditionalDutyRules([
      ...buildAdditionalDutyRules(row, policyContext),
      ...buildSection232Rules(row, { ...section232, value: section232Matches })
    ]);
  } catch (error) {
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }
    const fallbackSection232Matches = getSection232WoodProductMatches(row);
    rules = mergeAdditionalDutyRules([
      ...buildAdditionalDutyRules(row, {
        section232Matches: fallbackSection232Matches,
        appliedChapter99Rules: getAppliedChapter99Rules(row, { section232Matches: fallbackSection232Matches })
      }),
      ...fallbackSection232Matches.map((match) => createSection232Rule(match)),
      ...(fallbackSection232Matches.length ? [] : [{
        code: "232-read-error",
        label: dutyRuleCatalog["232-steel-aluminum"].label,
        shortLabel: "232",
        rate: null,
        autoApply: false,
        summaryZh: "232 官方清单读取失败，未自动计入。",
        exemptionStatus: "读取失败",
        note: error.message,
        source: "section232"
      }])
    ]);
  }

  let adCvdMatches = [];
  try {
    const adCvd = await api(`/api/adcvd?hts=${encodeURIComponent(row.htsno)}`);
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }
    adCvdMatches = adCvd.value || [];
  } catch {
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }
    adCvdMatches = [];
  }

  const codes = rules
    .map((rule) => rule.code)
    .filter((code) => /^99\d{2}\.\d{2}\.\d{2}$/.test(code));

  if (!rules.length) {
    state.additionalDutyBreakdown = [];
    const adCvdItems = adCvdMatches.map(renderAdCvdRestrictionItem);
    els.additionalDutyList.innerHTML = row.additionalDuties
      ? `<div class="additional-duty-item"><strong>官方附加税字段</strong><p>${escapeHtml(row.additionalDuties)}</p></div>`
      : `<div class="empty-mini">未从脚注提取到 Chapter 99 附加税项。</div>`;
    els.surchargeRate.textContent = "--";
    els.surchargeBreakdown.textContent = "未自动计入附加税；不含普通关税及 MPF/HMF";
    els.restrictionList.innerHTML = adCvdItems.length
      ? adCvdItems.join("")
      : row.additionalDuties
      ? `<div class="restriction-empty">${escapeHtml(row.additionalDuties)}</div>`
      : `<div class="restriction-empty">未从脚注提取到 Chapter 99 附加税项。</div>`;
    els.calcMessage.textContent = `${state.baseRateMessage} 未提取到可自动带入的附加税率。`;
    calculate();
    return;
  }

  try {
    const data = codes.length
      ? await api(`/api/additional-duties?codes=${encodeURIComponent(codes.join(","))}`)
      : { value: [] };
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }

    const rowsByCode = new Map((data.value || []).map((item) => [item.htsno, item]));

    let additionalRate = 0;
    const additionalDutyBreakdown = [];
    const rateSummaries = [];
    const additionalDutyItems = [];
    const restrictionItems = [];

    for (const rule of rules) {
      const item = rowsByCode.get(rule.code) || {
        htsno: rule.code,
        descriptionZh: rule.note,
        description: rule.note,
        general: rule.rate == null ? "" : `The duty provided in the applicable subheading + ${rule.rate}%`
      };
      const parsed = rule.rate == null ? parseAdditionalPercent(item.general) : { auto: true, rate: rule.rate };
      const shouldAutoApply = rule.autoApply && parsed.auto && parsed.rate > 0;
      if (shouldAutoApply) {
        additionalRate += parsed.rate;
        additionalDutyBreakdown.push({
          group: rule.group || rule.shortLabel || "CH99",
          label: rule.label || "Chapter 99",
          shortLabel: rule.shortLabel || rule.group || "CH99",
          displayLabel: rule.material?.shortLabel
            ? `${rule.shortLabel || rule.group || "232"}-${rule.material.shortLabel}`
            : rule.shortLabel || rule.group || "CH99",
          code: item.htsno || rule.code || "",
          rate: parsed.rate
        });
        rateSummaries.push(`${rule.label} ${rule.code}: +${formatRateNumber(parsed.rate)}%`);
      }
      additionalDutyItems.push(renderAdditionalDutyItem(item, parsed, rule, shouldAutoApply));
      restrictionItems.push({
        rule,
        applied: shouldAutoApply,
        html: renderRestrictionItem(item, parsed, rule, shouldAutoApply)
      });
    }

    const renderedRestrictionItems = renderRestrictionGroups(restrictionItems);
    renderedRestrictionItems.push(...adCvdMatches.map(renderAdCvdRestrictionItem));

    els.additionalDutyList.innerHTML = additionalDutyItems.join("");
    els.restrictionList.innerHTML = renderedRestrictionItems.join("");

    state.additionalDutyBreakdown = mergeAdditionalDutyBreakdown(additionalDutyBreakdown);
    els.surchargeRate.textContent = state.additionalDutyBreakdown.length
      ? `${formatRateNumber(additionalRate)}%`
      : "--";
    els.surchargeBreakdown.textContent = state.additionalDutyBreakdown.length
      ? `构成：${state.additionalDutyBreakdown
          .map((entry) => `${entry.displayLabel || entry.shortLabel} ${formatRateNumber(entry.rate)}%`)
          .join(" + ")}；不含普通关税及 MPF/HMF`
      : "未自动计入附加税；不含普通关税及 MPF/HMF";
    els.additionalRate.value = String(roundRate(additionalRate));
    els.calcMessage.textContent = rateSummaries.length
      ? `${state.baseRateMessage} 已带入附加税项 ${rateSummaries.join("，")}；请确认原产国、豁免和适用条件。`
      : `${state.baseRateMessage} 已列出附加税项，但未自动识别出可计算的百分比。`;
    calculate();
  } catch (error) {
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }
    els.additionalDutyList.innerHTML = `<div class="empty-mini">附加税项读取失败：${escapeHtml(error.message)}</div>`;
    els.surchargeRate.textContent = "--";
    els.surchargeBreakdown.textContent = "附加税项读取失败；不含普通关税及 MPF/HMF";
    els.restrictionList.innerHTML = `<div class="restriction-empty">附加税项读取失败：${escapeHtml(error.message)}</div>`;
    els.calcMessage.textContent = `${state.baseRateMessage} 附加税项读取失败。`;
    state.additionalDutyBreakdown = [];
    calculate();
  }
}

async function loadCottonAssessment(row) {
  const requestId = ++state.cottonAssessmentRequestId;
  resetCottonAssessment("正在检查 eCFR 棉费表...");

  try {
    const data = await api(`/api/cotton-assessment?hts=${encodeURIComponent(row.htsno)}`);
    if (requestId !== state.cottonAssessmentRequestId) {
      return;
    }

    const match = data.value?.[0];
    if (match) {
      state.cottonAssessment = match;
      els.cottonFeeEnabled.checked = true;
      els.cottonFeeRate.value = formatDecimal(match.usdPerKg, 6);
      els.assessmentNotice.textContent =
        `棉费命中 ${match.hts || row.htsno}：${formatDecimal(match.centsPerKg, 4)} cents/kg，已折算为 $${formatDecimal(match.usdPerKg, 6)}/kg；请输入计费重量。`;
      calculate();
      return;
    }

    const potential = isPotentialCotton(row);
    els.assessmentNotice.textContent = potential
      ? "商品可能含棉但未精确命中 eCFR 棉费表；请按 HTS、材质和净重手动确认棉费或其他商品性费用。"
      : "未命中棉费表。类似专项费用还包括 Beef、Pork、Honey、Sugar、Potato、Mushroom、Watermelon、AD/CVD、消费税等。";
    calculate();
  } catch (error) {
    if (requestId !== state.cottonAssessmentRequestId) {
      return;
    }
    els.assessmentNotice.textContent = `棉费表读取失败：${error.message}。可手动录入棉费或其他专项费用。`;
    calculate();
  }
}

function resetCottonAssessment(message) {
  state.cottonAssessment = null;
  els.cottonFeeEnabled.checked = false;
  els.cottonFeeRate.value = "0";
  els.assessmentNotice.textContent = message;
  calculate();
}

function isPotentialCotton(row) {
  const hts = normalizeHtsCode(row.htsno);
  const description = `${row.description || ""} ${row.descriptionZh || ""}`.toLowerCase();
  return /^52/.test(hts) || /cotton|棉/.test(description);
}

function updateFeeRuleMatches(row, options = {}) {
  const previous = options.preserveManualValues ? state.manualAssessments : {};
  state.feeMatches = matchFeeRules(row, {
    transportMode: state.transportMode,
    clearanceMode: state.clearanceMode
  });
  state.manualAssessments = buildManualAssessmentState(state.feeMatches, previous);
  renderFeeRulePanels();
}

function renderFeeRulePanels() {
  renderFeeMatchPanel();
  renderManualAssessmentPanel();
}

function renderFeeMatchPanel() {
  if (!els.feeMatchPanel || !els.feeMatchList) {
    return;
  }

  const matches = state.feeMatches || [];
  els.feeMatchPanel.classList.toggle("hidden", matches.length === 0);
  els.feeMatchList.innerHTML = matches
    .map((match) => {
      const status = getFeeMatchStatus(match);
      return `
        <div class="fee-match-item ${escapeHtml(match.implementation)}">
          <div>
            <strong>${escapeHtml(match.sequence)}. ${escapeHtml(match.nameZh)}</strong>
            <small>${escapeHtml(match.code)} · ${escapeHtml(match.nameEn)}</small>
            <small>${escapeHtml(match.note || "")}</small>
          </div>
          <span title="${escapeHtml(match.matchedBy || "")}">${escapeHtml(status)}</span>
        </div>
      `;
    })
    .join("");
}

function getFeeMatchStatus(match) {
  if (match.implementation === "managed") {
    return "已接入";
  }
  if (isManualAssessmentMatch(match)) {
    return "待录入";
  }
  return "需复核";
}

function renderManualAssessmentPanel() {
  if (!els.manualAssessmentPanel || !els.manualAssessmentList) {
    return;
  }

  const entries = Object.values(state.manualAssessments || {});
  els.manualAssessmentPanel.classList.toggle("hidden", entries.length === 0);
  els.manualAssessmentList.innerHTML = entries
    .map((entry) => renderManualAssessmentInput(entry))
    .join("");
}

function renderManualAssessmentInput(entry) {
  const match = entry.match;
  if (match.calculation?.type === "manual-amount") {
    return `
      <div class="manual-assessment-row" data-fee-id="${escapeHtml(match.id)}">
        <label class="check-row">
          <input type="checkbox" data-fee-field="enabled" ${entry.enabled ? "checked" : ""} />
          ${escapeHtml(match.nameZh)}
        </label>
        <label>
          固定金额 USD
          <input type="number" min="0" step="0.01" value="${escapeHtml(entry.amount || "")}" data-fee-field="amount" placeholder="0.00" />
        </label>
        <small>${escapeHtml(match.code)} · ${escapeHtml(match.note || "")}</small>
      </div>
    `;
  }

  return `
    <div class="manual-assessment-row" data-fee-id="${escapeHtml(match.id)}">
      <label class="check-row">
        <input type="checkbox" data-fee-field="enabled" ${entry.enabled ? "checked" : ""} />
        ${escapeHtml(match.nameZh)}
      </label>
      <label>
        费率 USD/${escapeHtml(match.calculation?.unit || "unit")}
        <input type="number" min="0" step="0.000001" value="${escapeHtml(entry.rate || "")}" data-fee-field="rate" placeholder="0" />
      </label>
      <label>
        数量 ${escapeHtml(match.calculation?.unit || "unit")}
        <input type="number" min="0" step="0.001" value="${escapeHtml(entry.quantity || "")}" data-fee-field="quantity" placeholder="0" />
      </label>
      <small>${escapeHtml(match.code)} · ${escapeHtml(formatFeeInputLabel(match))} · ${escapeHtml(match.note || "")}</small>
    </div>
  `;
}

function handleManualAssessmentInput(event) {
  const field = event.target?.dataset?.feeField;
  const row = event.target?.closest?.("[data-fee-id]");
  if (!field || !row) {
    return;
  }

  const entry = state.manualAssessments[row.dataset.feeId];
  if (!entry) {
    return;
  }

  if (field === "enabled") {
    entry.enabled = event.target.checked;
  } else {
    entry[field] = event.target.value;
  }
  calculate();
}

function renderAdditionalDutyItem(item, parsed, rule, applied) {
  const displayCode = item.htsno || rule.code || "Chapter 99";
  const isSection232ZeroRate = rule.source === "section232" && parsed.auto && parsed.rate === 0;
  const rateLabel = rule.exempt
    ? parsed.auto && parsed.rate > 0
      ? `${formatRateNumber(parsed.rate)}% 已豁免`
      : "豁免"
    : parsed.auto && parsed.rate > 0
    ? `+${parsed.rate}%`
    : isSection232ZeroRate
    ? "0% 条件免加征"
    : "需人工确认";
  const applyLabel = rule.exempt
    ? "豁免，未计入估算"
    : isSection232ZeroRate && rule.choiceSelected
      ? "已选择0%条件分支"
      : applied
        ? "已计入估算"
        : "未自动计入";
  const englishLine = rule.summaryZh ? "" : `<p class="en-line">${escapeHtml(item.description || "--")}</p>`;
  const exemptionBasis = rule.exempt && rule.exemptionCode
    ? `<small class="additional-duty-exemption-basis"><strong>排除依据：</strong>${escapeHtml(rule.exemptionCode)}${rule.exemptionMatchedHts ? ` · 命中 HTS ${escapeHtml(rule.exemptionMatchedHts)}` : ""}</small>`
    : "";
  return `
    <div class="additional-duty-item ${applied ? "applied" : "not-applied"}">
      <div>
        <strong>${escapeHtml(rule.label)} <span>${escapeHtml(displayCode)}</span></strong>
        <p class="zh-line">${escapeHtml(rule.summaryZh || item.descriptionZh || item.description || "暂无中文释义")}</p>
        ${englishLine}
        ${exemptionBasis}
        <small>General: ${escapeHtml(item.general || "--")}</small>
        <small>${escapeHtml(rule.note)} ${escapeHtml(applyLabel)}</small>
      </div>
      <span class="rate-pill">${escapeHtml(rateLabel)}</span>
    </div>
  `;
}

function renderRestrictionItem(item, parsed, rule, applied) {
  const isSection232Miss = rule.source === "section232" && !/^99\d{2}\.\d{2}\.\d{2}$/.test(rule.code || "");
  const displayCode = item.htsno || rule.code || "Chapter 99";
  const code = isSection232Miss ? "未命中" : compactChapter99Code(displayCode);
  const isSection232ZeroRate = rule.source === "section232" && parsed.auto && parsed.rate === 0;
  const selectedZeroRateChoice = isSection232ZeroRate && Boolean(rule.choiceSelected);
  const rateLabel = rule.exempt
    ? parsed.auto && parsed.rate > 0
      ? `${formatRateNumber(parsed.rate)}%`
      : "豁免"
    : isSection232Miss
    ? "不适用"
    : parsed.auto && parsed.rate > 0
    ? `${formatRateNumber(parsed.rate)}%`
    : isSection232ZeroRate
    ? "0%"
    : "需判断";
  const isChoiceOption = Boolean(rule.choiceGroup);
  const choiceSelected = isChoiceOption ? Boolean(rule.choiceSelected) : false;
  const status = rule.exempt
    ? choiceSelected
      ? "已选择·另有排除"
      : "已豁免"
    : isChoiceOption
    ? choiceSelected && applied
      ? "当前计入"
      : selectedZeroRateChoice
        ? "当前选择"
      : choiceSelected
        ? "已选择·未计入"
        : "备选未计入"
    : rule.exemptionStatus || (applied ? "需复核" : "需确认");
  const title = `${rule.note || "需按申报条件复核"} ${applied ? "已计入估算。" : "未自动计入估算。"}`;
  const materialBadge = rule.material?.shortLabel
    ? `<em class="material-badge">${escapeHtml(rule.material.shortLabel)}</em>`
    : "";
  const exemptionDetails = renderForcedLaborExemptionDetails(rule);
  const exemptionSummary = rule.exempt && rule.exemptionCode
    ? `
      <div class="restriction-exemption-summary">
        <span><strong>排除依据</strong> ${escapeHtml(compactChapter99Code(rule.exemptionCode))}</span>
        ${rule.exemptionMatchedHts ? `<span><strong>命中 HTS</strong> ${escapeHtml(rule.exemptionMatchedHts)}</span>` : ""}
        <b>本项不计入</b>
      </div>
    `
    : "";
  const choiceControl = isChoiceOption
    ? `<input class="restriction-choice-radio" type="radio" name="vehicle-remedy-choice" value="${escapeHtml(rule.choiceValue || rule.code || "")}" data-vehicle-duty-choice ${choiceSelected ? "checked" : ""} aria-label="选择${escapeHtml(rule.label || "该税项")}">`
    : "";

  return `
    <div class="restriction-item ${applied ? "applied" : "not-applied"}${isChoiceOption ? " choice-option" : ""}">
      ${choiceControl}
      <div class="restriction-main">
        <strong>${escapeHtml(rule.label)}${rule.exempt ? "（征税依据）" : ""}:</strong>
        ${materialBadge}
        <span>${escapeHtml(code)}</span>
        <b>${escapeHtml(rateLabel)}</b>
      </div>
      <div class="restriction-status">
        <span>${escapeHtml(status)}</span>
        <button class="help-dot" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">?</button>
      </div>
      ${exemptionSummary}
      ${exemptionDetails}
    </div>
  `;
}

function renderRestrictionGroups(items) {
  const emittedGroups = new Set();
  const rendered = [];

  for (const item of items) {
    const group = item.rule.choiceGroup || "";
    if (!group) {
      rendered.push(item.html);
      continue;
    }
    if (emittedGroups.has(group)) {
      continue;
    }

    emittedGroups.add(group);
    const options = items
      .filter((candidate) => candidate.rule.choiceGroup === group)
      .sort((a, b) => (a.rule.choiceRank || 0) - (b.rule.choiceRank || 0));
    rendered.push(renderRestrictionChoiceGroup(options));
  }

  return rendered;
}

function renderRestrictionChoiceGroup(options) {
  const selected = options.find((option) => option.rule.choiceSelected);
  const selectedCode = selected?.rule.code || "";
  const selectedRate = selected?.rule.rate == null ? "" : `${formatRateNumber(selected.rule.rate)}%`;
  const selectedIsZeroRate = selected?.rule.source === "section232" && Number(selected.rule.rate) === 0;
  const selectedLabel = selected
    ? `${selected.rule.label} ${compactChapter99Code(selectedCode)} ${selectedRate}`.trim()
    : "尚未选择";
  const summary = selected?.rule.choiceValue === NON_VEHICLE_DUTY_CHOICE
    ? selected.applied
      ? `当前按非车辆零部件用途计入 ${selectedLabel}；车辆232候选项不计入。`
      : `当前选择非车辆零部件用途，但 ${selectedLabel} 另有排除规则，暂不计入。`
    : selectedIsZeroRate
      ? `当前选择 ${selectedLabel}，该分支为232条件免加征，估算不计入额外税率。`
    : selected
      ? `当前按实际车型计入 ${selectedLabel}；新301强迫劳动税由 9903.05.90 排除。`
      : "当前未自动计入候选项，请按商品实际用途选择。";
  const choiceLabel = formatChoiceCount(options.length);
  const help = "新301强迫劳动税与车辆零部件 Section 232 税项按商品用途、车型或USMCA资格择一；9903.94.06 为条件免加征分支，选择车辆232时 9903.05.90 会排除新301税项。";

  return `
    <div class="restriction-choice-group" role="radiogroup" aria-label="新301与车辆零配件232税项择一">
      <div class="restriction-choice-heading">
        <span>
          <strong>${escapeHtml(choiceLabel)}</strong>
          <small>按商品实际用途选择一项，税金会同步重算</small>
        </span>
        <button class="help-dot" type="button" title="${escapeHtml(help)}" aria-label="${escapeHtml(help)}">?</button>
      </div>
      <div class="restriction-choice-options">
        ${options.map((option) => option.html).join("")}
      </div>
      <p class="restriction-choice-summary">${escapeHtml(summary)} 不重复加征。</p>
    </div>
  `;
}

function formatChoiceCount(count) {
  return ({ 2: "二选一", 3: "三选一", 4: "四选一" })[count] || `${count}选一`;
}

function handleVehicleDutyChoiceChange(event) {
  const input = event.target.closest("[data-vehicle-duty-choice]");
  if (!input || !state.selected) {
    return;
  }
  state.vehicleDutySelections.set(rowKey(state.selected), input.value);
  loadAdditionalDuties(state.selected);
}

function renderForcedLaborExemptionDetails(rule) {
  const possible = rule.possibleExemptions || [];
  if (!rule.exempt && !possible.length) {
    return "";
  }

  const heading = rule.exempt
    ? `${rule.exemptionCode} 排除条款详情`
    : `${possible.length} 项可能排除规则待核`;
  const exactItem = rule.exempt
    ? `
      <li>
        <strong>${escapeHtml(rule.exemptionCode)}</strong>
        <span>${escapeHtml(rule.summaryZh || "")}</span>
        <small>${escapeHtml(rule.note || "")}</small>
      </li>
    `
    : "";
  const possibleItems = (rule.exempt ? [] : possible)
    .map((item) => `
      <li>
        <strong>${escapeHtml(item.code)} ${escapeHtml(item.titleZh || "")}</strong>
        <span>${escapeHtml(item.summaryZh || "")}</span>
        <small>${escapeHtml([item.conditionZh, `截止日：${item.expiryLabel}`].filter(Boolean).join("；"))}</small>
      </li>
    `)
    .join("");
  const sourceLink = rule.exemptionSourceUrl
    ? `<a href="${escapeHtml(rule.exemptionSourceUrl)}" target="_blank" rel="noopener noreferrer">打开CBP官方说明</a>`
    : "";

  return `
    <details class="forced-labor-exemption-detail">
      <summary>${escapeHtml(heading)}</summary>
      <ul>${exactItem}${possibleItems}</ul>
      ${sourceLink}
    </details>
  `;
}

async function attachClassificationPaths(rows, force = false) {
  if (!rows.length || rows.every((row) => Array.isArray(row.classificationPath))) {
    return rows;
  }

  try {
    const index = await loadStaticData("hts-search-index.json", force);
    const candidates = buildStaticSearchCandidates(index.value || []);
    const byKey = new Map(candidates.map((candidate) => [
      classificationRowKey(candidate.row),
      candidate.row.classificationPath || []
    ]));
    return rows.map((row) => ({
      ...row,
      classificationPath: byKey.get(classificationRowKey(row)) || []
    }));
  } catch {
    return rows.map((row) => ({ ...row, classificationPath: [] }));
  }
}

function classificationRowKey(row) {
  return `${normalizeStaticHtsDigits(row?.htsno)}|${String(row?.description || "").trim().toLowerCase()}`;
}

function renderAdCvdRestrictionItem(match) {
  const types = match.orderTypes?.length ? match.orderTypes.join("/") : "AD/CVD";
  const cases = match.caseNumbers?.length ? match.caseNumbers.join(" / ") : "案号待核";
  const product = [match.productZh, match.productEn].filter(Boolean).join(" / ");
  const matchedHts = match.matchedHts && match.matchedHts !== match.htsCode
    ? `${match.htsCode || "--"} → ${match.matchedHts}`
    : match.htsCode || "--";
  const title = [
    product,
    match.htsAliasNote,
    match.reason,
    "HTS 仅作清单匹配提示，是否适用以 DOC/CBP scope 及原产国、产品规格为准；税率需按案件现金保证金率另行确认。"
  ].filter(Boolean).join(" ");

  return `
    <div class="restriction-item adcvd-hit">
      <div class="restriction-main">
        <strong>AD/CVD-反倾销反补贴:</strong>
        <em class="material-badge">${escapeHtml(types)}</em>
        <span>${escapeHtml(matchedHts)}</span>
        <b>${escapeHtml(cases)}</b>
        <small>${escapeHtml(product || "产品范围需复核")}</small>
      </div>
      <div class="restriction-status">
        <span>命中清单</span>
        <button class="help-dot" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">?</button>
      </div>
    </div>
  `;
}

function applyRate(row) {
  const compound = parseCompoundGeneralDuty(row.general);
  state.compoundGeneralDuty = compound;
  renderCompoundDutyPanel(compound);

  if (compound) {
    els.generalRate.value = "0";
    els.generalRate.readOnly = true;
    state.baseRateMessage = `已从 ${row.htsno} 识别基础复合普通税率（${getCompoundGeneralDutyParts(compound).join("，")}），请按实际构成填写对应价值后计算。`;
    els.calcMessage.textContent = state.baseRateMessage;
    calculate();
    return;
  }

  els.generalRate.readOnly = false;
  const parsed = parsePercentRate(row.general);
  if (parsed.auto) {
    els.generalRate.value = String(parsed.rate);
    state.baseRateMessage = `已从 ${row.htsno} 带入基础 General 税率 ${parsed.rate}%。`;
    els.calcMessage.textContent = state.baseRateMessage;
  } else {
    els.generalRate.value = "0";
    state.baseRateMessage = `${row.htsno} 的基础 General 税率为“${row.general || "--"}”，需要手动确认从价税率或固定税额。`;
    els.calcMessage.textContent = state.baseRateMessage;
  }
  calculate();
}

function renderCompoundDutyPanel(compound) {
  if (!els.compoundDutyPanel) {
    return;
  }

  els.compoundDutyPanel.classList.toggle("hidden", !compound);
  if (!compound) {
    els.compoundDutyFormula.textContent = "--";
    return;
  }

  if (!els.watchQuantity.value) {
    els.watchQuantity.value = "0";
  }
  if (!els.watchCaseValue.value) {
    els.watchCaseValue.value = "0";
  }
  if (!els.watchStrapValue.value) {
    els.watchStrapValue.value = "0";
  }
  if (!els.watchBatteryValue.value) {
    els.watchBatteryValue.value = "0";
  }

  els.compoundDutyFormula.textContent = compound.formula;
  const formulaParts = [
    compound.fixedEach ? `数量 × ${money.format(compound.fixedEach)}` : "",
    compound.caseRate ? `机芯/外壳价值 × ${formatRateNumber(compound.caseRate)}%` : "",
    compound.strapRate ? `表带/表链价值 × ${formatRateNumber(compound.strapRate)}%` : "",
    compound.batteryRate ? `电池价值 × ${formatRateNumber(compound.batteryRate)}%` : ""
  ].filter(Boolean);
  els.compoundDutyNotice.textContent =
    `计算式：${formulaParts.join(" + ")}。各部件价值请按发票、成本拆分或报关资料填写；不含的部件按 0 处理。`;
}

function parseCompoundGeneralDuty(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || !/%\s*on/i.test(text) || !/(movement|case|strap|band|bracelet|battery)/i.test(text)) {
    return null;
  }

  const centsMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:¢|cents?)\s*each/i);
  const dollarsMatch = text.match(/\$\s*(\d+(?:\.\d+)?)\s*each/i);
  const fixedEach = centsMatch
    ? Number(centsMatch[1]) / 100
    : dollarsMatch
    ? Number(dollarsMatch[1])
    : 0;

  const duty = {
    fixedEach,
    caseRate: 0,
    strapRate: 0,
    batteryRate: 0,
    formula: text
  };

  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*%\s*on\s+(?:the\s+)?([^+]+)/gi)) {
    const rate = Number(match[1]);
    const target = match[2].toLowerCase();
    if (target.includes("case") || target.includes("movement")) {
      duty.caseRate = rate;
    }
    if (/strap|band|bracelet/.test(target)) {
      duty.strapRate = rate;
    }
    if (target.includes("battery")) {
      duty.batteryRate = rate;
    }
  }

  return duty.fixedEach || duty.caseRate || duty.strapRate || duty.batteryRate ? duty : null;
}

function parsePercentRate(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || /^free$/i.test(text)) {
    return { auto: true, rate: 0 };
  }

  const percentMatches = text.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  const hasSpecific = /¢|cent|\/kg|\/l|\$|each|No\./i.test(text);
  if (percentMatches.length === 1 && !hasSpecific) {
    return { auto: true, rate: Number(percentMatches[0].replace("%", "").trim()) };
  }

  return { auto: false, rate: 0 };
}

function parseAdditionalPercent(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || /no change/i.test(text)) {
    return { auto: true, rate: 0 };
  }

  const plusMatches = [...text.matchAll(/\+\s*(\d+(?:\.\d+)?)\s*%/g)];
  if (plusMatches.length) {
    return {
      auto: true,
      rate: roundRate(plusMatches.reduce((sum, match) => sum + Number(match[1]), 0))
    };
  }

  const percentMatches = text.match(/(\d+(?:\.\d+)?)\s*%/g) || [];
  if (percentMatches.length === 1 && !/¢|cent|\/kg|\/l|\$|each|No\./i.test(text)) {
    return { auto: true, rate: Number(percentMatches[0].replace("%", "").trim()) };
  }

  return { auto: false, rate: 0 };
}

function roundRate(rate) {
  return Math.round((rate + Number.EPSILON) * 10000) / 10000;
}

function formatRateNumber(rate) {
  const rounded = roundRate(Number(rate) || 0);
  return String(rounded).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatDecimal(value, digits = 4) {
  const number = Number(value) || 0;
  return number.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function normalizeHtsCode(value) {
  return String(value || "--").replace(/\./g, "");
}

function compactChapter99Code(value) {
  return String(value || "--").replace(/\./g, "");
}

function buildCompoundGeneralDutyCalcLines(compound) {
  if (!compound) {
    return [];
  }

  const quantity = readNumber(els.watchQuantity);
  const caseValue = readNumber(els.watchCaseValue);
  const strapValue = readNumber(els.watchStrapValue);
  const batteryValue = readNumber(els.watchBatteryValue);

  return [
    {
      group: "general",
      shortLabel: "件数",
      label: "固定税额",
      displayName: "固定税额：数量",
      rateText: `${money.format(compound.fixedEach)} / No.`,
      amount: quantity * compound.fixedEach,
      active: compound.fixedEach > 0
    },
    {
      group: "general",
      shortLabel: "表壳",
      label: "机芯/外壳价值",
      displayName: "机芯/外壳价值",
      rateText: `${formatRateNumber(compound.caseRate)}%`,
      amount: caseValue * (compound.caseRate / 100),
      active: compound.caseRate > 0
    },
    {
      group: "general",
      shortLabel: "表带",
      label: "表带/表链价值",
      displayName: "表带/表链价值",
      rateText: `${formatRateNumber(compound.strapRate)}%`,
      amount: strapValue * (compound.strapRate / 100),
      active: compound.strapRate > 0
    },
    {
      group: "general",
      shortLabel: "电池",
      label: "电池价值",
      displayName: "电池价值",
      rateText: `${formatRateNumber(compound.batteryRate)}%`,
      amount: batteryValue * (compound.batteryRate / 100),
      active: compound.batteryRate > 0
    }
  ].filter((item) => item.active || item.amount > 0);
}

function buildAdditionalDutyCalcLines(value, additionalRate, specificDuty) {
  const autoItems = (state.additionalDutyBreakdown || [])
    .filter((item) => Number(item.rate) > 0)
    .map((item) => ({ ...item, rate: roundRate(item.rate) }));
  const autoRateTotal = roundRate(autoItems.reduce((sum, item) => sum + item.rate, 0));
  const lines = [];

  if (autoItems.length && autoRateTotal <= additionalRate + 0.0001) {
    for (const item of autoItems) {
      lines.push({
        ...item,
        amount: value * (item.rate / 100),
        rateText: `${formatRateNumber(item.rate)}%`
      });
    }

    const remainderRate = roundRate(additionalRate - autoRateTotal);
    if (remainderRate > 0.0001) {
      lines.push({
        group: "manual",
        shortLabel: "手动",
        label: "手动附加税 / 未拆分",
        code: "",
        rate: remainderRate,
        amount: value * (remainderRate / 100),
        rateText: `${formatRateNumber(remainderRate)}%`
      });
    }
  } else if (additionalRate > 0) {
    lines.push({
      group: "manual",
      shortLabel: "合计",
      label: autoItems.length ? "当前输入附加税合计" : "附加从价税",
      code: "",
      rate: additionalRate,
      amount: value * (additionalRate / 100),
      rateText: `${formatRateNumber(additionalRate)}%`
    });
  }

  if (specificDuty > 0) {
    lines.push({
      group: "specific",
      shortLabel: "固定",
      label: "固定税额",
      code: "",
      rate: null,
      amount: specificDuty,
      rateText: "固定金额"
    });
  }

  return lines;
}

function calculate() {
  const value = readNumber(els.customsValue);
  const generalRate = readNumber(els.generalRate);
  const additionalRate = readNumber(els.additionalRate);
  const specificDuty = readNumber(els.specificDuty);
  const clearanceFee = readNumber(els.clearanceFee);
  const cottonWeight = readNumber(els.cottonWeightKg);
  const cottonRate = readNumber(els.cottonFeeRate);
  const adCvdRate = readNumber(els.adCvdRate);
  const mpfRate = readNumber(els.mpfRate);
  const mpfMin = readNumber(els.mpfMin);
  const mpfMax = readNumber(els.mpfMax);
  const hmfRate = readNumber(els.hmfRate);
  const cottonFee = els.cottonFeeEnabled.checked
    ? cottonWeight * cottonRate
    : 0;
  const adCvd = value * (adCvdRate / 100);
  const exciseAmount = readNumber(els.exciseAmount);
  const pgaFeeAmount = readNumber(els.pgaFeeAmount);
  const manualAssessmentDetails = calculateManualAssessments(state.manualAssessments);
  const manualUserFeeDetails = manualAssessmentDetails.filter((item) => item.target === "user-fee");
  const manualExciseDetails = manualAssessmentDetails.filter((item) => item.target === "excise");
  const manualCommodityDetails = manualAssessmentDetails.filter((item) => item.target === "commodity");
  const manualUserFeeTotal = manualUserFeeDetails.reduce((sum, item) => sum + item.amount, 0);
  const manualExciseTotal = manualExciseDetails.reduce((sum, item) => sum + item.amount, 0);
  const manualCommodityTotal = manualCommodityDetails.reduce((sum, item) => sum + item.amount, 0);

  const compoundGeneralDutyDetails = buildCompoundGeneralDutyCalcLines(state.compoundGeneralDuty);
  const baseDuty = state.compoundGeneralDuty
    ? compoundGeneralDutyDetails.reduce((sum, item) => sum + item.amount, 0)
    : value * (generalRate / 100);
  const additionalDutyDetails = buildAdditionalDutyCalcLines(value, additionalRate, specificDuty);
  const extraDuty = additionalDutyDetails.length
    ? additionalDutyDetails.reduce((sum, item) => sum + item.amount, 0)
    : value * (additionalRate / 100) + specificDuty;

  let mpf = 0;
  if (els.mpfEnabled.checked) {
    const rawMpf = value * (mpfRate / 100);
    mpf = Math.min(Math.max(rawMpf, mpfMin), mpfMax || Number.POSITIVE_INFINITY);
  }

  const hmf = els.hmfEnabled.checked ? value * (hmfRate / 100) : 0;
  const feeTotal = mpf + hmf + manualUserFeeTotal;
  const specialAssessmentTotal = cottonFee + adCvd + exciseAmount + manualExciseTotal + pgaFeeAmount + manualCommodityTotal;
  const total = baseDuty + extraDuty + feeTotal + specialAssessmentTotal + clearanceFee;

  els.baseDuty.textContent = money.format(baseDuty);
  els.extraDuty.textContent = money.format(extraDuty);
  renderAdditionalDutySplit(additionalDutyDetails);
  els.fees.textContent = money.format(feeTotal);
  els.specialAssessments.textContent = money.format(specialAssessmentTotal);
  els.clearanceFeeOutput.textContent = money.format(clearanceFee);
  els.totalDuty.textContent = money.format(total);
  renderTaxBreakdown({
    value,
    generalRate,
    compoundGeneralDuty: state.compoundGeneralDuty,
    compoundGeneralDutyDetails,
    additionalRate,
    specificDuty,
    additionalDutyDetails,
    baseDuty,
    extraDuty,
    mpf,
    mpfRate,
    mpfMin,
    mpfMax,
    hmf,
    hmfRate,
    cottonFee,
    cottonWeight,
    cottonRate,
    adCvd,
    adCvdRate,
    exciseAmount,
    pgaFeeAmount,
    manualUserFeeDetails,
    manualUserFeeTotal,
    manualExciseDetails,
    manualExciseTotal,
    manualCommodityDetails,
    manualCommodityTotal,
    clearanceFee,
    total
  });
}

function renderAdditionalDutySplit(details) {
  if (!els.additionalDutySplit) {
    return;
  }

  const visibleDetails = details.filter((item) => Math.abs(item.amount) > 0.000001);
  els.additionalDutySplit.classList.toggle("hidden", visibleDetails.length === 0);
  els.additionalDutySplit.innerHTML = visibleDetails
    .map((item) => `
      <li>
        <span>${escapeHtml(formatAdditionalDutyName(item))}</span>
        <em>${escapeHtml(item.rateText || "--")}</em>
        <strong>${escapeHtml(money.format(item.amount))}</strong>
      </li>
    `)
    .join("");
}

function formatAdditionalDutyName(item) {
  const code = item.code ? ` ${compactChapter99Code(item.code)}` : "";
  return `${item.shortLabel || item.group || "CH99"} ${item.label || "附加税"}${code}`;
}

function formatTaxChildName(item) {
  return item.displayName || formatAdditionalDutyName(item);
}

function renderTaxBreakdown(calc) {
  const cottonSource = state.cottonAssessment
    ? `eCFR 棉费表命中 ${state.cottonAssessment.hts || state.selected?.htsno || "--"}`
    : "未自动命中时可按报关资料手动录入";
  const lines = [
    {
      title: "进口税",
      subtitle: "General Rate of Duty",
      rate: calc.compoundGeneralDuty
        ? `复合税率：${calc.compoundGeneralDuty.formula}`
        : `适用税率：${formatRateNumber(calc.generalRate)}%`,
      amount: calc.baseDuty,
      note: calc.compoundGeneralDuty
        ? "按数量、表壳价值、表带/表链价值和电池价值分项计算。"
        : `计费基础：${money.format(calc.value)}`,
      children: calc.compoundGeneralDutyDetails
    },
    {
      title: "加征",
      subtitle: "Imposing additional taxes",
      rate: `税率：${formatRateNumber(calc.additionalRate)}%${calc.specificDuty ? ` + 固定 ${money.format(calc.specificDuty)}` : ""}`,
      amount: calc.extraDuty,
      note: "301、122、232 等从价附加税自动带入；未识别或条件性税项需人工复核。",
      children: calc.additionalDutyDetails
    },
    {
      title: "商品加工费",
      subtitle: "499-MPF",
      rate: els.mpfEnabled.checked ? `税率：${formatRateNumber(calc.mpfRate)}%` : "未启用",
      amount: calc.mpf,
      note: `当前设置最低 ${money.format(calc.mpfMin)}，最高 ${money.format(calc.mpfMax)}。`
    },
    {
      title: "港口维护费",
      subtitle: "501-HMF",
      rate: els.hmfEnabled.checked ? `税率：${formatRateNumber(calc.hmfRate)}%` : "未启用",
      amount: calc.hmf,
      note: state.transportMode === "ocean" ? "海运默认纳入 HMF 估算。" : "空运通常不纳入 HMF。"
    },
    {
      title: "其他用户费",
      subtitle: "CBP User Fees",
      rate: calc.manualUserFeeTotal ? "已录入" : "未录入",
      amount: calc.manualUserFeeTotal,
      note: "适用于非正式进口费、应税邮件费、人工申报附加费等按申报场景确认的用户费。",
      children: calc.manualUserFeeDetails
    },
    {
      title: "棉费",
      subtitle: "Cotton Import Assessment",
      rate: els.cottonFeeEnabled.checked
        ? `${formatDecimal(calc.cottonWeight, 3)} kg × $${formatDecimal(calc.cottonRate, 6)}/kg`
        : "未启用",
      amount: calc.cottonFee,
      note: cottonSource
    },
    {
      title: "反倾销/反补贴",
      subtitle: "AD/CVD cash deposit",
      rate: calc.adCvdRate ? `税率：${formatRateNumber(calc.adCvdRate)}%` : "未录入",
      amount: calc.adCvd,
      note: "按 Commerce/CBP 案件税率手动录入，通常不由 HTS 普通税率自动判断。"
    },
    {
      title: "消费税/固定税费",
      subtitle: "Excise / Specific fees",
      rate: calc.exciseAmount || calc.manualExciseTotal ? "已录入" : "未录入",
      amount: calc.exciseAmount + calc.manualExciseTotal,
      note: "适用于酒类、烟草、燃油等可能存在独立消费税或固定税费的商品。",
      children: [
        ...(calc.exciseAmount ? [{
          displayName: "手动消费税/固定税费",
          rateText: "固定金额",
          amount: calc.exciseAmount
        }] : []),
        ...(calc.manualExciseDetails || [])
      ]
    },
    {
      title: "PGA/其他商品费",
      subtitle: "PGA / Commodity assessments",
      rate: calc.pgaFeeAmount || calc.manualCommodityTotal ? "已录入" : "未录入",
      amount: calc.pgaFeeAmount + calc.manualCommodityTotal,
      note: "可用于 Beef、Pork、Honey、Sugar、Potato、Mushroom、Watermelon 等商品性评估费。",
      children: [
        ...(calc.pgaFeeAmount ? [{
          displayName: "手动 PGA/其他商品费",
          rateText: "固定金额",
          amount: calc.pgaFeeAmount
        }] : []),
        ...(calc.manualCommodityDetails || [])
      ]
    },
    {
      title: "清关服务费",
      subtitle: "Broker / Service fee",
      rate: calc.clearanceFee ? "固定金额" : "未录入",
      amount: calc.clearanceFee,
      note: "用于内部报价或服务成本估算，不属于 HTS 税率。"
    }
  ];

  els.taxBreakdown.innerHTML = `
    ${lines.map(renderTaxLine).join("")}
    <div class="tax-total-line">
      <span>美国进口税费合计预估</span>
      <strong>${money.format(calc.total)}</strong>
    </div>
  `;
}

function renderTaxLine(line) {
  const children = line.children?.length
    ? `
      <ul class="tax-sub-lines">
        ${line.children.map((item) => `
          <li>
            <span>${escapeHtml(formatTaxChildName(item))}</span>
            <em>${escapeHtml(item.rateText || "--")}</em>
            <strong>${escapeHtml(money.format(item.amount))}</strong>
          </li>
        `).join("")}
      </ul>
    `
    : "";

  return `
    <div class="tax-line-item">
      <div>
        <strong>${escapeHtml(line.title)} <span>${escapeHtml(line.subtitle)}</span></strong>
        <small>${escapeHtml(line.rate)}</small>
        <small>${escapeHtml(line.note)}</small>
        ${children}
      </div>
      <p>金额：<strong>${escapeHtml(money.format(line.amount))}</strong></p>
    </div>
  `;
}

function readNumber(input) {
  const number = Number(input?.value || 0);
  return Number.isFinite(number) ? number : 0;
}

async function api(path, options = {}) {
  if (shouldUseStaticApi()) {
    return staticApi(path, options);
  }

  try {
    const response = await fetch(path, {
      headers: { accept: "application/json" },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `请求失败：${response.status}`);
    }
    return data;
  } catch (error) {
    if (!staticRuntime.checkedDynamicApi && canFallbackToStaticApi(path)) {
      staticRuntime.checkedDynamicApi = true;
      staticRuntime.enabled = true;
      return staticApi(path, options);
    }
    throw error;
  }
}

function shouldUseStaticApi() {
  if (staticRuntime.enabled || window.HTS_STATIC_DATA === true) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get("static") === "1" || window.location.protocol === "file:" || /\.github\.io$/i.test(window.location.hostname);
}

function canFallbackToStaticApi(path) {
  return String(path || "").startsWith("/api/");
}

async function staticApi(path, options = {}) {
  const url = new URL(path, window.location.origin);
  const pathname = url.pathname;
  const method = String(options.method || "GET").toUpperCase();
  const forceRefresh = method === "POST" || url.searchParams.get("refresh") === "1";

  if (pathname === "/api/status") {
    const manifest = await loadStaticData("manifest.json");
    return {
      release: manifest.release || {},
      source: "Static data snapshot",
      sourceUrl: "./data/manifest.json",
      fetchedAt: manifest.generatedAt,
      cacheEntries: staticRuntime.cache.size
    };
  }

  if (pathname === "/api/chapters") {
    const manifest = await loadStaticData("manifest.json");
    return { chapters: manifest.chapters || [] };
  }

  if (pathname === "/api/sync/status" || pathname === "/api/sync/refresh") {
    const manifest = await loadStaticData("manifest.json", method === "POST");
    return {
      ok: method === "POST",
      autoSync: true,
      serverTime: manifest.generatedAt || new Date().toISOString(),
      sources: manifest.sources || []
    };
  }

  if (pathname === "/api/search") {
    return staticSearch(url.searchParams.get("q") || "", forceRefresh);
  }

  if (pathname === "/api/chapter") {
    const chapter = String(url.searchParams.get("chapter") || "01").padStart(2, "0");
    const data = await loadStaticData(`chapters/${chapter}.json`, forceRefresh);
    const rows = expandChapter91StatisticalRows(data.value || []);
    return { ...data, count: rows.length, value: rows };
  }

  if (pathname === "/api/additional-duties") {
    const codes = [...new Set(String(url.searchParams.get("codes") || "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean))];
    const chapter99 = await loadStaticData("chapter99.json");
    const rows = (chapter99.value || []).filter((row) => codes.includes(row.htsno));
    const rowCodes = new Set(rows.map((row) => row.htsno));
    const policyRules = await loadStaticData("policy-rules.json").catch(() => state.policyRules || fallbackPolicyRules);
    const supplementalRows = getSupplementalChapter99Rows(policyRules);
    rows.push(...supplementalRows.filter((row) => codes.includes(row.htsno) && !rowCodes.has(row.htsno)));
    return { count: rows.length, value: rows };
  }

  if (pathname === "/api/section-232") {
    return staticSection232(url.searchParams.get("hts") || "", url.searchParams.get("general") || "");
  }

  if (pathname === "/api/cotton-assessment") {
    return staticCottonAssessment(url.searchParams.get("hts") || "");
  }

  if (pathname === "/api/adcvd") {
    return staticAdCvd(url.searchParams.get("hts") || "");
  }

  if (pathname === "/api/translate-description") {
    const text = String(url.searchParams.get("text") || "");
    const translations = await loadStaticData("translations.json").catch(() => ({ values: {} }));
    const translation = translations.values?.[text] || "";
    return {
      text,
      translation,
      source: translation ? "verified-static-cache" : "not-reviewed"
    };
  }

  if (pathname === "/api/refresh") {
    staticRuntime.cache.clear();
    const manifest = await loadStaticData("manifest.json", true);
    return {
      ok: true,
      release: manifest.release || {},
      fetchedAt: manifest.generatedAt,
      staticMode: true
    };
  }

  throw new Error(`Static data endpoint is not available: ${pathname}`);
}

async function staticSearch(query, force = false) {
  const originalQuery = String(query || "").trim();
  if ([...originalQuery].length < 2 && !/[\u3400-\u9fff]/.test(originalQuery)) {
    throw new Error("请输入至少 2 个字符");
  }

  const digits = normalizeStaticHtsDigits(originalQuery);
  if (digits.length >= 4) {
    const expansion = await staticSearchByHts(digits, force);
    const hints = expansion.expanded
      ? [
          `已按 ${digits.length} 位父级编码展开`,
          `展示 ${expansion.total} 个完整 10 位 HTS CODE`,
          ...(expansion.truncated ? ["结果较多，当前显示前 300 条"] : [])
        ]
      : [];
    return {
      originalQuery,
      query: originalQuery,
      translated: false,
      hints,
      count: expansion.rows.length,
      value: expansion.rows
    };
  }

  const index = await loadStaticData("hts-search-index.json", force);
  let plan = buildStaticSearchPlan(originalQuery);
  if (hasChineseText(originalQuery) && !plan.aliasMatched) {
    const translatedQuery = await translateSearchQueryInBrowser(originalQuery);
    if (translatedQuery) {
      plan = buildStaticSearchPlan(originalQuery, translatedQuery);
    }
  }
  const ranked = rankHtsSearchCandidates(
    buildStaticSearchCandidates(index.value || []),
    plan,
    { limit: 120 }
  );
  const rows = ranked.map((item) => item.row);
  const exactMatches = rows.filter((row) => row.searchMatch?.tier === "exact").length;
  const highRelevance = rows.filter((row) => row.searchMatch?.tier !== "related").length;
  const relatedCandidates = rows.filter((row) => row.searchMatch?.tier === "related").length;

  return {
    originalQuery,
    query: plan.displayQuery || originalQuery,
    translated: plan.aliasMatched || Boolean(plan.translatedTerms?.length),
    hints: plan.hints || [],
    matchSummary: { exactMatches, highRelevance, relatedCandidates },
    count: rows.length,
    value: rows
  };
}

function buildStaticSearchCandidates(rows) {
  return buildClassificationCandidates(hydrateDescriptionTranslations(expandChapter91StatisticalRows(rows)));
}

function buildStaticSearchPlan(query, translatedQuery = "") {
  return buildChineseSearchPlan(query, { translatedQuery });
}

function scoreStaticSearchRow(candidate, plan) {
  const row = candidate.row;
  const ownHaystack = normalizeSearchText(`${row.htsno || ""} ${candidate.ownText}`);
  const parentHaystack = normalizeSearchText(candidate.parentText || "");
  const descriptionHaystack = normalizeSearchText(candidate.ownText);
  let score = 0;
  let matches = 0;
  let directMatches = 0;

  for (const term of plan.terms) {
    let termScore = scoreStaticSearchTerm(ownHaystack, term);
    if (termScore <= 0 && !staticHasNegativeContext(parentHaystack, term)) {
      termScore = Math.floor(scoreStaticSearchTerm(parentHaystack, term) * 0.35);
    }
    if (termScore > 0) {
      if (staticDescriptionStartsWithTerm(descriptionHaystack, term)) {
        termScore += 60;
      }
      score += termScore;
      matches += 1;
      directMatches += 1;
    } else if (plan.requireAllTerms) {
      return { score: 0, searchMatch: null };
    }
  }

  for (const term of plan.chineseTerms || []) {
    const termScore = scoreStaticSearchTerm(ownHaystack, term) || Math.floor(scoreStaticSearchTerm(parentHaystack, term) * 0.35);
    if (termScore > 0) {
      score += termScore + 15;
      matches += 1;
    }
  }

  const relatedMatches = scoreStaticSearchTerms(candidate, plan.relatedTerms || []);
  const materialMatches = scoreStaticSearchTerms(candidate, plan.materialTerms || []);
  if (relatedMatches.count) {
    score += Math.round(relatedMatches.score * 0.75) + 35;
    matches += relatedMatches.count;
  }
  if (materialMatches.count) {
    score += Math.round(materialMatches.score * 0.5) + 30;
    matches += materialMatches.count;
  }

  if (plan.hasProductMatch && directMatches === 0 && relatedMatches.count === 0) {
    return { score: 0, searchMatch: null };
  }
  if (plan.hasProductMatch && directMatches === 0 && relatedMatches.count > 0 && plan.materialTerms.length && materialMatches.count === 0) {
    return { score: 0, searchMatch: null };
  }
  if (!matches || matches < (plan.minimumMatches || 1)) {
    return { score: 0, searchMatch: null };
  }

  const ownTermMatches = (plan.terms || []).filter((term) => scoreStaticSearchTerm(ownHaystack, term) > 0).length;
  if (ownTermMatches >= 2) {
    score += 45 + ownTermMatches * 15;
  }

  const htsDigits = normalizeStaticHtsDigits(row.htsno);
  if (htsDigits && plan.chapterBoosts.has(htsDigits.slice(0, 2))) {
    score += 80;
  }
  for (const prefix of plan.prefixBoosts || []) {
    if (htsDigits.startsWith(prefix)) {
      score += prefix.length >= 6 ? 260 : prefix.length >= 4 ? 170 : 90;
    }
  }

  const finalScore = score + scoreStaticCodeSpecificity(row, plan) - scoreStaticAccessoryPenalty(row, plan);
  const tier = directMatches > 0 ? "direct" : "related";
  const reasons = [];
  if (plan.productLabels?.length) {
    reasons.push(`品类：${plan.productLabels[0]}`);
  }
  if (materialMatches.count && plan.materialLabels?.length) {
    reasons.push(`材质：${plan.materialLabels[0]}`);
  }
  if (tier === "related") {
    reasons.push("相似用途或归类描述");
  } else if (plan.translatedTerms?.length && !plan.aliasMatched) {
    reasons.push("中文品名自动扩展");
  }
  return {
    score: Math.max(0, finalScore),
    searchMatch: {
      tier,
      reasons: reasons.length ? reasons : ["品名描述匹配"]
    }
  };
}

function scoreStaticSearchTerms(candidate, terms) {
  const ownHaystack = normalizeSearchText(`${candidate.row.htsno || ""} ${candidate.ownText}`);
  const parentHaystack = normalizeSearchText(candidate.parentText || "");
  let score = 0;
  let count = 0;
  for (const term of terms) {
    let termScore = scoreStaticSearchTerm(ownHaystack, term);
    if (termScore <= 0 && !staticHasNegativeContext(parentHaystack, term)) {
      termScore = Math.floor(scoreStaticSearchTerm(parentHaystack, term) * 0.35);
    }
    if (termScore > 0) {
      score += termScore;
      count += 1;
    }
  }
  return { score, count };
}

function scoreStaticAccessoryPenalty(row, plan) {
  const text = normalizeSearchText(`${row.description || ""} ${row.descriptionZh || ""}`);
  const queryTerms = [...(plan.terms || []), ...(plan.chineseTerms || [])].map((term) => normalizeSearchText(term));
  let penalty = 0;

  if (queryTerms.some((term) => term === "mango" || term === "mangoes" || term === "芒果") && /\bmangosteens?\b/.test(text)) {
    penalty += 260;
  }
  if (queryTerms.some((term) => term.includes("christmas tree") || term === "圣诞树") && /\bartificial\b/.test(text)) {
    penalty += 260;
  }

  const watchQuery = (plan.prefixBoosts || []).some((prefix) => ["9101", "9102", "9103", "9105"].includes(prefix));
  if (watchQuery && /^straps,\s*bands\s+or\s+bracelets\s+entered\s+with\s+watches/.test(text)) {
    penalty += 220;
  }
  const apparelQuery = queryTerms.some((term) =>
    ["apparel", "clothing", "garment", "garments", "wearing apparel", "服饰", "服装", "衣服", "衣物", "成衣"].includes(term)
  );
  if (apparelQuery && /^garments\s+described\s+in\s+heading\b/.test(text)) {
    penalty += 180;
  }
  return penalty;
}

function staticHasNegativeContext(haystack, term) {
  const normalized = String(term || "").toLowerCase().trim();
  if (!normalized || hasChineseText(normalized)) {
    return false;
  }
  const pattern = escapeRegExpForSearch(normalized).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b(?:except|excluding|exclude|other\\s+than|not)\\b[^.;:]{0,90}${pattern}`, "i").test(haystack);
}

function scoreStaticCodeSpecificity(row, plan = {}) {
  const digits = normalizeStaticHtsDigits(row.htsno);
  let score = 0;

  if (digits.length >= 10) {
    score += 120;
  } else if (digits.length >= 8) {
    score += 95;
  } else if (digits.length >= 6) {
    score += 45;
  } else if (digits.length >= 4) {
    score += 5;
  }

  if (String(row.general || "").trim()) {
    score += 30;
  } else {
    score -= 30;
  }

  if (plan.aliasMatched && digits.length < 8) {
    score -= 220;
  } else if (plan.aliasMatched && digits.length < 10) {
    score -= 70;
  }

  if (String(row.description || "").trim().endsWith(":")) {
    score -= 20;
  }

  return score;
}

function staticDescriptionStartsWithTerm(description, term) {
  const normalized = String(term || "").toLowerCase().trim();
  if (!normalized) {
    return false;
  }
  if (hasChineseText(normalized)) {
    return description.startsWith(normalized);
  }
  const pattern = escapeRegExpForSearch(normalized).replace(/\s+/g, "\\s+");
  return new RegExp(`^${pattern}([^a-z0-9]|$)`, "i").test(description);
}

function scoreStaticSearchTerm(haystack, term) {
  const normalized = String(term || "").toLowerCase().trim();
  if (!normalized) {
    return 0;
  }

  if (hasChineseText(normalized)) {
    return haystack.includes(normalized) ? 40 : 0;
  }

  const pattern = escapeRegExpForSearch(normalized).replace(/\s+/g, "\\s+");
  const boundaryPattern = new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, "i");
  if (boundaryPattern.test(haystack)) {
    return 20 + Math.min(35, normalized.length);
  }

  return normalized.length >= 4 && haystack.includes(normalized) ? 8 : 0;
}

function escapeRegExpForSearch(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function staticSearchByHts(digits, force = false) {
  const chapter = digits.slice(0, 2);
  const data = await loadStaticData(`chapters/${chapter}.json`, force);
  return expandHtsPrefixRows(expandChapter91StatisticalRows(data.value || []), digits, { limit: 300 });
}

async function staticSection232(hts, generalRateText = "") {
  const [mappings, vehiclePartsMappings] = await Promise.all([
    loadStaticData("section232.json"),
    loadStaticData("section232-vehicle-parts.json").catch(() => ({ lists: [], legacyFallback: true }))
  ]);
  const matches = findStaticSection232Matches(hts, mappings, generalRateText, vehiclePartsMappings);
  return {
    hts,
    count: matches.length,
    source: {
      ...(mappings.source || {
        name: "CBP Section 232 HTS Lists",
        url: mappings.sourceUrl,
        discoveryUrl: mappings.discoveryUrl,
        discoveryStatus: mappings.discoveryStatus,
        fetchedAt: mappings.fetchedAt,
        effectiveNote: mappings.effectiveNote
      }),
      vehiclePartsSources: (vehiclePartsMappings.lists || []).map((list) => ({
        id: list.id,
        name: list.name,
        url: list.url,
        bulletinUrl: list.bulletinUrl,
        fetchedAt: vehiclePartsMappings.generatedAt,
        count: list.count || list.codes?.length || 0
      }))
    },
    value: matches
  };
}

function findStaticSection232Matches(hts, mappings, generalRateText = "", vehiclePartsMappings = {}) {
  const normalized = normalizeStaticHtsDigits(hts);
  const entries = mappings.entries || [];
  const vehicleMatches = buildVehiclePartsSection232Matches(hts, normalized, vehiclePartsMappings);
  const metalCandidates = selectSection232MetalCandidates(hts, entries, generalRateText);
  if (!metalCandidates.length) {
    return vehicleMatches;
  }

  return [...vehicleMatches, ...metalCandidates.map((candidate) => {
    const condition = describeSection232Condition(candidate.entry.chapter99, generalRateText);
    return {
      code: candidate.entry.chapter99,
      htsMatch: candidate.entry.displayHts,
      normalizedMatch: candidate.entry.hts,
      context: candidate.entry.context,
      material: classifyStaticSection232Material(candidate.entry),
      label: condition.label,
      confidence: candidate.entry.hts.length === normalized.length ? "exact" : "prefix",
      rate: candidate.rate,
      autoApply: candidate.autoApply,
      alternatives: metalCandidates.length,
      summaryZh: condition.summary,
      note: condition.note,
      source: candidate.entry.source || "CBP Metals HTS List",
      sourceUrl: candidate.entry.sourceUrl || ""
    };
  })];
}

function buildVehiclePartsSection232Matches(hts, normalized = normalizeStaticHtsDigits(hts), mappings = {}) {
  const lists = mappings.lists || [];
  const matchedLists = new Map(lists
    .filter((list) => (list.codes || []).some((entry) => {
      const code = normalizeStaticHtsDigits(entry.hts || entry.displayHts || entry);
      return code && (normalized.startsWith(code) || code.startsWith(normalized));
    }))
    .map((list) => [list.id, list]));
  const options = lists.length
    ? vehiclePartsSection232Options.filter((option) => matchedLists.has(option.listId))
    : /^8708/.test(normalized || "") ? vehiclePartsSection232Options : [];

  return options.map((option) => {
    const list = matchedLists.get(option.listId);
    const matchingCodes = (list?.codes || [])
      .filter((entry) => {
        const code = normalizeStaticHtsDigits(entry.hts || entry.displayHts || entry);
        return code && (normalized.startsWith(code) || code.startsWith(normalized));
      })
      .sort((a, b) => normalizeStaticHtsDigits(b.hts || b).length - normalizeStaticHtsDigits(a.hts || a).length);
    const matchedCode = matchingCodes[0];
    const displayMatch = matchedCode?.displayHts || matchedCode?.hts || hts;
    const normalizedMatch = normalizeStaticHtsDigits(matchedCode?.hts || matchedCode || normalized);

    return {
      code: option.code,
      htsMatch: displayMatch,
      normalizedMatch,
      context: option.context,
      material: {
        code: option.materialCode,
        label: option.materialLabel,
        shortLabel: option.shortLabel,
        detailLabel: option.materialLabel
      },
      label: option.label,
      confidence: normalizedMatch === normalized ? "exact" : normalized.length >= 6 ? "prefix" : "heading",
      rate: option.rate,
      autoApply: option.autoApply !== false,
      choiceGroup: option.choiceGroup,
      choiceRank: option.choiceRank,
      alternatives: options.length,
      source: list?.name || "USITC Chapter 99",
      sourceUrl: list?.url || "",
      summaryZh: option.rate === 0
        ? `${option.label} ${option.code} 命中 CBP 官方车辆零部件清单 ${displayMatch}，本分支不另加 232 附加税；须按USMCA资格或非乘用车/轻型卡车零件条件复核。`
        : `${option.label} ${option.code} 命中 CBP 官方车辆零部件清单 ${displayMatch}，税率 +${option.rate}%；须按实际适用车型选择。`,
      note: `${option.context} 与其他车辆零部件 232 项按实际申报条件互斥选择；${option.rate === 0 ? "作为 0% 条件免加征候选列示，不默认计入。" : option.autoApply === false ? "作为中重型车辆条件候选列示，不默认计入。" : "当前默认按乘用车/轻型卡车零部件计入估算；非该类车辆应改选相应零税率或中重型车辆条款。"}`
    };
  });
}

function classifyStaticSection232Material(entry) {
  const text = `${entry.context || ""} ${entry.chapter99 || ""}`.toLowerCase();
  if (/^9903\.76\./.test(entry.chapter99 || "") || /wood|timber|lumber|upholstered/i.test(text)) {
    return { code: "wood-products", label: "Wood products", shortLabel: "Wood", detailLabel: /upholstered/i.test(text) ? "Upholstered wooden furniture" : "Wood products" };
  }
  const derivative = /derivative/.test(text);
  if (/copper/.test(text)) {
    return { code: derivative ? "derivative-copper" : "copper", label: "Copper", shortLabel: "Copper", detailLabel: derivative ? "Derivative copper products" : "Copper products" };
  }
  if (/aluminum|aluminium/.test(text)) {
    return { code: derivative ? "derivative-aluminum" : "aluminum", label: "Aluminum", shortLabel: "Aluminum", detailLabel: derivative ? "Derivative aluminum products" : "Aluminum products" };
  }
  if (/steel/.test(text)) {
    return { code: derivative ? "derivative-steel" : "steel", label: "Steel", shortLabel: "Steel", detailLabel: derivative ? "Derivative steel products" : "Steel products" };
  }
  return { code: "metal-unspecified", label: "Metal", shortLabel: "Metal", detailLabel: "Metal products" };
}

function rankStaticSection232Match(entry, baseRate) {
  if (isStaticCountrySpecificSection232(entry)) {
    return -100;
  }
  if (entry.chapter99 === "9903.82.08" && (baseRate == null || baseRate < 10)) return -20;
  if (entry.chapter99 === "9903.82.11" && (baseRate == null || baseRate < 15)) return -20;
  if (entry.chapter99 === "9903.82.07" && baseRate != null && baseRate >= 10) return -20;
  if (entry.chapter99 === "9903.82.10" && baseRate != null && baseRate >= 15) return -20;
  const ranks = new Map([
    ["9903.82.02", 100],
    ["9903.82.09", 95],
    ["9903.82.07", 90],
    ["9903.82.10", 85],
    ["9903.82.06", 80],
    ["9903.82.12", 20],
    ["9903.82.13", 5]
  ]);
  return ranks.get(entry.chapter99) ?? 50;
}

function isStaticCountrySpecificSection232(entry) {
  if (["9903.82.04", "9903.82.05", "9903.85.67", "9903.85.68"].includes(entry.chapter99)) {
    return true;
  }
  const text = `${entry.chapter99} ${entry.context}`.toLowerCase();
  return /united kingdom|european union|japan|russia|russian|argentina|australia|brazil|canada|mexico|general note 3\(b\)/i.test(text);
}

function parseStaticSimplePercent(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

async function staticCottonAssessment(hts) {
  const table = await loadStaticData("cotton.json");
  const normalized = normalizeStaticHtsDigits(hts);
  const rows = table.rows || [];
  const exact = rows.find((row) => row.hts === normalized);
  const match = exact || findStaticCottonPrefixMatch(normalized, rows);
  return {
    hts,
    count: match ? 1 : 0,
    source: table.source || { name: "eCFR 7 CFR 1205 Import Assessment Table", fetchedAt: table.fetchedAt },
    value: match ? [match] : []
  };
}

function findStaticCottonPrefixMatch(normalized, rows) {
  const candidates = rows.filter((row) => row.hts.startsWith(normalized) || normalized.startsWith(row.hts));
  if (!candidates.length) {
    return null;
  }
  const distinctRates = new Set(candidates.map((row) => `${row.conversionFactor}|${row.centsPerKg}`));
  if (distinctRates.size !== 1) {
    return null;
  }
  return {
    ...candidates[0],
    hts: normalized,
    matchedHts: candidates[0].hts,
    confidence: "prefix",
    alternatives: candidates.length,
    source: "eCFR 7 CFR 1205"
  };
}

async function staticAdCvd(hts) {
  const data = await loadStaticData("adcvd.json");
  const normalized = normalizeStaticHtsDigits(hts);
  const matches = (data.entries || [])
    .map((entry) => {
      const normalizedEntry = normalizeStaticAdCvdEntry(entry);
      const matchedHtsDigits = getBestStaticAdCvdMatchedDigits(normalized, normalizedEntry);
      return matchedHtsDigits
        ? {
            ...normalizedEntry,
            matchedHts: formatStaticHtsDigits(matchedHtsDigits),
            matchedHtsDigits,
            matchType: getStaticAdCvdMatchType(normalized, normalizedEntry.htsDigits, matchedHtsDigits),
            matchLength: matchedHtsDigits.length
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.matchLength - a.matchLength || String(a.productZh || "").localeCompare(String(b.productZh || ""), "zh-CN"))
    .slice(0, 10);

  return {
    hts,
    count: matches.length,
    source: {
      ...(data.source || {}),
      official: data.official,
      updatedAt: data.updatedAt,
      fetchedAt: data.fetchedAt
    },
    value: matches
  };
}

function normalizeStaticAdCvdEntry(entry) {
  if ((entry.htsAliases || []).length) {
    return entry;
  }
  const rule = adCvdHtsAliasRules.find((item) => item.source === normalizeStaticHtsDigits(entry.htsDigits || entry.htsCode));
  return rule
    ? {
        ...entry,
        htsAliases: rule.aliases,
        htsAliasNote: entry.htsAliasNote || rule.note
      }
    : entry;
}

function getStaticAdCvdComparableDigits(entry) {
  return [
    entry.htsDigits,
    ...(entry.htsAliases || [])
  ].filter(Boolean);
}

function getBestStaticAdCvdMatchedDigits(inputDigits, entry) {
  const matches = getStaticAdCvdComparableDigits(entry)
    .filter((listDigits) => isStaticAdCvdHtsMatch(inputDigits, listDigits))
    .sort((a, b) => b.length - a.length);
  return matches[0] || "";
}

function getStaticAdCvdMatchType(inputDigits, entryDigits, matchedDigits) {
  if (matchedDigits !== entryDigits) {
    return inputDigits === matchedDigits ? "alias-exact" : "alias-prefix";
  }
  if (inputDigits === entryDigits) {
    return "exact";
  }
  return inputDigits.startsWith(entryDigits) ? "prefix" : "broader";
}

function isStaticAdCvdHtsMatch(inputDigits, listDigits) {
  return listDigits.length >= 4 && (inputDigits === listDigits || inputDigits.startsWith(listDigits) || listDigits.startsWith(inputDigits));
}

function normalizeStaticHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatStaticHtsDigits(value) {
  const digits = normalizeStaticHtsDigits(value);
  if (digits.length === 10) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  }
  if (digits.length === 6) {
    return `${digits.slice(0, 4)}.${digits.slice(4)}`;
  }
  return digits;
}

async function loadStaticData(file, force = false) {
  if (!force && staticRuntime.cache.has(file)) {
    return staticRuntime.cache.get(file);
  }
  const response = await fetch(new URL(`data/${file}`, document.baseURI), {
    headers: { accept: "application/json" },
    cache: force ? "reload" : "default"
  });
  if (!response.ok) {
    throw new Error(`Static data missing: ${file}`);
  }
  const data = await response.json();
  staticRuntime.cache.set(file, data);
  return data;
}

function setLoading(isLoading) {
  document.body.classList.toggle("loading", isLoading);
}

function showSearchPrompt(message = "请输入品名或 HTS CODE 查询。") {
  state.rows = [];
  state.visibleRows = [];
  state.selected = null;
  els.resultTitle.textContent = "商品查询";
  els.resultCount.textContent = "";
  renderSearchGuide([]);
  els.resultsBody.innerHTML = "";
  els.emptyState.textContent = message;
  els.emptyState.classList.remove("hidden");
}

function showMessage(message) {
  els.resultTitle.textContent = "请求失败";
  els.resultCount.textContent = "";
  renderSearchGuide([]);
  els.resultsBody.innerHTML = "";
  els.emptyState.textContent = message;
  els.emptyState.classList.remove("hidden");
}

function formatTime(value) {
  if (!value) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function rowKey(row) {
  return `${row.htsno}|${row.description}|${row.general}`;
}

function displayZhDescription(row) {
  return getPreferredDescriptionZh(row) || "暂无校核中文译文";
}

function hydrateDescriptionTranslations(rows = []) {
  return rows.map((row) => hydrateDescriptionRow(row));
}

function hydrateDescriptionRow(row = {}) {
  const cached = state.descriptionTranslations.get(String(row.description || "").trim()) || "";
  const descriptionZh = getPreferredDescriptionZh(row)
    || (isUsableChineseDescription(cached) ? cached : "");
  return {
    ...row,
    descriptionZh,
    classificationPath: Array.isArray(row.classificationPath)
      ? row.classificationPath.map((item) => hydrateDescriptionRow(item))
      : row.classificationPath
  };
}

const clientSearchTranslationStorageKey = "hts-search-translations-v1";

async function translateSearchQueryInBrowser(text) {
  const normalized = String(text || "").trim();
  if (!normalized || !hasChineseText(normalized)) {
    return "";
  }
  try {
    const cache = JSON.parse(localStorage.getItem(clientSearchTranslationStorageKey) || "{}");
    const cached = String(cache[normalized] || "").trim();
    if (cached && !hasChineseText(cached)) {
      return cached;
    }
    const translated = await translateTextWithMyMemory(normalized, "zh-CN|en");
    if (!translated || hasChineseText(translated) || translated.toLowerCase() === normalized.toLowerCase()) {
      return "";
    }
    cache[normalized] = translated;
    const entries = Object.entries(cache).slice(-300);
    localStorage.setItem(clientSearchTranslationStorageKey, JSON.stringify(Object.fromEntries(entries)));
    return translated;
  } catch {
    return "";
  }
}

async function translateTextWithMyMemory(text, langpair) {
  try {
    const params = new URLSearchParams({ q: text, langpair });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
      headers: { accept: "application/json" },
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    if (!response.ok) {
      return "";
    }
    const data = await response.json();
    return decodeHtmlText(data.responseData?.translatedText || "").trim();
  } catch {
    return "";
  }
}

function decodeHtmlText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
