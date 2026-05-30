import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-jsonl-validate-lint-v1',
  name: 'JSON Lines Validator',
  slug: 'data-jsonl-validate-lint',
  description:
    'Validates each line of an NDJSON/JSONL file as standalone JSON and reports line-level errors.',
  category: 'data',
  tags: ['jsonl', 'ndjson', 'validate', 'lint', 'json'],
  keywords: [
    'json lines',
    'newline delimited json',
    'ndjson validator',
    'jsonl lint',
    'per line json',
    'streaming json',
  ],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
