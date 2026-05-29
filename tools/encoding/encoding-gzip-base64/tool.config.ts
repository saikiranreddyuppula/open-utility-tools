import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-gzip-base64-v1',
  name: 'Gzip Base64 Compress / Decompress',
  slug: 'encoding-gzip-base64',
  description:
    'Compress text with gzip and output Base64, or decode Base64 gzip back to the original text.',
  category: 'encoding',
  tags: ['gzip', 'compress', 'base64'],
  keywords: ['gzip', 'compress', 'decompress', 'base64', 'deflate', 'shrink'],
  icon: 'FileArchive',
  relatedTools: [],
};

export default meta;
