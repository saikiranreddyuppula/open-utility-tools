import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-zod-v1',
  name: 'JSON to Zod Schema',
  slug: 'json-to-zod',
  description: 'Generate a Zod validation schema from a JSON sample.',
  category: 'data',
  tags: ['json', 'zod', 'typescript', 'validation', 'codegen'],
  keywords: [
    'json to zod',
    'zod schema',
    'validation',
    'z.object',
    'typescript',
    'codegen',
  ],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
