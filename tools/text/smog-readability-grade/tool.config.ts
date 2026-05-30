import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-smog-readability-grade-v1',
  name: 'SMOG Readability Grade',
  slug: 'smog-readability-grade',
  description: 'Calculate the SMOG grade, the standard readability measure for healthcare and consumer text.',
  category: 'text',
  tags: ['readability', 'smog', 'grade', 'text', 'analysis'],
  keywords: ['smog', 'readability', 'grade level', 'polysyllable', 'reading age', 'healthcare text'],
  icon: 'Microscope',
  relatedTools: [],
};

export default meta;
