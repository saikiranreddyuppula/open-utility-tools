import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-contrast-checker-v1',
  name: 'Contrast Checker',
  slug: 'contrast-checker',
  description: 'Check WCAG contrast ratio between two colors and AA/AAA pass/fail.',
  category: 'color',
  tags: ['contrast', 'wcag', 'accessibility', 'a11y', 'ratio'],
  keywords: ['contrast', 'wcag', 'accessibility', 'a11y', 'aa', 'aaa', 'ratio'],
  icon: 'Contrast',
  relatedTools: ['color-converter', 'color-picker', 'gradient-generator'],
};

export default meta;
