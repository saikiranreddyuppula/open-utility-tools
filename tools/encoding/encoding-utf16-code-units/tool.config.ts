import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-utf16-code-units-v1',
  name: 'UTF-8 / UTF-16 Code Unit Converter',
  slug: 'encoding-utf16-code-units',
  description:
    'Show the UTF-16 code units (and surrogate pairs) for text and convert hex code-unit lists back into characters.',
  category: 'encoding',
  tags: ['utf-16', 'code unit', 'surrogate'],
  keywords: ['utf-16', 'code unit', 'surrogate', 'encode', 'decode', 'unicode'],
  icon: 'ScanLine',
  relatedTools: [],
};

export default meta;
