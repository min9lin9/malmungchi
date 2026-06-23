import type { SearchExplainCompareResult } from "../search/compare";

export function formatSearchCompareResult(
  result: SearchExplainCompareResult,
  maxChars: number
): string {
  if (!result.supported) {
    return truncate(
      [
        `# Search Explanation Compare: "${result.query}"`,
        "",
        `- Engine: ${result.engine}`,
        `- Supported: false`,
        `- Reason: ${result.reason}`,
        "",
        "This engine manages ranking internally, so weighted vs RRF comparison is unavailable.",
      ].join("\n"),
      maxChars
    );
  }

  const lines = [
    `# Search Explanation Compare: "${result.query}"`,
    "",
    `- Engine: ${result.engine}`,
    `- Limit: ${result.limit}`,
    `- Overlap: ${result.overlap}`,
    `- Weighted top: ${result.weightedTop.join(", ") || "(none)"}`,
    `- RRF top: ${result.rrfTop.join(", ") || "(none)"}`,
    "",
  ];
  for (const item of result.items) {
    lines.push(
      `## ${item.slug}`,
      `- Weighted rank: ${item.weightedRank ?? "(missing)"}`,
      `- RRF rank: ${item.rrfRank ?? "(missing)"}`,
      `- Rank delta: ${item.rankDelta ?? "(n/a)"}`
    );
    if (item.weightedSignals) {
      lines.push(`- Weighted fields: ${item.weightedSignals.matchedFields.join(", ")}`);
    }
    if (item.rrfSignals) {
      lines.push(`- RRF fields: ${item.rrfSignals.matchedFields.join(", ")}`);
    }
    lines.push("");
    const output = lines.join("\n");
    if (output.length > maxChars) return truncate(output, maxChars);
  }
  return truncate(lines.join("\n"), maxChars);
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n...(truncated)`;
}
