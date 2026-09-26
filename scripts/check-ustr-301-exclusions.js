import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyChapter99ExclusionRules, normalizeUstrEntryDate } from "../public/ustr-301-exclusion-engine.js";

const chapter99 = JSON.parse(await readFile(new URL("../public/data/chapter99.json", import.meta.url), "utf8"));
const rowsByCode = new Map(chapter99.value.filter((row) => ["9903.88.03", "9903.88.69"].includes(row.htsno)).map((row) => [row.htsno, row]));
assert.equal(rowsByCode.size, 2, "Deployed data must contain the base and exclusion headings");
const subject = Object.freeze({ htsno: "3923.21.00.95", general: "3%" });
const rules = [
  { code: "9903.88.03", group: "301", autoApply: true, rate: 25, note: "基础 301 加征" },
  { code: "9903.88.69", group: "301", autoApply: false, rate: null },
  { code: "other-test-duty", group: "OTHER", autoApply: true, rate: 12.5 }
];
const originalRules = structuredClone(rules);
const originalRows = structuredClone([...rowsByCode]);
rules.forEach(Object.freeze);
Object.freeze(rules);
const context = { originCountry: "China", entryDate: "2026-09-26" };
const apply = (overrides = {}, row = subject, data = rowsByCode, inputRules = rules) => applyChapter99ExclusionRules(inputRules, data, row, { ...context, ...overrides });
const baseRule = (result) => result.find((rule) => rule.code === "9903.88.03");
const total = (result) => result.filter((rule) => rule.autoApply && !rule.exempt && !rule.exclusionApplies).reduce((sum, rule) => sum + (rule.rate || 0), 0);
const assertExcluded = (result, label) => {
  const base = baseRule(result);
  assert.equal(base.exclusionApplies, true, label);
  assert.equal(base.autoApply, false, label);
  assert.equal(base.exemptionStatus, "已排除", label);
  assert.equal(base.rate, 25, "The original 25% remains visible for audit");
  assert.equal(total(result), 12.5, "Only the 301 contribution changes from 25 to zero; other duties remain");
};
const assertNotExcluded = (result, label) => {
  assert.notEqual(baseRule(result).exclusionApplies, true, label);
  assert.equal(baseRule(result).autoApply, true, label);
  assert.equal(total(result), 37.5, label);
};

const result = apply();
assertExcluded(result, "The explicitly listed statistical code qualifies");
assert.equal(baseRule(result).exemptionMatchedHts, subject.htsno);
assert.match(baseRule(result).summaryZh, /20\(vvv\)\(iii\)\(8\)/);
assert.equal(baseRule(result).possibleExemptions.length, 0, "Matched exclusions are not still shown as possible");
assert.equal(baseRule(result).exemptionSources.length, 2, "Both scope and extension have official evidence");
assert.equal(subject.general, "3%", "Ordinary duty remains unchanged");
assert.equal(3 + total(result), 15.5, "The total retains 3% ordinary duty and unrelated 12.5%");

for (const date of ["2024-06-15", "2026-11-08", "2026-11-09", "2026-11-10T04:59:59Z", "2026-11-10T12:59:59+08:00"]) {
  assertExcluded(apply({ entryDate: date }), `Valid entry date: ${date}`);
}
for (const date of ["2024-06-14", "2024-06-15T03:59:59Z", "2026-11-10", "2026-11-10T05:00:00Z", "2026-11-10T13:00:00+08:00"]) {
  assertNotExcluded(apply({ entryDate: date }), `Outside the legal date interval: ${date}`);
}
assertExcluded(apply({ entryDate: "2024-06-15T04:00:00Z" }), "Start uses Eastern daylight time");
assert.equal(normalizeUstrEntryDate("2026-11-09"), "2026-11-09", "Date-only input must not shift into a different day");
assert.equal(normalizeUstrEntryDate("2026-11-10T04:59:59Z"), "2026-11-09");
assert.equal(normalizeUstrEntryDate(new Date("2026-11-10T04:59:59Z")), "2026-11-09");
assert.equal(normalizeUstrEntryDate("20260228"), "2026-02-28");
assert.equal(normalizeUstrEntryDate("2024-02-29"), "2024-02-29");
for (const date of ["", "invalid", "2026-02-29", "2026-09-31", "2026-11-09T12:00:00", "2026-09-31T12:00:00Z", new Date(NaN), null]) {
  assert.equal(normalizeUstrEntryDate(date), "", `Reject invalid or ambiguous date: ${date}`);
  assertNotExcluded(apply({ entryDate: date }), "Invalid entry dates never produce an exemption");
}
assertExcluded(apply({ entryDate: undefined, referenceDate: new Date("2026-11-09T12:00:00Z") }), "Reference date is supported");
assertNotExcluded(apply({ entryDate: "invalid", referenceDate: "2026-09-26" }), "Invalid explicit entry date cannot fall back to a valid reference date");

for (const origin of ["CN", "中国", "china"]) {
  assertExcluded(apply({ originCountry: origin }), `Explicit China origin: ${origin}`);
}
for (const origin of [undefined, "", "US", "Vietnam", "Hong Kong", "China or Vietnam"]) {
  assertNotExcluded(apply({ originCountry: origin }), `Origin does not establish China: ${origin}`);
}
assertExcluded(apply({}, { htsno: "3923.21.0095" }), "Alternate official punctuation matches the same ten digits");
assertExcluded(apply({}, { htsno: "3923210095" }), "Unpunctuated statistical code matches");
for (const code of ["3923.21.00", "3923", "3923.21.00.30", "3923.21.00.96", "3923.21.00.95other", "8516.29.00.90"]) {
  assertNotExcluded(apply({}, { htsno: code }), `Never extend the exclusion to parent or other statistical codes: ${code}`);
}
const fireplace = baseRule(apply({}, { htsno: "8516.29.00.90" })).possibleExemptions[0];
assert.match(fireplace.conditionZh, /55 公斤/);
assert.equal(fireplace.autoExempt, false, "8516.29.00.90 still requires product-level confirmation");
assert.equal(baseRule(apply({}, { htsno: "1234.56.78.90" })).possibleExemptions[0].status, "possible", "Generic conditional exclusions remain available");

assertNotExcluded(apply({}, subject, new Map()), "Missing official headings never auto-exempt");
assertNotExcluded(apply({}, subject, new Map([["9903.88.03", rowsByCode.get("9903.88.03")]])), "Missing exclusion heading never auto-exempts");
assertNotExcluded(apply({}, subject, new Map([["9903.88.69", rowsByCode.get("9903.88.69")]])), "Missing base heading never auto-exempts");
assertNotExcluded(apply({}, subject, rowsByCode, rules.filter((rule) => rule.code !== "9903.88.69")), "The product must actually reference the exclusion heading");
for (const [code, patch] of [
  ["9903.88.03", { description: "Articles the product of China", descriptionEn: "", descriptionZh: "" }],
  ["9903.88.03", { description: "Except as provided in heading 9903.88.690", descriptionEn: "", descriptionZh: "" }],
  ["9903.88.03", { description: "Not an exception: 9903.88.69", descriptionEn: "", descriptionZh: "" }],
  ["9903.88.69", { description: "Articles the product of China", descriptionEn: "", descriptionZh: "" }],
  ["9903.88.69", { description: "Articles the product of China, covered by an exclusion", descriptionEn: "", descriptionZh: "" }],
  ["9903.88.69", { general: "The duty provided in the applicable subheading + 25%" }],
  ["9903.88.69", { general: "" }],
  ["9903.88.69", { htsno: "9903.88.68" }]
]) {
  const altered = new Map(rowsByCode);
  altered.set(code, { ...altered.get(code), ...patch });
  assertNotExcluded(apply({}, subject, altered), `Incomplete or inconsistent official relationship: ${JSON.stringify(patch)}`);
}
const extraBase = apply({}, subject, rowsByCode, [...rules, { code: "9903.88.04", rate: 25, autoApply: true }]);
assert.notEqual(extraBase.find((rule) => rule.code === "9903.88.04").exclusionApplies, true, "Only the implemented base heading may auto-exempt");
assert.deepEqual(rules, originalRules, "Input rules are not mutated");
assert.deepEqual([...rowsByCode], originalRows, "Official rows are not mutated");

console.log("USTR 301 exclusion sentinels passed: official listed HTS, origin, inclusive U.S. entry dates, missing-evidence safeguards, unchanged ordinary/other duties, and conditional product exclusions.");
