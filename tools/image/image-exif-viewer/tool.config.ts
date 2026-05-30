import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-exif-viewer-v1',
  name: 'EXIF Metadata Viewer',
  slug: 'image-exif-viewer',
  description:
    'View EXIF/JFIF metadata embedded in a JPEG (camera, exposure, GPS) without uploading.',
  category: 'image',
  tags: ['exif', 'metadata', 'jpeg', 'camera', 'gps'],
  keywords: [
    'exif viewer',
    'image metadata',
    'jpeg exif',
    'camera info',
    'gps coordinates',
    'exposure',
  ],
  icon: 'FileSearch',
  relatedTools: [],
};

export default meta;
