import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-html-table-to-json-v1',
  name: 'HTML Table to JSON',
  slug: 'html-table-to-json',
  description:
    'Convert an HTML <table> into a JSON array of objects keyed by the header row.',
  category: 'data',
  tags: ['html', 'table', 'json', 'convert', 'scrape'],
  keywords: [
    'html table to json',
    'table to objects',
    'scrape table json',
    'colspan rowspan',
    'parse table',
    'web table',
  ],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
