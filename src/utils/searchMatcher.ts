/**
 * Levenshtein distance calculation for typo tolerance.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }

  return row[b.length];
}

/**
 * Intelligent fuzzy matching for product search:
 * - Substring matching (case-insensitive)
 * - Punctuation & space normalization (e.g., "B.a" or "b-a" matches "Balozi")
 * - Subsequence matching (acronyms, skipped chars, e.g. "b.a" or "tk" in "Tusker Keg")
 * - Word token partial matching
 * - Typo tolerance via Levenshtein distance (e.g., "Blozi" -> "Balozi", "Tuskr" -> "Tusker", "Guines" -> "Guinness")
 */
export function intelligentMatch(query: string, targetName: string): boolean {
  if (!query) return true;
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) return true;
  const cleanT = (targetName || '').toLowerCase();

  // 1. Direct exact or substring match
  if (cleanT.includes(cleanQ)) {
    return true;
  }

  // 2. Normalized alphanumeric match (strips '.', '-', '_', spaces, quotes)
  const normQ = cleanQ.replace(/[^a-z0-9]/g, '');
  const normT = cleanT.replace(/[^a-z0-9]/g, '');

  if (normQ && normT.includes(normQ)) {
    return true;
  }

  // 3. Subsequence match (acronyms / abbreviations, e.g. "B.a" or "blz" in "Balozi")
  if (normQ.length >= 2) {
    let qIdx = 0;
    for (let i = 0; i < normT.length && qIdx < normQ.length; i++) {
      if (normT[i] === normQ[qIdx]) {
        qIdx++;
      }
    }
    if (qIdx === normQ.length) {
      return true;
    }
  }

  // 4. Word-by-word token matching with typo tolerance
  const qTokens = cleanQ.split(/[\s.\-_/]+/).filter(Boolean);
  const tTokens = cleanT.split(/[\s.\-_/]+/).filter(Boolean);

  if (qTokens.length > 0) {
    const allTokensMatch = qTokens.every((qTok) => {
      return tTokens.some((tTok) => {
        // Direct prefix or substring
        if (tTok.startsWith(qTok) || tTok.includes(qTok)) {
          return true;
        }
        // Typo tolerance for words 3+ characters long
        if (qTok.length >= 3) {
          const maxDist = qTok.length <= 4 ? 1 : 2;
          const prefixDist = levenshteinDistance(qTok, tTok.slice(0, qTok.length + 1));
          if (prefixDist <= maxDist) return true;
          const fullDist = levenshteinDistance(qTok, tTok);
          if (fullDist <= maxDist) return true;
        }
        return false;
      });
    });

    if (allTokensMatch) {
      return true;
    }
  }

  // 5. Global sliding-window typo tolerance for whole normalized query (length >= 4)
  if (normQ.length >= 4) {
    const maxWindow = normT.length - normQ.length + 1;
    for (let i = 0; i <= maxWindow; i++) {
      const slice = normT.slice(i, i + normQ.length);
      if (levenshteinDistance(normQ, slice) <= 1) {
        return true;
      }
    }
  }

  return false;
}
