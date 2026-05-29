import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-metadata-v1',
  name: 'PDF Info & Metadata',
  slug: 'pdf-metadata',
  description: 'Inspect a PDF’s page count, version, and document metadata.',
  category: 'pdf',
  tags: ['pdf', 'metadata', 'info', 'inspect', 'properties'],
  keywords: ['pdf metadata', 'pdf info', 'page count', 'document properties', 'inspect pdf'],
  icon: 'FileSearch',
  relatedTools: ['merge-pdf', 'split-pdf', 'rotate-pdf'],
  loadWasm: true,
};

export default meta;
