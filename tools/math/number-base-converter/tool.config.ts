import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-number-base-v1',
  name: 'Number Base Converter',
  slug: 'number-base-converter',
  description: 'Convert numbers between binary, octal, decimal, hex and arbitrary bases.',
  category: 'math',
  tags: ['base', 'binary', 'hex', 'octal', 'decimal', 'radix'],
  keywords: ['number base', 'binary', 'hexadecimal', 'octal', 'radix', 'convert', 'bin dec hex'],
  icon: 'Binary',
  relatedTools: ['hex-text', 'bitwise-calculator', 'ascii-table'],
};

export default meta;
