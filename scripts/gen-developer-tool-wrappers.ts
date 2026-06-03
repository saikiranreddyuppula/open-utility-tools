#!/usr/bin/env bun
import { mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { DEVELOPER_TOOL_DEFINITIONS } from '../lib/developer-tools/core';

const ROOT = join(import.meta.dir, '..');
const TOOLS_DIR = join(ROOT, 'tools');

async function main() {
  for (const definition of DEVELOPER_TOOL_DEFINITIONS) {
    const dir = join(TOOLS_DIR, definition.category, definition.slug);
    await mkdir(dir, { recursive: true });

    const configPath = join(dir, 'tool.config.ts');
    const uiPath = join(dir, 'ui.tsx');

    await Bun.write(configPath, configSource(definition));
    await Bun.write(uiPath, uiSource(definition.slug));
  }

  console.log(
    `gen-developer-tool-wrappers: wrote ${DEVELOPER_TOOL_DEFINITIONS.length} tool wrappers under ${relative(ROOT, TOOLS_DIR)}`,
  );
}

function configSource(definition: (typeof DEVELOPER_TOOL_DEFINITIONS)[number]): string {
  return `import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: ${JSON.stringify(`${definition.category}-${definition.slug}-v1`)},
  name: ${JSON.stringify(definition.name)},
  slug: ${JSON.stringify(definition.slug)},
  description: ${JSON.stringify(definition.description)},
  category: ${JSON.stringify(definition.category)},
  tags: ${JSON.stringify(definition.tags)},
  keywords: ${JSON.stringify(definition.keywords)},
  icon: ${JSON.stringify(definition.icon)},
  relatedTools: ${JSON.stringify(definition.relatedTools)},
};

export default meta;
`;
}

function uiSource(slug: string): string {
  return `'use client';

import { DeveloperToolPage } from '@/tools/_shared/developer-workbench';

export default function GeneratedDeveloperTool() {
  return <DeveloperToolPage slug=${JSON.stringify(slug)} />;
}
`;
}

main().catch((error) => {
  console.error('gen-developer-tool-wrappers failed:', error);
  process.exit(1);
});
