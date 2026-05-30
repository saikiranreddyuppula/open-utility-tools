import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-bit-rotate-shift-v1',
  name: 'Bit Rotate & Shift Visualizer',
  slug: 'bit-rotate-shift',
  description:
    'Apply logical/arithmetic shifts and circular rotations to a fixed-width integer and watch each bit move.',
  category: 'math',
  tags: ['bitwise', 'shift', 'rotate', 'binary', 'visualizer'],
  keywords: [
    'bit shift',
    'logical shift',
    'arithmetic shift',
    'rotate left',
    'rotate right',
    'bitwise',
    'rol ror shl shr',
  ],
  icon: 'RotateCw',
  relatedTools: [],
};

export default meta;
