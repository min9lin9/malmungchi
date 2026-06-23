export interface ParsedQuery {
  phrases: string[];
  terms: string[];
  operator: "and" | "or";
}

export function parseQuery(query: string): ParsedQuery {
  const normalized = query.replace(/[\u201C\u201D]/g, '"');
  const phrases: string[] = [];

  let stripped = normalized.replace(/"([^"]*)"/g, (_, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed.length > 1) phrases.push(trimmed);
    return "";
  });

  const operator: "and" | "or" = /\bOR\b/i.test(stripped) ? "or" : "and";
  stripped = stripped.replace(/\bOR\b/gi, " ");

  const terms = stripped
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);

  return { phrases, terms, operator };
}

export function hasMeaningfulContent(parsed: ParsedQuery): boolean {
  return parsed.phrases.length > 0 || parsed.terms.length > 0;
}
