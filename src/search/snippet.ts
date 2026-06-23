import { parseQuery } from "./query";

const SNIPPET_MAX_LEN = 320;
const SNIPPET_CONTEXT_WORDS = 14;

function extractTerms(query: string): string[] {
  const parsed = parseQuery(query);
  const terms = new Set<string>();
  for (const phrase of parsed.phrases) {
    const normalized = phrase.toLowerCase().trim();
    if (normalized) terms.add(normalized);
  }
  for (const term of parsed.terms) {
    const normalized = term.toLowerCase().trim();
    if (normalized.length > 1) terms.add(normalized);
  }
  return Array.from(terms);
}

function countMatches(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const term of terms) {
    if (term.includes(" ")) {
      if (lower.includes(term)) count += 2;
    } else {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
      const matches = lower.match(regex);
      count += matches ? matches.length : 0;
    }
  }
  return count;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatchPositions(words: string[], terms: string[]): number[] {
  const positions: number[] = [];
  const lowerWords = words.map((w) => w.toLowerCase());

  for (const term of terms) {
    if (term.includes(" ")) {
      const parts = term.split(/\s+/).filter(Boolean);
      if (parts.length === 0) continue;
      outer: for (let i = 0; i <= lowerWords.length - parts.length; i++) {
        for (let j = 0; j < parts.length; j++) {
          if (!lowerWords[i + j].includes(parts[j])) continue outer;
        }
        for (let j = 0; j < parts.length; j++) {
          positions.push(i + j);
        }
      }
    } else {
      const escaped = escapeRegex(term);
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      for (let i = 0; i < lowerWords.length; i++) {
        if (regex.test(lowerWords[i])) positions.push(i);
      }
    }
  }

  return positions.length > 0 ? positions : [-1];
}

export function buildSnippet(text: string, query: string): string {
  const terms = extractTerms(query);
  if (terms.length === 0 || text.length === 0) {
    return text.slice(0, SNIPPET_MAX_LEN).replace(/\s+/g, " ").trim();
  }

  const words = text.split(/\s+/).filter(Boolean);
  const matchPositions = findMatchPositions(words, terms);

  if (matchPositions.length === 1 && matchPositions[0] === -1) {
    return text.slice(0, SNIPPET_MAX_LEN).replace(/\s+/g, " ").trim();
  }

  let bestStart = 0;
  let bestScore = -1;

  for (const center of matchPositions) {
    const start = Math.max(0, center - SNIPPET_CONTEXT_WORDS);
    const end = Math.min(words.length, center + SNIPPET_CONTEXT_WORDS + 1);
    const window = words.slice(start, end).join(" ");
    const score = countMatches(window, terms);

    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  const start = bestStart;
  const end = Math.min(words.length, start + SNIPPET_CONTEXT_WORDS * 2 + 1);
  let snippet = words.slice(start, end).join(" ");

  if (start > 0) snippet = `… ${snippet}`;
  if (end < words.length) snippet = `${snippet} …`;

  if (snippet.length > SNIPPET_MAX_LEN) {
    snippet = `${snippet
      .slice(0, SNIPPET_MAX_LEN)
      .trim()
      .replace(/\s+\S*$/, "")}…`;
  }

  return snippet;
}
