import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-wcag-contrast-pair-finder-v1',
  name: 'WCAG Contrast Pair Finder',
  slug: 'wcag-contrast-pair-finder',
  description: 'Adjust a foreground color until it meets a target WCAG contrast on a fixed background.',
  category: 'color',
  tags: ['wcag', 'contrast', 'accessibility', 'a11y', 'color'],
  keywords: ['contrast ratio', 'aa', 'aaa', 'accessible', 'readability', 'lightness', 'fix contrast'],
  icon: 'Contrast',
  relatedTools: [],
};

export default meta;
