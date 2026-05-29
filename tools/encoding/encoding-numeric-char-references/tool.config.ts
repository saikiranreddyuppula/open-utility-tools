import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-numeric-char-references-v1',
  name: 'Numeric HTML Character References',
  slug: 'encoding-numeric-char-references',
  description:
    'Convert text into numeric HTML character references (decimal or hex) and decode them back to plain text.',
  category: 'encoding',
  tags: ['html', 'numeric', 'character reference'],
  keywords: ['html', 'numeric', 'character reference', 'ncr', 'decimal', 'hex'],
  icon: 'Code',
  relatedTools: [],
};

export default meta;
