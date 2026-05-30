import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-fixed-point-converter-v1',
  name: 'Fixed-Point (Qm.n) Converter',
  slug: 'fixed-point-converter',
  description: 'Convert real numbers to and from signed/unsigned Qm.n fixed-point integer representations.',
  category: 'math',
  tags: ['fixed-point', 'q-format', 'dsp', 'binary', 'embedded'],
  keywords: ['Qm.n', 'fixed point', 'quantization', 'twos complement', 'fractional bits', 'Q15'],
  icon: 'Ruler',
  relatedTools: [],
};

export default meta;
