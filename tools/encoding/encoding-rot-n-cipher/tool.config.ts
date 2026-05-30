import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-rot-n-cipher-v1',
  name: 'ROT-N Cipher (Custom Rotation)',
  slug: 'encoding-rot-n-cipher',
  description: 'Apply a Caesar-style rotation with any shift 0-25, with brute-force preview of all shifts.',
  category: 'encoding',
  tags: ['cipher', 'rot', 'caesar', 'rotation', 'brute-force'],
  keywords: ['rot13', 'rot-n', 'caesar', 'shift', 'rotate', 'brute force', 'rot18', 'rot5'],
  icon: 'RotateCw',
  relatedTools: [],
};

export default meta;
