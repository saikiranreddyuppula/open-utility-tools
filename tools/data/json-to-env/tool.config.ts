import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-env-v1',
  name: 'JSON to .env',
  slug: 'json-to-env',
  description: 'Flatten a JSON object into dotenv KEY=VALUE lines.',
  category: 'data',
  tags: ['json', 'env', 'dotenv', 'config', 'flatten'],
  keywords: ['json to env', 'dotenv', 'environment variables', 'flatten json', 'config', 'KEY=VALUE'],
  icon: 'FileKey',
  relatedTools: [],
};

export default meta;
