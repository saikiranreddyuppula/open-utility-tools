import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-collatz-calculator-v1',
  name: 'Collatz Conjecture Stepper',
  slug: 'collatz-calculator',
  description: 'Generate the full Collatz (3n+1) sequence for any start value and report its statistics.',
  category: 'math',
  tags: ['collatz', 'sequence', 'number-theory', 'iteration', '3n+1'],
  keywords: ['collatz', 'hailstone', '3n+1', 'conjecture', 'stopping time', 'trajectory', 'syracuse'],
  icon: 'Spline',
  relatedTools: [],
};

export default meta;
