import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-pin-v1',
  name: 'PIN Code Generator',
  slug: 'generate-pin',
  description:
    'Generate random numeric PIN codes of a chosen length (e.g. 4/6/8 digits) in bulk, with an option to avoid trivial sequences and repeats.',
  category: 'generators',
  tags: ['pin', 'code', 'numeric'],
  keywords: ['pin', 'code', 'numeric', 'otp', 'random', 'digits'],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
