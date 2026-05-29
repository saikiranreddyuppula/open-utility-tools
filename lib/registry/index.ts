/**
 * Public registry API. Reads the generated manifest (static metadata + lazy
 * component loaders) and exposes lookups used by routing, the homepage, search,
 * and the command palette.
 */
import {
  CATEGORIES,
  CATEGORY_META,
  type ToolCategory,
  type ToolMetaStatic,
} from './types';
import { TOOL_META, TOOL_COMPONENTS } from './registry.generated';

export * from './types';

/** All tools (including hidden), sorted by name. */
export const ALL_TOOLS: ToolMetaStatic[] = [...TOOL_META].sort((a, b) =>
  a.name.localeCompare(b.name)
);

/** Visible tools only (excludes hidden/deferred). */
export const TOOLS: ToolMetaStatic[] = ALL_TOOLS.filter((t) => !t.hidden);

const BY_SLUG = new Map(ALL_TOOLS.map((t) => [t.slug, t]));

export function getToolMeta(slug: string): ToolMetaStatic | undefined {
  return BY_SLUG.get(slug);
}

export function getToolComponent(slug: string) {
  return TOOL_COMPONENTS[slug];
}

/** Slugs for generateStaticParams (every tool gets a prebuilt page). */
export function getAllSlugs(): string[] {
  return ALL_TOOLS.map((t) => t.slug);
}

export function getToolsByCategory(category: ToolCategory): ToolMetaStatic[] {
  return TOOLS.filter((t) => t.category === category);
}

export interface CategoryWithTools {
  meta: (typeof CATEGORY_META)[ToolCategory];
  tools: ToolMetaStatic[];
}

/** Categories in canonical order, each with its visible tools. */
export function getCategoriesWithTools(): CategoryWithTools[] {
  return CATEGORIES.map((id) => ({
    meta: CATEGORY_META[id],
    tools: getToolsByCategory(id),
  })).filter((c) => c.tools.length > 0);
}

export function getRelatedTools(slug: string): ToolMetaStatic[] {
  const tool = getToolMeta(slug);
  if (!tool) return [];
  const related = tool.relatedTools
    .map((s) => getToolMeta(s))
    .filter((t): t is ToolMetaStatic => Boolean(t) && !t!.hidden);
  if (related.length >= 3) return related.slice(0, 4);
  // Backfill from same category.
  const same = getToolsByCategory(tool.category).filter(
    (t) => t.slug !== slug && !related.includes(t)
  );
  return [...related, ...same].slice(0, 4);
}

export const TOTAL_TOOL_COUNT = TOOLS.length;
