#!/usr/bin/env bun
/**
 * Emits LLM/agent documentation (llmstxt.org) into public/.
 * No UI — files are fetched by agents at well-known URLs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { TOOL_META } from '../lib/registry/registry.generated';
import { CATEGORIES, CATEGORY_META, type ToolCategory, type ToolMetaStatic } from '../lib/registry/types';
import { GITHUB_URL, SITE_NAME, SITE_URL } from '../lib/seo/site';

const ROOT = join(import.meta.dir, '..');
const PUBLIC = join(ROOT, 'public');
const LLMS_DIR = join(PUBLIC, 'llms');
const PACKAGE_NAME = '@open-utility-tools/core';
const NPM_URL = `https://www.npmjs.com/package/${PACKAGE_NAME}`;

function visibleTools(): ToolMetaStatic[] {
  return TOOL_META.filter((tool) => !tool.hidden).sort((a, b) => a.name.localeCompare(b.name));
}

function toolsByCategory(tools: ToolMetaStatic[]): Map<ToolCategory, ToolMetaStatic[]> {
  const grouped = new Map<ToolCategory, ToolMetaStatic[]>();
  for (const id of CATEGORIES) grouped.set(id, []);
  for (const tool of tools) grouped.get(tool.category)?.push(tool);
  return grouped;
}

function toolUrl(slug: string): string {
  return `${SITE_URL}/tools/${slug}/`;
}

function listItem(tool: ToolMetaStatic): string {
  return `- [${tool.name}](${toolUrl(tool.slug)}): ${tool.description}`;
}

function buildLlmsTxt(tools: ToolMetaStatic[], grouped: Map<ToolCategory, ToolMetaStatic[]>): string {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    '',
    `> ${tools.length} free, privacy-first developer utilities that run 100% in the browser. No uploads, no accounts, no tracking. Open source (MIT). npm: ${PACKAGE_NAME}.`,
    '',
    'There is no processing API and no backend that accepts user files or text. Agents should send humans to a tool URL, or call the same logic from the npm package in their own runtime.',
    '',
    `- Tool URLs: ${SITE_URL}/tools/{slug}/`,
    `- Category hubs: ${SITE_URL}/categories/{id}/`,
    `- Personal pages (/favorites/, /recent/, /offline/) are client-only and empty to crawlers.`,
    '',
    '## Docs',
    '',
    `- [Full catalog](${SITE_URL}/llms-full.txt): every tool name, slug, and description, grouped by category`,
    `- [JSON catalog](${SITE_URL}/catalog.json): machine-readable list of all tools`,
    `- [Developer docs](${SITE_URL}/developers/): install and import ${PACKAGE_NAME}`,
    `- [npm package](${NPM_URL}): typed ESM utilities extracted from this site`,
    `- [Source](${GITHUB_URL}): MIT-licensed Next.js static export`,
    '',
    '## Categories',
    '',
  ];

  for (const id of CATEGORIES) {
    const list = grouped.get(id) ?? [];
    const meta = CATEGORY_META[id];
    lines.push(
      `- [${meta.name}](${SITE_URL}/llms/${id}.md): ${list.length} tools — ${meta.description}`,
    );
  }

  lines.push(
    '',
    '## Optional',
    '',
    `- [Home](${SITE_URL}/)`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
    `- [robots.txt](${SITE_URL}/robots.txt)`,
    '',
  );

  return lines.join('\n');
}

function buildLlmsFull(tools: ToolMetaStatic[], grouped: Map<ToolCategory, ToolMetaStatic[]>): string {
  const lines: string[] = [
    `# ${SITE_NAME} — full catalog`,
    '',
    `> ${tools.length} browser tools. Each URL runs locally; nothing is uploaded.`,
    '',
    `Index: ${SITE_URL}/llms.txt`,
    '',
  ];

  for (const id of CATEGORIES) {
    const list = grouped.get(id) ?? [];
    const meta = CATEGORY_META[id];
    lines.push(`## ${meta.name}`, '');
    lines.push(`${meta.description} (${list.length}). Markdown index: ${SITE_URL}/llms/${id}.md`, '');
    for (const tool of list) lines.push(listItem(tool));
    lines.push('');
  }

  return lines.join('\n');
}

function buildCategoryMarkdown(id: ToolCategory, tools: ToolMetaStatic[]): string {
  const meta = CATEGORY_META[id];
  const lines: string[] = [
    `# ${meta.name}`,
    '',
    `> ${meta.description}`,
    '',
    `${tools.length} tools. Each runs entirely in the browser.`,
    '',
    `Hub: ${SITE_URL}/categories/${id}/`,
    '',
    '## Tools',
    '',
  ];
  for (const tool of tools) lines.push(listItem(tool));
  lines.push('');
  return lines.join('\n');
}

function buildCatalogJson(tools: ToolMetaStatic[]) {
  return {
    name: SITE_NAME,
    url: SITE_URL,
    llmsTxt: `${SITE_URL}/llms.txt`,
    llmsFull: `${SITE_URL}/llms-full.txt`,
    package: PACKAGE_NAME,
    privacy: 'client-side-only',
    license: 'MIT',
    toolCount: tools.length,
    categories: CATEGORIES.map((id) => ({
      id,
      name: CATEGORY_META[id].name,
      description: CATEGORY_META[id].description,
      url: `${SITE_URL}/categories/${id}/`,
      markdown: `${SITE_URL}/llms/${id}.md`,
      toolCount: tools.filter((tool) => tool.category === id).length,
    })),
    tools: tools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      description: tool.description,
      category: tool.category,
      url: toolUrl(tool.slug),
      tags: tool.tags,
      keywords: tool.keywords,
      packageImportPath: `${PACKAGE_NAME}/tools/${tool.category}/${tool.slug}`,
    })),
  };
}

async function main() {
  const tools = visibleTools();
  const grouped = toolsByCategory(tools);

  await mkdir(LLMS_DIR, { recursive: true });
  await writeFile(join(PUBLIC, 'llms.txt'), buildLlmsTxt(tools, grouped));
  await writeFile(join(PUBLIC, 'llms-full.txt'), buildLlmsFull(tools, grouped));
  await writeFile(join(PUBLIC, 'catalog.json'), JSON.stringify(buildCatalogJson(tools)));

  for (const id of CATEGORIES) {
    await writeFile(join(LLMS_DIR, `${id}.md`), buildCategoryMarkdown(id, grouped.get(id) ?? []));
  }

  console.log(`✓ gen-llms: ${tools.length} tool(s) → public/llms.txt, public/llms-full.txt, public/catalog.json, public/llms/*.md`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('✗ gen-llms failed:', message);
  process.exit(1);
});
