import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-bytes-to-human-converter-v1',
  name: 'Bytes to Human-Readable Converter',
  slug: 'bytes-to-human-converter',
  description: 'Format raw byte counts into human-readable sizes, both decimal and binary.',
  category: 'convert',
  tags: ['bytes', 'filesize', 'humanize', 'parse', 'format'],
  keywords: ['file size', 'KB', 'MB', 'GB', 'KiB', 'MiB', 'GiB', 'humanize bytes', 'parse size'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
