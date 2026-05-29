import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-tsv-to-json-v1',
  name: 'TSV to JSON',
  slug: 'tsv-to-json',
  category: 'convert',
  description:
    'Paste tab-separated data copied from a spreadsheet and convert it to JSON, with header-row detection and numeric or boolean coercion options.',
  tags: ['tsv', 'json', 'spreadsheet', 'convert'],
  keywords: ['tsv', 'json', 'spreadsheet', 'tab', 'convert', 'excel'],
  icon: 'FileSpreadsheet',
  relatedTools: [],
};

export default meta;
