import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-unicode-confusables-detector-v1',
  name: 'Unicode Confusables / Homoglyph Detector',
  slug: 'encoding-unicode-confusables-detector',
  description: 'Detect and normalize visually deceptive lookalike characters in text.',
  category: 'encoding',
  tags: ['unicode', 'homoglyph', 'confusables', 'security', 'spoofing'],
  keywords: [
    'homoglyph',
    'confusable',
    'lookalike',
    'cyrillic',
    'spoof',
    'phishing',
    'idn',
    'skeleton',
  ],
  icon: 'Eye',
  relatedTools: [],
};

export default meta;
