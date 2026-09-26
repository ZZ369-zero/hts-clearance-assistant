import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual page code and its imports against committed static snapshots.
// Only browser DOM primitives, fetch, and the clock are replaced; rule building,
// static API lookup, rendering, and calculator logic remain the production code.
const appUrl = new URL("../public/app.js", import.meta.url);
const importModules = [];
let appSource = readFileSync(appUrl, "utf8");
for (const match of appSource.matchAll(/^import\s+([\s\S]*?)\s+from\s+"([^"]+)";/gm)) {
  const index = importModules.length;
  importModules.push(await import(new URL(match[2], appUrl)));
  appSource = appSource.replace(match[0], `const ${match[1]} = __imports[${index}];`);
}
assert.match(appSource, /^init\(\);\r?$/m, "page bootstrap must be recognized");
appSource = appSource.replace(/^init\(\);\r?$/m, "");
appSource += `\n;globalThis.page = { state, els, api, loadPolicyRules, loadForcedLaborExemptions,
  loadUstrExclusionRows, loadAdditionalDuties, renderAdditionalCodes, renderDetail, applyRate,
  calculate, staticRuntime };`;

function element() {
  const classes = new Set();
  return {
    value: "0", checked: false, textContent: "", innerHTML: "", dataset: {},
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      toggle(value, enabled = !classes.has(value)) {
        if (enabled) classes.add(value); else classes.delete(value);
        return enabled;
      }
    },
    setAttribute() {}, addEventListener() {}, querySelectorAll: () => []
  };
}

async function openPage({ date = "2026-09-26T12:00:00.000Z", origin = "China", missingHeading = false } = {}) {
  const nodes = new Map();
  const location = new URL("https://example.github.io/hts-clearance-assistant/?static=1");
  const fixture = { missingHeading };
  const fetches = [];
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [date])); }
    static now() { return Date.parse(date); }
  }
  const context = vm.createContext({
    __imports: importModules, Date: Clock, URL, URLSearchParams, console,
    window: { location },
    document: {
      baseURI: location.href, body: element(),
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, element());
        return nodes.get(selector);
      },
      querySelectorAll: () => []
    },
    async fetch(url, options = {}) {
      const file = new URL(url).pathname.split("/data/")[1];
      assert.ok(file && !file.includes(".."), `unexpected fetch: ${url}`);
      fetches.push({ file, cache: options.cache });
      const snapshot = JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url), "utf8"));
      if (file === "chapter99.json" && fixture.missingHeading) {
        snapshot.value = snapshot.value.filter((row) => row.htsno !== "9903.88.69");
      }
      return { ok: true, json: async () => snapshot };
    }
  });
  vm.runInContext(appSource, context, { filename: "public/app.js" });
  const page = context.page;
  await page.loadPolicyRules();
  page.state.policyRules.defaultOriginCountry = origin;
  await page.loadForcedLaborExemptions();
  await page.loadUstrExclusionRows();
  page.els.customsValue.value = "10000";
  return { page, fixture, fetches };
}

async function selectHts(page, hts) {
  const response = await page.api(`/api/search?q=${hts}`);
  const row = response.value.find((candidate) => candidate.htsno.replace(/\D/g, "") === hts);
  assert.ok(row, `static search must resolve ${hts}`);
  page.state.selected = row;
  page.renderDetail(row);
  page.applyRate(row);
  await page.loadAdditionalDuties(row);
  assert.doesNotMatch(page.els.additionalDutyList.innerHTML, /读取失败/, "page must render successful duty lookup");
  return row;
}

function assertExcluded(page, row) {
  assert.equal(page.els.surchargeRate.textContent, "12.5%", "surcharge card must omit excluded 25%");
  assert.equal(page.els.additionalRate.value, "12.5", "calculator input must agree with surcharge card");
  assert.equal(page.els.generalRate.value, "3", "ordinary rate is not excluded");
  assert.equal(page.els.miniGeneralRate.textContent, "3%", "ordinary rate card is unchanged");
  assert.equal(page.els.baseDuty.textContent, "$300.00");
  assert.equal(page.els.extraDuty.textContent, "$1,250.00");
  assert.equal(page.els.totalDuty.textContent, "$1,550.00");
  assert.ok(!page.state.additionalDutyBreakdown.some((item) => item.code === "9903.88.03"));
  assert.ok(page.state.additionalDutyBreakdown.some((item) => item.code === "9903.05.31" && item.rate === 12.5));
  assert.match(page.els.surchargeBreakdown.textContent, /9903\.88\.03.*9903\.88\.69.*不计入/);
  assert.match(page.els.additionalDutyList.innerHTML, /not-applied excluded/);
  assert.match(page.els.restrictionList.innerHTML, /not-applied excluded/);
  assert.match(page.els.additionalDutyList.innerHTML, /25%/);
  assert.match(page.els.additionalDutyList.innerHTML, /2026-11-09/);
  assert.match(page.renderAdditionalCodes(row), /25% 已排除 · 不计入/);
  assert.doesNotMatch(page.els.additionalDutySplit.innerHTML, /9903\.88\.03|99038803/);
  assert.doesNotMatch(page.els.taxBreakdown.innerHTML, /37\.5%/);
}

const current = await openPage();
const listedRow = await selectHts(current.page, "3923210095");
assertExcluded(current.page, listedRow);

// Re-selecting a conditional product must clear the prior automatic exclusion;
// switching back must also restore the correct calculator amount.
const conditionalRow = await selectHts(current.page, "8516290090");
assert.ok(current.page.state.additionalDutyBreakdown.some((item) => item.code === "9903.88.03" && item.rate === 25));
assert.doesNotMatch(current.page.renderAdditionalCodes(conditionalRow), /已排除/);
assert.match(current.page.els.additionalDutyList.innerHTML, /条件豁免|待核|需复核|有豁免/);
assertExcluded(current.page, await selectHts(current.page, "3923210095"));

const finalDay = await openPage({ date: "2026-11-10T04:59:59.999Z" });
assertExcluded(finalDay.page, await selectHts(finalDay.page, "3923210095"));
for (const options of [
  { date: "2026-11-10T05:00:00.000Z" },
  { origin: "Canada" },
  { missingHeading: true }
]) {
  const { page } = await openPage(options);
  const row = await selectHts(page, "3923210095");
  assert.ok(page.state.additionalDutyBreakdown.some((item) => item.code === "9903.88.03" && item.rate === 25), JSON.stringify(options));
  assert.doesNotMatch(page.renderAdditionalCodes(row), /已排除/);
  assert.doesNotMatch(page.els.surchargeBreakdown.textContent, /已由.*排除/);
}

// A failed/missing heading must be recoverable through the real force-refresh
// cache path, including the search-list cache introduced for exclusion badges.
const refresh = await openPage({ missingHeading: true });
await selectHts(refresh.page, "3923210095");
refresh.fixture.missingHeading = false;
await refresh.page.loadUstrExclusionRows(true);
assert.ok(refresh.fetches.some((request) => request.file === "chapter99.json" && request.cache === "reload"));
assertExcluded(refresh.page, await selectHts(refresh.page, "3923210095"));

console.log("USTR 301 UI checks passed: real static API, search badges, duty cards, calculator, expiry, origin, conditional products, and refresh.");
