import { normalizeSearchText } from "./chinese-search-helper.js";

const tierPriority = {
  exact: 3,
  direct: 2,
  related: 1
};

export function rankHtsSearchCandidates(candidates, plan, { limit = 120 } = {}) {
  return candidates
    .map((candidate, sourceOrder) => {
      const match = scoreHtsSearchCandidate(candidate, plan);
      return {
        row: match.score > 0
          ? { ...candidate.row, searchMatch: match.searchMatch }
          : candidate.row,
        score: match.score,
        specificity: scoreCodeSpecificity(candidate.row, plan),
        sourceOrder
      };
    })
    .filter((item) => item.row.htsno && item.score > 0)
    .sort((a, b) =>
      b.score - a.score
      || (tierPriority[b.row.searchMatch?.tier] || 0) - (tierPriority[a.row.searchMatch?.tier] || 0)
      || b.specificity - a.specificity
      || a.sourceOrder - b.sourceOrder
    )
    .slice(0, limit);
}

export function scoreHtsSearchCandidate(candidate, plan) {
  const row = candidate.row;
  const htsDigits = normalizeHtsDigits(row.htsno);
  if (plan.hasProductMatch
      && ["98", "99"].includes(htsDigits.slice(0, 2))
      && !plan.chapterBoosts?.has(htsDigits.slice(0, 2))) {
    return noMatch();
  }
  const ownDescription = normalizeSearchText(candidate.ownText || "");
  const primaryTerms = plan.hasProductMatch
    ? plan.productTerms || plan.terms || []
    : plan.terms || [];
  const primaryMatch = bestTermFamilyMatch(candidate, primaryTerms);
  const translatedMatch = plan.translatedTerms?.length
    ? bestTermFamilyMatch(candidate, plan.translatedTerms)
    : emptyMatch();
  const chineseMatch = bestTermFamilyMatch(candidate, plan.chineseTerms || []);
  const relatedMatch = bestTermFamilyMatch(candidate, plan.relatedTerms || []);
  const materialMatch = bestTermFamilyMatch(candidate, plan.materialTerms || []);
  const requiredMatches = plan.hasProductMatch
    ? Number(primaryMatch.score > 0 || translatedMatch.score > 0)
    : countRequiredTermMatches(candidate, plan.terms || []);

  if (plan.requireAllTerms && requiredMatches < (plan.terms || []).length) {
    return noMatch();
  }
  if (plan.hasProductMatch && !primaryMatch.score && !translatedMatch.score && !relatedMatch.score) {
    return noMatch();
  }
  if (plan.hasProductMatch && !primaryMatch.score && !translatedMatch.score && relatedMatch.score
      && plan.materialTerms?.length && !materialMatch.score) {
    return noMatch();
  }
  if (!requiredMatches && !chineseMatch.score && !relatedMatch.score && !materialMatch.score) {
    return noMatch();
  }
  if (!plan.hasProductMatch && requiredMatches < (plan.minimumMatches || 1)) {
    return noMatch();
  }

  let score = 0;
  score += primaryMatch.score;
  score += Math.round(translatedMatch.score * 0.9);
  score += Math.round(chineseMatch.score * 0.8);
  score += Math.round(relatedMatch.score * 0.58);
  score += Math.round(materialMatch.score * 0.55);

  if (primaryMatch.score || translatedMatch.score) {
    score += 110;
  } else if (relatedMatch.score) {
    score += 35;
  }
  if (materialMatch.score) {
    score += 30;
  }

  const chapterMatched = htsDigits && plan.chapterBoosts?.has(htsDigits.slice(0, 2));
  const matchedPrefix = findLongestPrefix(htsDigits, plan.prefixBoosts || []);
  if (chapterMatched) {
    score += 100;
  }
  if (matchedPrefix) {
    score += matchedPrefix.length >= 8
      ? 390
      : matchedPrefix.length >= 6
        ? 340
        : matchedPrefix.length >= 4
          ? 250
          : 130;
  } else if (plan.hasProductMatch && plan.prefixBoosts?.length) {
    score -= 360;
  }

  const ownPrimary = primaryMatch.location === "own" || translatedMatch.location === "own";
  const exactOwnPhrase = primaryMatch.exact || translatedMatch.exact || chineseMatch.exact;
  if (ownPrimary) {
    score += 135;
  }
  if (exactOwnPhrase) {
    score += 110;
  }
  if (ownDescription && (primaryMatch.starts || translatedMatch.starts || chineseMatch.starts)) {
    score += 65;
  }

  score += scoreCodeSpecificity(row, plan);
  score -= scoreAccessoryPenalty(row, plan);

  const tier = ownPrimary || exactOwnPhrase
    ? "exact"
    : primaryMatch.score || translatedMatch.score || (matchedPrefix && relatedMatch.score)
      ? "direct"
      : "related";
  const reasons = [];
  if (plan.productLabels?.length) {
    reasons.push(`品类：${plan.productLabels[0]}`);
  }
  if (materialMatch.score && plan.materialLabels?.length) {
    reasons.push(`材质：${plan.materialLabels[0]}`);
  } else if (plan.materialLabels?.length) {
    reasons.push(`材质待确认：${plan.materialLabels[0]}`);
  }
  if (ownPrimary || exactOwnPhrase) {
    reasons.push("本级商品描述命中");
  } else if (primaryMatch.location === "parent" || translatedMatch.location === "parent" || matchedPrefix) {
    reasons.push("官方 HTS 层级命中");
  } else if (tier === "related") {
    reasons.push("相似用途或归类描述");
  }
  if (htsDigits.length === 10) {
    reasons.push("完整 10 位税号");
  }

  return {
    score: Math.max(0, score),
    searchMatch: {
      tier,
      reasons: reasons.slice(0, 3)
    }
  };
}

function bestTermFamilyMatch(candidate, terms) {
  let best = emptyMatch();
  for (const term of uniqueTerms(terms)) {
    const match = scoreCandidateTerm(candidate, term);
    if (match.score > best.score) {
      best = match;
    }
  }
  return best;
}

function countRequiredTermMatches(candidate, terms) {
  return uniqueTerms(terms)
    .filter((term) => scoreCandidateTerm(candidate, term).score > 0)
    .length;
}

function scoreCandidateTerm(candidate, term) {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) {
    return emptyMatch();
  }

  const ownDescription = normalizeSearchText(candidate.ownText || "");
  const ownScore = scoreSearchTerm(ownDescription, normalizedTerm);
  if (ownScore > 0) {
    const exact = ownDescription === normalizedTerm;
    const starts = descriptionStartsWithTerm(ownDescription, normalizedTerm);
    return {
      score: ownScore + (exact ? 175 : starts ? 90 : 0),
      location: "own",
      exact,
      starts,
      distance: 0,
      term: normalizedTerm
    };
  }

  const path = Array.isArray(candidate.row?.classificationPath)
    ? candidate.row.classificationPath
    : [];
  for (let index = path.length - 1, distance = 1; index >= 0; index -= 1, distance += 1) {
    const parentDescription = normalizeSearchText(
      `${path[index].description || ""} ${path[index].descriptionZh || ""}`
    );
    if (hasNegativeContext(parentDescription, normalizedTerm)) {
      continue;
    }
    const parentScore = scoreSearchTerm(parentDescription, normalizedTerm);
    if (parentScore > 0) {
      const starts = descriptionStartsWithTerm(parentDescription, normalizedTerm);
      return {
        score: Math.round(parentScore * 0.58) + Math.max(12, 62 - distance * 10) + (starts ? 25 : 0),
        location: "parent",
        exact: false,
        starts,
        distance,
        term: normalizedTerm
      };
    }
  }

  const parentHaystack = normalizeSearchText(candidate.parentText || "");
  if (!hasNegativeContext(parentHaystack, normalizedTerm)) {
    const parentScore = scoreSearchTerm(parentHaystack, normalizedTerm);
    if (parentScore > 0) {
      return {
        score: Math.round(parentScore * 0.35),
        location: "parent",
        exact: false,
        starts: false,
        distance: 99,
        term: normalizedTerm
      };
    }
  }
  return emptyMatch();
}

function scoreCodeSpecificity(row, plan = {}) {
  const digits = normalizeHtsDigits(row.htsno);
  let score = 0;
  if (digits.length >= 10) {
    score += 230;
  } else if (digits.length >= 8) {
    score += 85;
  } else if (digits.length >= 6) {
    score += 25;
  } else if (digits.length >= 4) {
    score -= 35;
  }

  if (String(row.general || "").trim()) {
    score += 35;
  } else {
    score -= 35;
  }
  if (plan.aliasMatched && digits.length < 10) {
    score -= digits.length < 8 ? 260 : 150;
  }
  if (String(row.description || "").trim().endsWith(":")) {
    score -= 25;
  }
  return score;
}

function scoreAccessoryPenalty(row, plan) {
  const text = normalizeSearchText(`${row.description || ""} ${row.descriptionZh || ""}`);
  const queryTerms = [...(plan.terms || []), ...(plan.chineseTerms || [])]
    .map((term) => normalizeSearchText(term));
  let penalty = 0;

  if (queryTerms.some((term) => ["mango", "mangoes", "芒果"].includes(term)) && /\bmangosteens?\b/.test(text)) {
    penalty += 300;
  }
  if (queryTerms.some((term) => term.includes("christmas tree") || term === "圣诞树") && /\bartificial\b/.test(text)) {
    penalty += 300;
  }
  const watchQuery = (plan.prefixBoosts || []).some((prefix) => ["9101", "9102", "9103", "9105"].includes(prefix));
  if (watchQuery && /^straps,\s*bands\s+or\s+bracelets\s+entered\s+with\s+watches/.test(text)) {
    penalty += 240;
  }
  const apparelQuery = queryTerms.some((term) =>
    ["apparel", "clothing", "garment", "garments", "wearing apparel", "服饰", "服装", "衣服", "衣物", "成衣"].includes(term)
  );
  if (apparelQuery && /^garments\s+described\s+in\s+heading\b/.test(text)) {
    penalty += 200;
  }
  return penalty;
}

function scoreSearchTerm(haystack, term) {
  if (!term) {
    return 0;
  }
  if (hasChineseText(term)) {
    return haystack.includes(term) ? 85 + Math.min(50, [...term].length * 8) : 0;
  }
  const pattern = escapeRegExp(term).replace(/\s+/g, "\\s+");
  if (new RegExp(`(^|[^a-z0-9])${pattern}([^a-z0-9]|$)`, "i").test(haystack)) {
    return 55 + Math.min(70, term.length * 2);
  }
  return term.length >= 4 && haystack.includes(term) ? 18 : 0;
}

function descriptionStartsWithTerm(description, term) {
  if (!term) {
    return false;
  }
  if (hasChineseText(term)) {
    return description.startsWith(term);
  }
  const pattern = escapeRegExp(term).replace(/\s+/g, "\\s+");
  return new RegExp(`^${pattern}([^a-z0-9]|$)`, "i").test(description);
}

function hasNegativeContext(haystack, term) {
  if (!term || hasChineseText(term)) {
    return false;
  }
  const pattern = escapeRegExp(term).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b(?:except|excluding|exclude|other\\s+than|not)\\b[^.;:]{0,90}${pattern}`, "i").test(haystack);
}

function findLongestPrefix(htsDigits, prefixes) {
  return [...prefixes]
    .map(normalizeHtsDigits)
    .filter((prefix) => prefix && htsDigits.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0] || "";
}

function uniqueTerms(terms) {
  return [...new Set((terms || []).map(normalizeSearchText).filter(Boolean))];
}

function normalizeHtsDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emptyMatch() {
  return {
    score: 0,
    location: "",
    exact: false,
    starts: false,
    distance: Infinity,
    term: ""
  };
}

function noMatch() {
  return { score: 0, searchMatch: null };
}
