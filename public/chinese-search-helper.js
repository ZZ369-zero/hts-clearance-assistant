import { chineseSearchCatalog, isMaterialCatalogEntry } from "./search-catalog.js";

export function buildChineseSearchPlan(query, { translatedQuery = "" } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const catalogMatches = chineseSearchCatalog
    .map((entry) => ({
      ...entry,
      matchedTerms: entry.terms.filter((term) => normalizedQuery.includes(normalizeSearchText(term)))
    }))
    .filter((entry) => entry.matchedTerms.length)
    .sort((a, b) => longestTermLength(b.matchedTerms) - longestTermLength(a.matchedTerms));

  const maxMatchedLength = Math.max(
    0,
    ...catalogMatches.flatMap((entry) => entry.matchedTerms).map((term) => [...term].length)
  );
  const focusedMatches = maxMatchedLength > 1
    ? catalogMatches.filter((entry) => longestTermLength(entry.matchedTerms) > 1)
    : catalogMatches;
  const productMatches = focusedMatches.filter((entry) => !isMaterialCatalogEntry(entry));
  const materialMatches = focusedMatches.filter(isMaterialCatalogEntry);
  const maxProductLength = Math.max(0, ...productMatches.map((entry) => longestTermLength(entry.matchedTerms)));
  const primaryProductMatches = maxProductLength > 1
    ? productMatches.filter((entry) => longestTermLength(entry.matchedTerms) === maxProductLength)
    : productMatches;
  const selectedMatches = primaryProductMatches.length
    ? [...primaryProductMatches, ...materialMatches]
    : materialMatches;

  const productTerms = uniqueNormalized(primaryProductMatches.flatMap((entry) => entry.queries || []));
  const materialTerms = uniqueNormalized(materialMatches.flatMap((entry) => entry.queries || []));
  const relatedTerms = uniqueNormalized(primaryProductMatches.flatMap((entry) => entry.relatedQueries || []));
  const translatedTerms = buildTranslatedTerms(translatedQuery);
  const hasProductMatch = primaryProductMatches.length > 0;
  const directTerms = uniqueNormalized([
    ...(hasProductMatch ? productTerms : materialTerms),
    ...translatedTerms
  ]);
  const chineseTerms = uniqueNormalized([
    ...selectedMatches.flatMap((entry) => entry.matchedTerms || []),
    normalizedQuery
  ]);

  return {
    aliasMatched: selectedMatches.length > 0,
    terms: directTerms.length ? directTerms : splitSearchTerms(normalizedQuery),
    productTerms,
    materialTerms,
    relatedTerms,
    translatedTerms,
    chineseTerms,
    productLabels: uniqueValues(primaryProductMatches.flatMap((entry) => entry.matchedTerms || [])),
    materialLabels: uniqueValues(materialMatches.flatMap((entry) => entry.matchedTerms || [])),
    chapterBoosts: new Set(selectedMatches.flatMap((entry) => entry.chapters || [])),
    prefixBoosts: uniqueValues(
      selectedMatches
        .flatMap((entry) => entry.prefixBoosts || [])
        .map(normalizeHtsDigits)
        .filter(Boolean)
    ),
    hints: uniqueValues(selectedMatches.flatMap((entry) => entry.hints || [])),
    hasProductMatch,
    requireAllTerms: selectedMatches.length === 0 && !translatedTerms.length,
    minimumMatches: translatedTerms.length >= 3 && !selectedMatches.length ? 2 : 1,
    displayQuery: uniqueValues([
      ...primaryProductMatches.flatMap((entry) => entry.queries || []),
      ...materialMatches.flatMap((entry) => entry.queries || []),
      ...(translatedQuery ? [translatedQuery] : [])
    ]).slice(0, 6).join(" / ") || normalizedQuery
  };
}

export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[，。；：、（）【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSearchTerms(value) {
  return String(value || "")
    .split(/[\s,，;；/、|]+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function buildTranslatedTerms(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }
  return uniqueNormalized([normalized, ...splitSearchTerms(normalized)]);
}

function uniqueNormalized(values) {
  return uniqueValues(values.map(normalizeSearchText).filter(Boolean));
}

function uniqueValues(values) {
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

function longestTermLength(terms) {
  return Math.max(0, ...terms.map((term) => [...String(term || "")].length));
}

function normalizeHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}
