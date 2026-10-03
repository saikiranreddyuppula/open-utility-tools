import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-function-grapher-v1',
  name: 'Function Grapher',
  slug: 'function-grapher',
  description:
    'Plot up to 8 functions (y = f(x), polar, parametric, vertical lines) with sliders, roots, extrema, intersections, integrals and shareable links.',
  category: 'math',
  tags: ['graph', 'plot', 'calculus', 'functions', 'math'],
  keywords: [
    'graphing calculator',
    'function plotter',
    'plot function',
    'desmos alternative',
    'polar graph',
    'parametric plot',
    'find roots',
    'local maximum minimum',
    'definite integral',
    'intersection of functions',
    'sliders',
    'table of values',
    'curve sketching',
  ],
  icon: 'LineChart',
  relatedTools: ['expression-calculator', 'polynomial-evaluator', 'quadratic-equation-solver', 'polar-cartesian-converter'],
};

export default meta;
