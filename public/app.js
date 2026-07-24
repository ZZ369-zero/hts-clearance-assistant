import { chineseSearchCatalog, isMaterialCatalogEntry } from "./search-catalog.js";
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
} from "./certification-rule-engine.js?v=20260709-fda5";

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
  translationRequestId: 0,
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
  section122ExclusionPrefixes: [...section122FallbackExclusionPrefixes],
  section122ExclusionsSource: "内置 Annex II 兜底清单",
  chapters: []
};

const els = {
  releaseBadge: document.querySelector("#releaseBadge"),
  syncTime: document.querySelector("#syncTime"),
  refreshData: document.querySelector("#refreshData"),
  syncCenter: document.querySelector("#syncCenter"),
  syncAutoStatus: document.querySelector("#syncAutoStatus"),
  syncToggle: document.querySelector("#syncToggle"),
  syncRefreshAll: document.querySelector("#syncRefreshAll"),
  syncSourceList: document.querySelector("#syncSourceList"),
  oceanTab: document.querySelector("#oceanTab"),
  airTab: document.querySelector("#airTab"),
  t01Mode: document.querySelector("#t01Mode"),
  t11Mode: document.querySelector("#t11Mode"),
  transportTitle: document.querySelector("#transportTitle"),
  transportHint: document.querySelector("#transportHint"),
  clearanceTitle: document.querySelector("#clearanceTitle"),
  clearanceHint: document.querySelector("#clearanceHint"),
  oceanFields: document.querySelector("#oceanFields"),
  airFields: document.querySelector("#airFields"),
  modeChecklist: document.querySelector("#modeChecklist"),
  modeValueNotice: document.querySelector("#modeValueNotice"),
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
  miniHsCode: document.querySelector("#miniHsCode"),
  miniProductDescription: document.querySelector("#miniProductDescription"),
  effectiveRate: document.querySelector("#effectiveRate"),
  miniGeneralRate: document.querySelector("#miniGeneralRate"),
  surchargeRate: document.querySelector("#surchargeRate"),
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

const transportConfig = {
  ocean: {
    title: "海运 Ocean",
    hint: "整柜、拼箱和大货运输；通常关注 ISF、AMS、提单、到港和 HMF。",
    checklist: ["确认船司提单 / 货代提单", "确认 ISF 与 AMS 状态", "核对美国到港口岸与柜量", "海运默认纳入 HMF 估算"]
  },
  air: {
    title: "空运 Air",
    hint: "快件、空派和高时效货物；通常关注 MAWB/HAWB、航班、机场和票数。",
    checklist: ["确认主单 / 分单号", "核对航班与到达机场", "按票数或包裹数整理发票", "空运默认不纳入 HMF 估算"]
  }
};

const clearanceConfig = {
  t01: {
    title: "T01 Formal Entry",
    hint: "适用于正式进口申报、商业大货、高货值或需监管证件的货物。",
    checklist: ["Importer of Record 与 Bond", "商业发票、装箱单、提单或运单", "HTS、原产国、申报价值", "PGA/特殊监管证件如适用"],
    notice: "T01 当前按正式申报估算。"
  },
  t11: {
    title: "T11 Informal Entry",
    hint: "适用于低货值、非正式申报或小包裹场景；超过常见限额时建议转 T01。",
    checklist: ["按票整理收件人和商品信息", "确认单票申报价值", "核对是否涉及 PGA、配额或反倾销反补贴", "不满足 T11 条件时切换 T01"],
    notice: "T11 通常用于非正式申报；如单票价值超过 2,500 USD 或涉及监管条件，请按 T01 复核。"
  }
};

const dutyRuleCatalog = {
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

const vehiclePartsSection232Options = [
  {
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

init();

async function init() {
  initSyncPanel();
  bindEvents();
  renderSearchHistory();
  setTransportMode(state.transportMode);
  setClearanceMode(state.clearanceMode);
  await Promise.all([loadStatus(), loadChapters(), loadSyncStatus(), loadSection122Exclusions()]);
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
  els.oceanTab.addEventListener("click", () => setTransportMode("ocean"));
  els.airTab.addEventListener("click", () => setTransportMode("air"));
  els.t01Mode.addEventListener("click", () => setClearanceMode("t01"));
  els.t11Mode.addEventListener("click", () => setClearanceMode("t11"));
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
  ].forEach((input) => input.addEventListener("input", calculate));
}

function setTransportMode(mode) {
  state.transportMode = mode;
  const isOcean = mode === "ocean";
  els.oceanTab.classList.toggle("active", isOcean);
  els.airTab.classList.toggle("active", !isOcean);
  els.oceanTab.setAttribute("aria-selected", String(isOcean));
  els.airTab.setAttribute("aria-selected", String(!isOcean));
  els.oceanFields.classList.toggle("hidden", !isOcean);
  els.airFields.classList.toggle("hidden", isOcean);
  els.hmfEnabled.checked = isOcean;
  if (state.selected) {
    updateFeeRuleMatches(state.selected, { preserveManualValues: true });
  }
  updateModePanel();
  calculate();
}

function setClearanceMode(mode) {
  state.clearanceMode = mode;
  const isT01 = mode === "t01";
  els.t01Mode.classList.toggle("active", isT01);
  els.t11Mode.classList.toggle("active", !isT01);
  els.t01Mode.setAttribute("aria-selected", String(isT01));
  els.t11Mode.setAttribute("aria-selected", String(!isT01));
  if (state.selected) {
    updateFeeRuleMatches(state.selected, { preserveManualValues: true });
  }
  updateModePanel();
  calculate();
}

function updateModePanel() {
  const transport = transportConfig[state.transportMode];
  const clearance = clearanceConfig[state.clearanceMode];
  const value = readNumber(els.customsValue);

  els.transportTitle.textContent = transport.title;
  els.transportHint.textContent = transport.hint;
  els.clearanceTitle.textContent = clearance.title;
  els.clearanceHint.textContent = clearance.hint;

  const valueWarning =
    state.clearanceMode === "t11" && value > 2500
      ? "当前申报价值超过 2,500 USD，请优先按 T01 正式申报复核。"
      : clearance.notice;
  els.modeValueNotice.textContent = valueWarning;

  els.modeChecklist.innerHTML = [...transport.checklist, ...clearance.checklist]
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
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
    running: "同步中",
    error: "异常",
    pending: "等待"
  }[status] || status;
  const link = detail.url || source.url;
  const count = detail.count != null ? `记录数：${detail.count}` : "";
  const extra = detail.release || detail.title || detail.effectiveNote || detail.mode || "";

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
      </div>
      <div class="sync-card-actions">
        <small>周期：约 ${escapeHtml(String(source.intervalMinutes || "--"))} 分钟</small>
        <button class="secondary-button" type="button" data-sync-source="${escapeHtml(source.id)}">刷新</button>
      </div>
    </article>
  `;
}

async function loadChapters() {
  const data = await api("/api/chapters");
  state.chapters = data.chapters || [];
  els.chapterSelect.innerHTML = state.chapters
    .map(([code, title]) => `<option value="${code}">${code} - ${escapeHtml(title)}</option>`)
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
  state.translationRequestId += 1;
  setMode("search");
  state.lastQuery = query;
  els.queryInput.value = query;
  setLoading(true);
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}${force ? "&refresh=1" : ""}`);
    state.rows = data.value || [];
    state.visibleRows = state.rows;
    state.dataKind = "search";
    saveSearchHistory(query);
    renderSearchHistory();
    els.resultTitle.textContent = data.translated ? `查询结果：${data.originalQuery} → ${data.query}` : `查询结果：${query}`;
    renderSearchGuide(data.hints || []);
    renderRows(state.visibleRows);
    selectFirstSelectable();
    enhanceSearchResultTranslations(state.visibleRows);
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
}

async function loadChapter(chapter, force = false) {
  state.translationRequestId += 1;
  state.lastChapter = chapter;
  els.chapterSelect.value = chapter;
  state.dataKind = "chapter";
  setMode("chapter");
  setLoading(true);
  try {
    const data = await api(`/api/chapter?chapter=${encodeURIComponent(chapter)}${force ? "&refresh=1" : ""}`);
    state.rows = data.value || [];
    state.visibleRows = state.rows;
    state.dataKind = "chapter";
    const title = state.chapters.find(([code]) => code === chapter)?.[1] || "HTS chapter";
    els.resultTitle.textContent = `${chapter} - ${title}`;
    renderSearchGuide([]);
    els.chapterFilter.value = "";
    renderRows(state.visibleRows);
    selectFirstSelectable();
    enhanceSearchResultTranslations(state.visibleRows);
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
    await loadSection122Exclusions(true);
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

async function enhanceSearchResultTranslations(rows) {
  const requestId = ++state.translationRequestId;
  const descriptions = [...new Set(rows
    .filter(needsTranslationEnhancement)
    .map((row) => row.description)
    .filter(Boolean))].slice(0, 80);

  if (!descriptions.length) {
    return;
  }

  await mapLimit(descriptions, 3, async (description) => {
    try {
      const data = await api(`/api/translate-description?text=${encodeURIComponent(description)}`);
      if (requestId !== state.translationRequestId || !data.translation) {
        return;
      }
      applyDescriptionTranslation(description, data.translation);
    } catch {
      // Keep existing local translation if automatic translation is unavailable.
    }
  });
}

function needsTranslationEnhancement(row) {
  const zh = row.descriptionZh || "";
  if (!row.description || !zh) {
    return Boolean(row.description);
  }
  return !hasChineseText(zh) || /[A-Za-z]{2,}/.test(zh) || zh.includes("中文释义待核");
}

function applyDescriptionTranslation(description, translation) {
  const cleaned = String(translation || "").trim();
  if (!cleaned) {
    return;
  }

  for (const row of state.rows) {
    if (row.description === description) {
      row.descriptionZh = cleaned;
    }
  }

  renderRows(state.visibleRows);
  if (state.selected?.description === description) {
    els.selectedDescription.innerHTML = `
      <span class="zh-line">${escapeHtml(displayZhDescription(state.selected))}</span>
      <span class="en-line">${escapeHtml(state.selected.description || "--")}</span>
    `;
    els.miniProductDescription.textContent = [
      displayZhDescription(state.selected),
      state.selected.description || ""
    ].filter(Boolean).join("；");
  }
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
          </td>
          <td class="rate-cell">${escapeHtml(formatRateDisplay(row.general))}</td>
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
    <span>分类要素</span>
    ${items.map((item) => `<b>${escapeHtml(item)}</b>`).join("")}
  `;
}

function renderAdditionalCodes(row) {
  const rules = buildAdditionalDutyRules(row);
  if (rules.length) {
    return rules
      .slice(0, 3)
      .map((rule) => {
        if (rule.exempt) {
          const code = rule.exemptionCode || rule.code || "";
          const rate = rule.rate == null ? "" : ` ${formatRateNumber(rule.rate)}%`;
          return `<span class="code-tag">${escapeHtml(rule.shortLabel)} ${escapeHtml(code)}${escapeHtml(rate)} 豁免</span>`;
        }
        const rate = rule.exemptionStatus === "多选1" ? "多选1" : rule.rate == null ? "需判断" : `+${rule.rate}%`;
        return `<span class="code-tag">${escapeHtml(rule.shortLabel)} ${escapeHtml(rule.code || "")} ${escapeHtml(rate)}</span>`;
      })
      .join("");
  }
  return escapeHtml(row.additionalDuties || "");
}

function buildAdditionalDutyRules(row, context = {}) {
  const sourceCodes = [...new Set([...(row.additionalDutyCodes || []), ...getDefaultAdditionalDutyCodes(context)])];
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
    const catalog = dutyRuleCatalog[code] || inferDutyRuleByCode(code);
    const temporary122Choice = code === "9903.03.01" ? getTemporary122Choice(row, context) : null;
    const temporary122Inactive = code === "9903.03.01" ? getTemporary122Inactive(context) : null;
    const temporary122Exemption = code === "9903.03.01" && !temporary122Choice && !temporary122Inactive
      ? getTemporary122Exemption(row, context)
      : null;
    return {
      code,
      group: catalog.group || catalog.shortLabel || "CH99",
      label: catalog.label || "Chapter 99 附加税",
      shortLabel: catalog.shortLabel || "CH99",
      rate: catalog.rate ?? null,
      autoApply: temporary122Choice || temporary122Inactive || temporary122Exemption ? false : catalog.autoApply !== false,
      summaryZh: temporary122Choice?.summaryZh || temporary122Inactive?.summaryZh || temporary122Exemption?.summaryZh || catalog.summaryZh,
      exemptionStatus: temporary122Choice?.exemptionStatus || temporary122Inactive?.exemptionStatus || (temporary122Exemption ? "不计入" : catalog.exemptionStatus || "需确认"),
      note: temporary122Choice?.note || temporary122Inactive?.note || temporary122Exemption?.note || catalog.note || "来自 USITC 脚注或常见附加税规则，需复核适用条件。",
      exempt: Boolean(temporary122Exemption),
      exemptionCode: temporary122Exemption?.code || ""
    };
  });
}

function getDefaultAdditionalDutyCodes(context = {}) {
  const referenceDate = getPolicyReferenceDate(context);
  const codes = [];
  if (isPolicyActive(temporary122Policy, referenceDate)) {
    codes.push(temporary122Policy.code);
  }
  if (isPolicyEffective(forcedLabor301Policy, referenceDate)) {
    codes.push(forcedLabor301Policy.code);
  }
  return codes;
}

function getPolicyReferenceDate(context = {}) {
  const value = context.entryDate || context.referenceDate || "";
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
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
    note: "如适用 232-汽车零配件 9903.94.05 或 232-重型汽车零配件 9903.74.08，不应同时叠加 122 临时关税；如车辆 232 项不适用，可人工选择 122。"
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
  return {
    code: match.code || "232-no-match",
    group: "232",
    label: match.label || `232-${materialLabel}加征`,
    shortLabel: "232",
    rate: match.rate ?? null,
    autoApply: match.autoApply !== false,
    choiceGroup: match.choiceGroup || "",
    choiceRank: match.choiceRank || 0,
    summaryZh: match.summaryZh || `${sourceName} ${matchedHts}，材质归类为${materialLabel}，对应 ${match.code || "未命中"}。`,
    exemptionStatus: match.autoApply === false ? "需复核" : "官方匹配",
    note: `${match.note || match.context || "Section 232 metals list"}${alternatives}`,
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
  return isVehiclePartsSection232Code(code) || /^9903\.(80|81|82|83|84|85)\.\d{2}$/.test(String(code || ""));
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
    els.miniHsCode.textContent = "--";
    els.miniProductDescription.textContent = "从左侧结果选择一行。";
    els.effectiveRate.textContent = "--";
    els.miniGeneralRate.textContent = "--";
    els.surchargeRate.textContent = "--";
    els.restrictionList.textContent = "未选择商品";
    els.detailGeneral.textContent = "--";
    els.detailSpecial.textContent = "--";
    els.detailOther.textContent = "--";
    els.detailUnits.textContent = "--";
    els.additionalDutyList.textContent = "未选择商品";
    renderCertificationPanel(null);
    els.detailNotes.innerHTML = "";
    return;
  }

  els.selectedCode.textContent = row.htsno;
  els.selectedDescription.innerHTML = `
    <span class="zh-line">${escapeHtml(displayZhDescription(row))}</span>
    <span class="en-line">${escapeHtml(row.description || "--")}</span>
  `;
  els.miniHsCode.textContent = normalizeHtsCode(row.htsno);
  els.miniProductDescription.textContent = [
    displayZhDescription(row),
    row.description || ""
  ].filter(Boolean).join("；");
  els.effectiveRate.textContent = formatMiniRateDisplay(row.general) || "--";
  els.miniGeneralRate.textContent = formatMiniRateDisplay(row.general) || "--";
  els.surchargeRate.textContent = "读取中";
  els.restrictionList.innerHTML = `<div class="restriction-empty">正在读取附加税项...</div>`;
  els.detailGeneral.textContent = formatRateDisplay(row.general) || "--";
  els.detailSpecial.textContent = formatRateDisplay(row.special) || "--";
  els.detailOther.textContent = formatRateDisplay(row.other) || "--";
  els.detailUnits.textContent = row.units?.length ? row.units.join(", ") : "--";
  state.certificationMatches = matchCertificationRules(row, { query: getCertificationContextQuery() });
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
  els.restrictionList.innerHTML = `<div class="restriction-empty">正在读取附加税规则...</div>`;

  try {
    const section232 = await api(
      `/api/section-232?hts=${encodeURIComponent(row.htsno)}&general=${encodeURIComponent(row.general || "")}`
    );
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }
    rules = mergeAdditionalDutyRules([
      ...buildAdditionalDutyRules(row, { section232Matches: section232.value || [] }),
      ...buildSection232Rules(row, section232)
    ]);
  } catch (error) {
    if (requestId !== state.additionalDutyRequestId) {
      return;
    }
    rules = mergeAdditionalDutyRules([
      ...rules,
      {
        code: "232-read-error",
        label: dutyRuleCatalog["232-steel-aluminum"].label,
        shortLabel: "232",
        rate: null,
        autoApply: false,
        summaryZh: "232 官方清单读取失败，未自动计入。",
        exemptionStatus: "读取失败",
        note: error.message,
        source: "section232"
      }
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
    const rateParts = [];
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
          code: item.htsno || rule.code || "",
          rate: parsed.rate
        });
        rateParts.push(`${formatRateNumber(parsed.rate)}%`);
        rateSummaries.push(`${rule.label} ${rule.code}: +${formatRateNumber(parsed.rate)}%`);
      }
      additionalDutyItems.push(renderAdditionalDutyItem(item, parsed, rule, shouldAutoApply));
      restrictionItems.push(renderRestrictionItem(item, parsed, rule, shouldAutoApply));
    }

    restrictionItems.push(...adCvdMatches.map(renderAdCvdRestrictionItem));

    els.additionalDutyList.innerHTML = additionalDutyItems.join("");
    els.surchargeRate.textContent = rateParts.length ? rateParts.join("+") : "--";
    els.restrictionList.innerHTML = restrictionItems.join("");

    state.additionalDutyBreakdown = mergeAdditionalDutyBreakdown(additionalDutyBreakdown);
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
  const displayCode = rule.exempt && rule.exemptionCode ? rule.exemptionCode : item.htsno || rule.code || "Chapter 99";
  const rateLabel = rule.exempt
    ? parsed.auto && parsed.rate > 0
      ? `${formatRateNumber(parsed.rate)}% 豁免`
      : "豁免"
    : parsed.auto && parsed.rate > 0
    ? `+${parsed.rate}%`
    : "需人工确认";
  const applyLabel = rule.exempt ? "豁免，未计入估算" : applied ? "已计入估算" : "未自动计入";
  const englishLine = rule.summaryZh ? "" : `<p class="en-line">${escapeHtml(item.description || "--")}</p>`;
  return `
    <div class="additional-duty-item ${applied ? "applied" : "not-applied"}">
      <div>
        <strong>${escapeHtml(rule.label)} <span>${escapeHtml(displayCode)}</span></strong>
        <p class="zh-line">${escapeHtml(rule.summaryZh || item.descriptionZh || item.description || "暂无中文释义")}</p>
        ${englishLine}
        <small>General: ${escapeHtml(item.general || "--")}</small>
        <small>${escapeHtml(rule.note)} ${escapeHtml(applyLabel)}</small>
      </div>
      <span class="rate-pill">${escapeHtml(rateLabel)}</span>
    </div>
  `;
}

function renderRestrictionItem(item, parsed, rule, applied) {
  const isSection232Miss = rule.source === "section232" && !/^99\d{2}\.\d{2}\.\d{2}$/.test(rule.code || "");
  const displayCode = rule.exempt && rule.exemptionCode ? rule.exemptionCode : item.htsno || rule.code || "Chapter 99";
  const code = isSection232Miss ? "未命中" : compactChapter99Code(displayCode);
  const rateLabel = rule.exempt
    ? parsed.auto && parsed.rate > 0
      ? `${formatRateNumber(parsed.rate)}%`
      : "豁免"
    : isSection232Miss
    ? "不适用"
    : parsed.auto && parsed.rate > 0
    ? `${formatRateNumber(parsed.rate)}%`
    : "需判断";
  const status = rule.exempt ? "豁免" : rule.exemptionStatus || (applied ? "需复核" : "需确认");
  const title = `${rule.note || "需按申报条件复核"} ${applied ? "已计入估算。" : "未自动计入估算。"}`;
  const materialBadge = rule.material?.shortLabel
    ? `<em class="material-badge">${escapeHtml(rule.material.shortLabel)}</em>`
    : "";

  return `
    <div class="restriction-item ${applied ? "applied" : "not-applied"}">
      <div class="restriction-main">
        <strong>${escapeHtml(rule.label)}:</strong>
        ${materialBadge}
        <span>${escapeHtml(code)}</span>
        <b>${escapeHtml(rateLabel)}</b>
      </div>
      <div class="restriction-status">
        <span>${escapeHtml(status)}</span>
        <button class="help-dot" type="button" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">?</button>
      </div>
    </div>
  `;
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
    state.baseRateMessage = `已从 ${row.htsno} 识别钟表复合普通税率，请填写数量、表壳、表带/表链和电池价值后计算。`;
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
  els.compoundDutyNotice.textContent =
    `计算式：数量 × ${money.format(compound.fixedEach)} + 表壳价值 × ${formatRateNumber(compound.caseRate)}% + 表带/表链价值 × ${formatRateNumber(compound.strapRate)}% + 电池价值 × ${formatRateNumber(compound.batteryRate)}%。`;
}

function parseCompoundGeneralDuty(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || !/each/i.test(text) || !/(case|strap|band|bracelet|battery)/i.test(text)) {
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
    if (target.includes("case")) {
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
      amount: quantity * compound.fixedEach
    },
    {
      group: "general",
      shortLabel: "表壳",
      label: "表壳价值",
      displayName: "表壳价值",
      rateText: `${formatRateNumber(compound.caseRate)}%`,
      amount: caseValue * (compound.caseRate / 100)
    },
    {
      group: "general",
      shortLabel: "表带",
      label: "表带/表链价值",
      displayName: "表带/表链价值",
      rateText: `${formatRateNumber(compound.strapRate)}%`,
      amount: strapValue * (compound.strapRate / 100)
    },
    {
      group: "general",
      shortLabel: "电池",
      label: "电池价值",
      displayName: "电池价值",
      rateText: `${formatRateNumber(compound.batteryRate)}%`,
      amount: batteryValue * (compound.batteryRate / 100)
    }
  ].filter((item) => item.rateText !== "0%" || item.amount > 0);
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
  updateModePanel();
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
  const number = Number(input.value);
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
    return loadStaticData(`chapters/${chapter}.json`, forceRefresh);
  }

  if (pathname === "/api/additional-duties") {
    const codes = [...new Set(String(url.searchParams.get("codes") || "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean))];
    const chapter99 = await loadStaticData("chapter99.json");
    const rows = (chapter99.value || []).filter((row) => codes.includes(row.htsno));
    const rowCodes = new Set(rows.map((row) => row.htsno));
    rows.push(...supplementalChapter99Rows.filter((row) => codes.includes(row.htsno) && !rowCodes.has(row.htsno)));
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
    return {
      text,
      translation: translations.values?.[text] || "",
      source: "static"
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
    const rows = await staticSearchByHts(digits, force);
    return {
      originalQuery,
      query: originalQuery,
      translated: false,
      count: rows.length,
      value: rows
    };
  }

  const index = await loadStaticData("hts-search-index.json", force);
  const plan = buildStaticSearchPlan(originalQuery);
  const rows = buildStaticSearchCandidates(index.value || [])
    .map((candidate) => ({ row: candidate.row, score: scoreStaticSearchRow(candidate, plan) }))
    .filter((item) => item.row.htsno && item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.row.htsno || "").localeCompare(String(b.row.htsno || "")))
    .map((item) => item.row)
    .slice(0, 300);

  return {
    originalQuery,
    query: plan.displayQuery || originalQuery,
    translated: plan.aliasMatched,
    hints: plan.hints || [],
    count: rows.length,
    value: rows
  };
}

function buildStaticSearchCandidates(rows) {
  const stack = [];
  return rows.map((row) => {
    const indent = Number(row.indent || 0);
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const ownText = `${row.description || ""} ${row.descriptionZh || ""}`;
    const parentText = stack.map((item) => item.text).join(" ");
    const searchText = `${row.htsno || ""} ${parentText} ${ownText}`;

    if (ownText.trim()) {
      stack.push({ indent, text: ownText });
    }

    return { row, ownText, parentText, searchText };
  });
}

function buildStaticSearchPlan(query) {
  const normalizedQuery = normalizeSearchText(query);
  const aliasMatches = chineseSearchCatalog
    .map((entry) => ({
      ...entry,
      matchedTerms: entry.terms.filter((term) => normalizedQuery.includes(normalizeSearchText(term)))
    }))
    .filter((entry) => entry.matchedTerms.length)
    .sort((a, b) => longestTermLength(b.matchedTerms) - longestTermLength(a.matchedTerms));
  const maxMatchedLength = Math.max(0, ...aliasMatches.flatMap((entry) => entry.matchedTerms).map((term) => [...term].length));
  const focusedAliasMatches = maxMatchedLength > 1
    ? aliasMatches.filter((entry) => longestTermLength(entry.matchedTerms) > 1)
    : aliasMatches;
  const hasProductMatch = focusedAliasMatches.some((entry) => !isMaterialCatalogEntry(entry));
  const nonMaterialMatches = hasProductMatch
    ? focusedAliasMatches.filter((entry) => !isMaterialCatalogEntry(entry))
    : focusedAliasMatches;
  const maxPrimaryLength = Math.max(0, ...nonMaterialMatches.map((entry) => longestTermLength(entry.matchedTerms)));
  const primaryAliasMatches = maxPrimaryLength > 1
    ? nonMaterialMatches.filter((entry) => longestTermLength(entry.matchedTerms) === maxPrimaryLength)
    : nonMaterialMatches;

  if (primaryAliasMatches.length) {
    const terms = [
      ...new Set(primaryAliasMatches.flatMap((entry) => entry.queries).map((term) => normalizeSearchText(term)).filter(Boolean))
    ];
    const chapterBoosts = new Set(primaryAliasMatches.flatMap((entry) => entry.chapters || []));
    const prefixBoosts = [
      ...new Set(primaryAliasMatches.flatMap((entry) => entry.prefixBoosts || []).map((prefix) => normalizeStaticHtsDigits(prefix)).filter(Boolean))
    ];
    const hints = [
      ...new Set(primaryAliasMatches.flatMap((entry) => entry.hints || []).map((item) => String(item || "").trim()).filter(Boolean))
    ];
    const chineseTerms = [...new Set(primaryAliasMatches.flatMap((entry) => entry.matchedTerms).map(normalizeSearchText).filter(Boolean))];
    return {
      aliasMatched: true,
      terms,
      chineseTerms,
      chapterBoosts,
      prefixBoosts,
      hints,
      requireAllTerms: false,
      minimumMatches: 1,
      displayQuery: terms.slice(0, 4).join(" / ")
    };
  }

  return {
    aliasMatched: false,
    terms: splitSearchTerms(normalizedQuery),
    chineseTerms: hasChineseText(normalizedQuery) ? [normalizedQuery] : [],
    chapterBoosts: new Set(),
    prefixBoosts: [],
    hints: [],
    requireAllTerms: true,
    minimumMatches: 1,
    displayQuery: normalizedQuery
  };
}

function splitSearchTerms(value) {
  return String(value || "")
    .split(/[\s,，;；/、|]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[，。；：、（）【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function longestTermLength(terms) {
  return Math.max(0, ...terms.map((term) => [...String(term || "")].length));
}

function scoreStaticSearchRow(candidate, plan) {
  const row = candidate.row;
  const ownHaystack = normalizeSearchText(`${row.htsno || ""} ${candidate.ownText}`);
  const parentHaystack = normalizeSearchText(candidate.parentText || "");
  const descriptionHaystack = normalizeSearchText(candidate.ownText);
  let score = 0;
  let matches = 0;

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
    } else if (plan.requireAllTerms) {
      return 0;
    }
  }

  for (const term of plan.chineseTerms || []) {
    const termScore = scoreStaticSearchTerm(ownHaystack, term) || Math.floor(scoreStaticSearchTerm(parentHaystack, term) * 0.35);
    if (termScore > 0) {
      score += termScore + 15;
      matches += 1;
    }
  }

  if (!matches || matches < (plan.minimumMatches || 1)) {
    return 0;
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

  return score + scoreStaticCodeSpecificity(row, plan) - scoreStaticAccessoryPenalty(row, plan);
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
  const rows = (data.value || []).filter((row) => row.htsno);
  const exact = rows.filter((row) => normalizeStaticHtsDigits(row.htsno) === digits);
  if (exact.length) {
    return exact;
  }

  const parentMatches = rows.filter((row) => {
    const rowDigits = normalizeStaticHtsDigits(row.htsno);
    return rowDigits && digits.startsWith(rowDigits);
  });
  if (parentMatches.length) {
    const bestLength = Math.max(...parentMatches.map((row) => normalizeStaticHtsDigits(row.htsno).length));
    return parentMatches.filter((row) => normalizeStaticHtsDigits(row.htsno).length === bestLength);
  }

  const childMatches = rows.filter((row) => {
    const rowDigits = normalizeStaticHtsDigits(row.htsno);
    return rowDigits && rowDigits.startsWith(digits);
  });
  if (childMatches.length) {
    const bestLength = Math.min(...childMatches.map((row) => normalizeStaticHtsDigits(row.htsno).length));
    return childMatches.filter((row) => normalizeStaticHtsDigits(row.htsno).length === bestLength).slice(0, 50);
  }
  return [];
}

async function staticSection232(hts, generalRateText = "") {
  const mappings = await loadStaticData("section232.json");
  const matches = findStaticSection232Matches(hts, mappings, generalRateText);
  return {
    hts,
    count: matches.length,
    source: mappings.source || {
      name: "CBP Metals HTS List",
      url: mappings.sourceUrl,
      discoveryUrl: mappings.discoveryUrl,
      discoveryStatus: mappings.discoveryStatus,
      fetchedAt: mappings.fetchedAt,
      effectiveNote: mappings.effectiveNote
    },
    value: matches
  };
}

function findStaticSection232Matches(hts, mappings, generalRateText = "") {
  const normalized = normalizeStaticHtsDigits(hts);
  const entries = mappings.entries || [];
  const vehicleMatches = buildVehiclePartsSection232Matches(hts, normalized);
  const directMatches = entries.filter((entry) =>
    normalized.startsWith(entry.hts) || entry.hts.startsWith(normalized)
  );
  if (!directMatches.length) {
    return vehicleMatches;
  }

  const maxLength = Math.max(...directMatches.map((entry) => Math.min(entry.hts.length, normalized.length)));
  const seen = new Set();
  const bestLevelMatches = directMatches
    .filter((entry) => Math.min(entry.hts.length, normalized.length) === maxLength)
    .filter((entry) => {
      const key = `${entry.chapter99}|${entry.hts}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  const baseRate = parseStaticSimplePercent(generalRateText);
  const ranked = bestLevelMatches
    .map((entry) => ({
      entry,
      rank: rankStaticSection232Match(entry, baseRate),
      autoApply: !isStaticCountrySpecificSection232(entry) && rankStaticSection232Match(entry, baseRate) > 0
    }))
    .sort((a, b) => b.rank - a.rank || b.entry.hts.length - a.entry.hts.length || a.entry.chapter99.localeCompare(b.entry.chapter99));

  const preferred = ranked[0];
  if (!preferred) {
    return vehicleMatches;
  }

  return [...vehicleMatches, {
    code: preferred.entry.chapter99,
    htsMatch: preferred.entry.displayHts,
    normalizedMatch: preferred.entry.hts,
    context: preferred.entry.context,
    material: classifyStaticSection232Material(preferred.entry),
    label: "232",
    confidence: preferred.entry.hts.length === normalized.length ? "exact" : "prefix",
    autoApply: preferred.autoApply,
    alternatives: ranked.length,
    source: "CBP Metals HTS List"
  }];
}

function buildVehiclePartsSection232Matches(hts, normalized = normalizeStaticHtsDigits(hts)) {
  if (!/^8708/.test(normalized || "")) {
    return [];
  }

  return vehiclePartsSection232Options.map((option) => ({
    code: option.code,
    htsMatch: hts,
    normalizedMatch: normalized,
    context: option.context,
    material: {
      code: option.materialCode,
      label: option.materialLabel,
      shortLabel: option.shortLabel,
      detailLabel: option.materialLabel
    },
    label: option.label,
    confidence: normalized.length >= 6 ? "prefix" : "heading",
    rate: option.rate,
    autoApply: option.autoApply !== false,
    choiceGroup: option.choiceGroup,
    choiceRank: option.choiceRank,
    alternatives: vehiclePartsSection232Options.length,
    source: "USITC Chapter 99",
    summaryZh: `${option.label} ${option.code} 为车辆零配件 232 备选项，税率按 Chapter 99 读取；与 122/其他车辆 232 项多选一。`,
    note: `${option.context} 与 122 临时关税及其他车辆零配件 232 项多选一；${option.autoApply === false ? "按条件候选列示，不默认计入。" : "默认按车辆零配件 232 项计入估算。"}`
  }));
}

function classifyStaticSection232Material(entry) {
  const text = `${entry.context || ""} ${entry.chapter99 || ""}`.toLowerCase();
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
  return /united kingdom|russia|russian|argentina|australia|brazil|canada|mexico|general note 3\(b\)/i.test(text);
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
  return row?.descriptionZh || row?.description || "暂无中文释义";
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
