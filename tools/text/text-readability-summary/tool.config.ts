import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-readability-summary-v1',
  name: 'Combined Readability Report',
  slug: 'text-readability-summary',
  description: 'Run all major readability formulas at once and show a consensus grade level.',
  category: 'text',
  tags: ['readability', 'grade', 'flesch', 'analysis', 'report'],
  keywords: [
    'readability',
    'flesch kincaid',
    'gunning fog',
    'smog',
    'coleman liau',
    'ari',
    'grade level',
    'reading ease',
  ],
  icon: 'ClipboardList',
  relatedTools: [],
};

export default meta;
