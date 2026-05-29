import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-roman-numerals-v1',
  name: 'Roman Numeral Converter',
  slug: 'roman-numerals',
  description: 'Convert between Roman numerals and integers (1–3999).',
  category: 'math',
  tags: ['roman', 'numerals', 'convert', 'number'],
  keywords: ['roman numerals', 'convert', 'integer', 'mcmxciv'],
  icon: 'Sigma',
  relatedTools: ['number-base-converter', 'percentage-calculator', 'timestamp-converter'],
};

export default meta;
