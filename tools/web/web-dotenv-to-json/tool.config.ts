import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-dotenv-to-json-v1',
  name: '.env to JSON',
  slug: 'web-dotenv-to-json',
  description:
    'Parse a .env / dotenv file into a JSON object and convert JSON back into .env format, handling quotes, comments, and export prefixes.',
  category: 'web',
  tags: ['env', 'dotenv', 'json', 'config'],
  keywords: ['env', 'dotenv', 'json', 'config', 'parse', 'environment'],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
