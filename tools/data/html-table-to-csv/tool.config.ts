import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-html-table-to-csv-v1',
  name: 'HTML Table to CSV',
  slug: 'html-table-to-csv',
  description: 'Extract one or all <table> elements from pasted HTML into CSV.',
  category: 'data',
  tags: ['html', 'table', 'csv', 'scrape', 'convert'],
  keywords: [
    'html table to csv',
    'extract table',
    'scrape table',
    'colspan rowspan',
    'web table export',
    'parse table',
  ],
  icon: 'Table',
  relatedTools: [],
};

export default meta;
