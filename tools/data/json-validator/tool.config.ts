import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-validator-v1',
  name: 'JSON Validator',
  slug: 'json-validator',
  description: 'Validate JSON and pinpoint the exact line, column, and reason for any syntax error.',
  category: 'data',
  tags: ['json', 'validate', 'lint'],
  keywords: ['json', 'validate', 'lint', 'syntax', 'error'],
  icon: 'CheckCheck',
  relatedTools: [],
};

export default meta;
