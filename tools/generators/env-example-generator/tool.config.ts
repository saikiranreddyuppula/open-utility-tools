import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-env-example-generator-v1',
  name: '.env.example Generator',
  slug: 'env-example-generator',
  description:
    'Turn a list of env var names/values into a redacted .env.example with comments and grouping.',
  category: 'generators',
  tags: ['env', 'dotenv', 'config', 'secrets', 'redact'],
  keywords: [
    'env.example',
    'dotenv',
    '.env',
    'environment variables',
    'redact',
    'placeholder',
    'secrets',
    'template',
  ],
  icon: 'FileKey',
  relatedTools: [],
};

export default meta;
