import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHAPTER_91_STATISTICAL_BASE_COUNT,
  CHAPTER_91_STATISTICAL_REPORTING_COUNT,
  expandChapter91StatisticalRows,
  getChapter91StatisticalSubheadings
} from "../public/chapter91-statistical-notes.js";
import { expandHtsPrefixRows, getPreferredDescriptionZh } from "../public/description-helper.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chapterPath = path.join(rootDir, "public", "data", "chapters", "91.json");
const chapter = JSON.parse(await readFile(chapterPath, "utf8"));
const sourceRows = chapter.value || [];
const noteParents = sourceRows.filter((row) =>
  (row.footnotes || []).some((note) => /See statistical note 1 to this chapter/i.test(note.value || ""))
);
const sourceParents = new Set(noteParents.map((row) => digits(row.htsno)));
const configuredParents = new Set(getChapter91StatisticalSubheadings());

assert(CHAPTER_91_STATISTICAL_BASE_COUNT === 95, `Expected 95 base subheadings, got ${CHAPTER_91_STATISTICAL_BASE_COUNT}`);
assert(CHAPTER_91_STATISTICAL_REPORTING_COUNT === 293, `Expected 293 reporting rows, got ${CHAPTER_91_STATISTICAL_REPORTING_COUNT}`);
assert(sourceParents.size === 95, `Current Chapter 91 snapshot has ${sourceParents.size} note-1 base subheadings instead of 95`);
assertSetsEqual(configuredParents, sourceParents, "Configured Chapter 91 subheadings do not match the current official snapshot");

const expanded = expandChapter91StatisticalRows(sourceRows);
const expandedTwice = expandChapter91StatisticalRows(expanded);
assert(expanded.length === sourceRows.length + 293, `Expected 293 synthesized rows, got ${expanded.length - sourceRows.length}`);
assert(expandedTwice.length === expanded.length, "Chapter 91 statistical expansion is not idempotent");

const reportingRows = expanded.filter((row) => row.derivedFromChapterNote);
const reportingCodes = new Set(reportingRows.map((row) => digits(row.htsno)));
assert(reportingRows.length === 293, `Expected 293 derived rows, got ${reportingRows.length}`);
assert(reportingCodes.size === 293, `Expected 293 unique derived codes, got ${reportingCodes.size}`);
assert(reportingRows.every((row) => digits(row.htsno).length === 10), "Every derived reporting number must contain 10 digits");

for (const row of reportingRows) {
  const reportingDigits = digits(row.htsno);
  const result = expandHtsPrefixRows(expanded, reportingDigits, { limit: 10 });
  assert(
    result.rows.length === 1 && digits(result.rows[0].htsno) === reportingDigits,
    `Exact search did not resolve derived reporting number ${reportingDigits}`
  );
}

const acClock = reportingRows.find((row) => digits(row.htsno) === "9105114010");
assert(acClock, "9105.11.40.10 was not synthesized");
assert(acClock.description === "Clocks capable of operating only on AC power", "9105.11.40.10 has the wrong English description");
assert(acClock.descriptionZh === "仅能使用交流电源运行的钟", "9105.11.40.10 has the wrong Chinese description");
assert(acClock.general === "3.9% on the movement and case + 5.3% on the battery", "9105.11.40.10 did not inherit the compound general rate");
assert(acClock.units?.includes("No."), "9105.11.40.10 did not inherit the official reporting unit");
assert(
  getPreferredDescriptionZh({ htsno: "9105.11", description: "Electrically operated:" }) === "电动式：",
  "The verified Chapter 91 translation override for 'Electrically operated' is missing"
);
assert(
  getPreferredDescriptionZh({ htsno: "9105.11.40", description: "With opto-electronic display only" }) === "仅带光电显示器。",
  "The verified Chapter 91 opto-electronic display translation is missing"
);

for (const expectedCode of ["9101114040", "9105118005", "9105193030", "9106905520", "9109108030"]) {
  assert(reportingCodes.has(expectedCode), `Missing representative statistical reporting number ${expectedCode}`);
}

console.log(`Chapter 91 statistical notes: ${configuredParents.size} base subheadings, ${reportingRows.length} reporting numbers verified.`);

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function assertSetsEqual(actual, expected, message) {
  const missing = [...expected].filter((value) => !actual.has(value));
  const extra = [...actual].filter((value) => !expected.has(value));
  assert(!missing.length && !extra.length, `${message}; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
