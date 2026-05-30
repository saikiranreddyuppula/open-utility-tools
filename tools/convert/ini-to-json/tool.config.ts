import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-ini-to-json-v1',
  name: 'INI to JSON',
  slug: 'ini-to-json',
  description: 'Parse INI / config files into structured JSON.',
  category: 'convert',
  tags: ['ini', 'json', 'config', 'convert', 'parse'],
  keywords: ['ini2json', 'sections', 'settings', 'conf', 'properties'],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
