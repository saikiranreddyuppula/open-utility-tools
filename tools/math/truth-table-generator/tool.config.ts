import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-truth-table-generator-v1',
  name: 'Truth Table & Boolean Simplifier',
  slug: 'truth-table-generator',
  description:
    'Generate truth tables from Boolean expressions in many notations, then find minterms, canonical and minimal SOP/POS forms, a Karnaugh map and check expression equivalence.',
  category: 'math',
  tags: ['boolean', 'logic', 'truth table', 'karnaugh', 'digital'],
  keywords: [
    'truth table',
    'boolean algebra',
    'boolean simplifier',
    'karnaugh map',
    'k-map',
    'quine-mccluskey',
    'petrick',
    'minterm',
    'maxterm',
    'sop',
    'pos',
    'tautology',
    'contradiction',
    'logic gates',
    'equivalence checker',
    'de morgan',
    'xor nand nor',
    'implication',
  ],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
