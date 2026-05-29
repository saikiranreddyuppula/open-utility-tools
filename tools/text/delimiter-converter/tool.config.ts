import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-delimiter-converter-v1',
  name: 'Delimited Text Converter',
  slug: 'delimiter-converter',
  description:
    'Convert delimited text between comma, tab, pipe, semicolon, newline, and custom delimiters, ideal for reshaping CSV-style lists.',
  category: 'text',
  tags: ['delimiter', 'csv', 'convert'],
  keywords: ['delimiter', 'csv', 'tab separated', 'comma', 'convert'],
  icon: 'Table',
  relatedTools: [],
};

export default meta;
