import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-color-contrast-suggester-v1',
  name: 'Accessible Contrast Fixer',
  slug: 'color-contrast-suggester',
  description: "Adjust a foreground color's lightness until it meets a WCAG contrast target.",
  category: 'color',
  tags: ['contrast', 'wcag', 'accessibility', 'a11y', 'color'],
  keywords: ['contrast ratio', 'aa', 'aaa', 'wcag', 'accessible color', 'fix contrast', 'lightness'],
  icon: 'Contrast',
  relatedTools: [],
};

export default meta;
