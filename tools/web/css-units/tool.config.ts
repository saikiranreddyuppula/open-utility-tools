import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-css-units-v1',
  name: 'PX ↔ REM Converter',
  slug: 'px-rem-converter',
  description: 'Convert between px, rem and em given a configurable root font size.',
  category: 'web',
  tags: ['css', 'px', 'rem', 'em', 'units'],
  keywords: ['px to rem', 'rem to px', 'em', 'css units', 'font size'],
  icon: 'Ruler',
  relatedTools: ['css-minify', 'color-converter', 'unit-converter'],
};

export default meta;
