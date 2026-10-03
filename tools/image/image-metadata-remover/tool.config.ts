import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-metadata-remover-v1',
  name: 'Image Metadata Remover',
  slug: 'image-metadata-remover',
  description:
    'Strip EXIF, GPS, XMP, IPTC and text metadata from JPEG, PNG and WebP photos without re-encoding — see exactly what was hidden in the file, then download clean copies.',
  category: 'image',
  tags: ['exif', 'gps', 'privacy', 'metadata', 'strip', 'batch'],
  keywords: [
    'remove exif',
    'strip metadata',
    'remove gps location from photo',
    'exif remover',
    'scrub photo metadata',
    'xmp iptc remover',
    'lossless metadata removal',
    'privacy',
  ],
  icon: 'ShieldCheck',
  relatedTools: ['image-exif-viewer', 'image-compress-quality', 'image-converter'],
};

export default meta;
