import { describe, expect, it } from 'vitest';

import { TOOL_META } from '../../../lib/registry/registry.generated';
import { TOOL_CATALOG, getToolByPath, getToolBySlug } from '../src/tools';

describe('tools catalog package coverage', () => {
  it('contains every browser tool from the site registry', () => {
    expect(TOOL_CATALOG).toHaveLength(TOOL_META.length);

    for (const siteTool of TOOL_META) {
      const packaged = getToolByPath(siteTool.category, siteTool.slug);
      expect(packaged, `${siteTool.category}/${siteTool.slug}`).toBeDefined();
      expect(packaged).toMatchObject({
        id: siteTool.id,
        name: siteTool.name,
        slug: siteTool.slug,
        description: siteTool.description,
        category: siteTool.category,
        tags: siteTool.tags,
        keywords: siteTool.keywords,
        icon: siteTool.icon,
        relatedTools: siteTool.relatedTools,
        packageImportPath: `@open-utility-tools/core/tools/${siteTool.category}/${siteTool.slug}`,
        webPath: `/tools/${siteTool.slug}/`,
      });
    }
  });

  it('indexes tools by slug and exposes direct core APIs when present', () => {
    expect(getToolBySlug('json-formatter')?.packageImportPath).toBe(
      '@open-utility-tools/core/tools/data/json-formatter',
    );
    expect(getToolBySlug('add-business-days')?.coreImportPath).toBe(
      '@open-utility-tools/core/time/add-business-days',
    );
    expect(getToolBySlug('image-converter')?.coreImportPath).toBe(
      '@open-utility-tools/core/image/convert',
    );
  });
});
