/**
 * Lightweight fuzzy search over the tool registry. Subsequence matching with a
 * relevance score (prefix > word-boundary > contiguous > scattered), weighted by
 * field (name > keywords/tags > description). Good enough for ~250 tools with
 * zero dependencies, fully client-side.
 */
import type { ToolMetaStatic } from './registry/types';

export interface ScoredTool {
  tool: ToolMetaStatic;
  score: number;
}

/** Subsequence score in [0,1], or -1 if `query` is not a subsequence of `text`. */
function subsequenceScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  const idx = t.indexOf(q);
  if (idx === 0) return 1; // prefix
  if (idx > 0) {
    // contiguous; bonus if it starts on a word boundary
    const boundary = idx === 0 || /[\s\-_/.]/.test(t[idx - 1] ?? '');
    return boundary ? 0.85 : 0.7 - Math.min(idx, 20) / 100;
  }

  // scattered subsequence
  let ti = 0;
  let matched = 0;
  let gaps = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]!;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    if (found > ti) gaps++;
    ti = found + 1;
    matched++;
  }
  if (matched < q.length) return -1;
  return Math.max(0.15, 0.5 - gaps / 40);
}

export function scoreTool(tool: ToolMetaStatic, query: string): number {
  if (!query.trim()) return 0;
  const q = query.trim();

  const name = subsequenceScore(q, tool.name);
  const slug = subsequenceScore(q, tool.slug);
  const kw = Math.max(
    -1,
    ...tool.keywords.map((k) => subsequenceScore(q, k)),
    ...tool.tags.map((k) => subsequenceScore(q, k))
  );
  const desc = subsequenceScore(q, tool.description);
  const cat = subsequenceScore(q, tool.category);

  const best =
    Math.max(
      name * 1.0,
      slug * 0.95,
      kw * 0.8,
      cat * 0.6,
      desc * 0.45
    ) ?? -1;

  return best;
}

export function searchTools(
  tools: ToolMetaStatic[],
  query: string,
  limit = 50
): ToolMetaStatic[] {
  if (!query.trim()) return tools;
  const scored: ScoredTool[] = [];
  for (const tool of tools) {
    const score = scoreTool(tool, query);
    if (score > 0) scored.push({ tool, score });
  }
  scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  return scored.slice(0, limit).map((s) => s.tool);
}
