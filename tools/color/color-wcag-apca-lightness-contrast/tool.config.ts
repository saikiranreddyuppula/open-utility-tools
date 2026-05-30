import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-color-wcag-apca-lightness-contrast-v1',
  name: 'Perceived Lightness & Contrast Pair',
  slug: 'color-wcag-apca-lightness-contrast',
  description: 'Computes relative luminance, perceived lightness (L*), and WCAG contrast for two colors.',
  category: 'color',
  tags: ['contrast', 'wcag', 'luminance', 'lightness', 'accessibility'],
  keywords: ['wcag contrast', 'relative luminance', 'cie l*', 'aa aaa', 'a11y color check'],
  icon: 'Contrast',
  relatedTools: [],
};

export default meta;
