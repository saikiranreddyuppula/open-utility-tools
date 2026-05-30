import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-yaml-frontmatter-extractor-v1',
  name: 'Markdown Front Matter Extractor',
  slug: 'data-yaml-frontmatter-extractor',
  description:
    'Splits Markdown into its YAML/TOML front matter and body, and parses the front matter to JSON.',
  category: 'data',
  tags: ['markdown', 'frontmatter', 'yaml', 'toml', 'parse'],
  keywords: [
    'front matter',
    'yaml frontmatter',
    'toml frontmatter',
    'jekyll',
    'hugo',
    'markdown metadata',
  ],
  icon: 'FileText',
  relatedTools: [],
};

export default meta;
