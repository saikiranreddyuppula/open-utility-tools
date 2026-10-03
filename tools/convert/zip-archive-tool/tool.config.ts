import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-zip-archive-tool-v1',
  name: 'ZIP Archive Tool (Create & Extract)',
  slug: 'zip-archive-tool',
  description:
    'Open ZIP, JAR, APK, DOCX, EPUB, TAR, TAR.GZ and GZ archives to browse, preview and download entries - or build a new ZIP from files and folders, entirely in your browser.',
  category: 'convert',
  tags: ['zip', 'unzip', 'tar', 'gzip', 'archive', 'compress'],
  keywords: [
    'zip',
    'unzip',
    'extract zip',
    'create zip',
    'zip files online',
    'tar.gz',
    'tgz',
    'gz',
    'jar',
    'apk',
    'docx contents',
    'epub',
    'archive viewer',
    'compress folder',
    'crc32',
    'zip bomb',
  ],
  icon: 'FileArchive',
  relatedTools: ['encoding-gzip-base64', 'base64-to-file'],
};

export default meta;
