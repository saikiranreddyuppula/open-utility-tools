import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-data-uri-builder-v1',
  name: 'Base64 Image / Data URI Builder',
  slug: 'encoding-data-uri-builder',
  description:
    'Wrap Base64 content into a data: URI with a chosen MIME type, or extract the MIME and decoded payload from an existing data URI.',
  category: 'encoding',
  tags: ['data uri', 'base64', 'mime'],
  keywords: ['data uri', 'data url', 'base64', 'mime', 'inline'],
  icon: 'FileOutput',
  relatedTools: [],
};

export default meta;
