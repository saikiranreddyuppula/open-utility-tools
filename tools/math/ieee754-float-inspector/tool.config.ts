import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-ieee754-float-inspector-v1',
  name: 'IEEE-754 Float Inspector',
  slug: 'ieee754-float-inspector',
  description:
    'Decompose a decimal number into IEEE-754 single and double precision sign, exponent, and mantissa bits.',
  category: 'math',
  tags: ['ieee-754', 'float', 'binary', 'mantissa', 'exponent'],
  keywords: ['floating point', 'binary32', 'binary64', 'sign exponent mantissa', 'hex float', 'ULP', 'subnormal'],
  icon: 'Microscope',
  relatedTools: [],
};

export default meta;
