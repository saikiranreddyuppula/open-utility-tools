import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-excel-converter-v1',
  name: 'Excel (XLSX) ↔ CSV / JSON Converter',
  slug: 'excel-converter',
  description:
    'Open .xlsx, .xlsm or .ods workbooks and export any sheet to CSV, TSV, JSON or Markdown - or turn CSV and JSON into a real .xlsx with dates, headers and column widths. Runs entirely in your browser.',
  category: 'convert',
  tags: ['excel', 'xlsx', 'csv', 'json', 'spreadsheet', 'ods'],
  keywords: [
    'xlsx to csv',
    'csv to xlsx',
    'excel to json',
    'json to excel',
    'xlsx to json',
    'excel to markdown',
    'spreadsheet converter',
    'ods to csv',
    'xlsm',
    'workbook',
    'sheet',
    'convert excel',
  ],
  icon: 'FileSpreadsheet',
  relatedTools: ['csv-to-tsv', 'convert-csv-to-json-objects', 'csv-to-markdown', 'tsv-to-json'],
};

export default meta;
