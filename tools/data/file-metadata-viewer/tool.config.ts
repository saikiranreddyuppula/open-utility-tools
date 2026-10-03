import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-file-metadata-viewer-v1',
  name: 'File Metadata Viewer',
  slug: 'file-metadata-viewer',
  description:
    'Inspect the hidden metadata of any file — photos, PDFs, Office docs, audio, video, fonts, archives and more — privately in your browser.',
  category: 'data',
  tags: ['metadata', 'exif', 'privacy', 'file', 'inspect', 'hash'],
  keywords: [
    'file metadata',
    'metadata viewer',
    'exif viewer',
    'file properties',
    'file info',
    'inspect file',
    'check metadata',
    'gps location in photo',
    'pdf author',
    'docx author',
    'id3 tags',
    'mp4 metadata',
    'file type detector',
    'magic bytes',
    'file hash',
    'privacy check',
    'document properties',
    'hidden data',
  ],
  icon: 'FileSearch',
  relatedTools: ['image-exif-viewer', 'pdf-metadata', 'image-metadata-remover', 'hex-viewer-file-type-detector'],
  loadWasm: true,
};

export default meta;
