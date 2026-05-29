import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-blindness-v1',
  name: 'Color Blindness Simulator',
  slug: 'color-blindness',
  description: 'Preview how a color appears under common color-vision deficiencies.',
  category: 'color',
  tags: ['color blindness', 'accessibility', 'a11y', 'simulate', 'cvd'],
  keywords: ['color blindness', 'deuteranopia', 'protanopia', 'tritanopia', 'accessibility', 'cvd'],
  icon: 'Eye',
  relatedTools: ['contrast-checker', 'color-converter', 'color-shades'],
};

export default meta;
