import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-affine-cipher-v1',
  name: 'Affine Cipher',
  slug: 'encoding-affine-cipher',
  description:
    'Encrypt/decrypt with the affine cipher E(x)=(a·x+b) mod 26, including key validity checks.',
  category: 'encoding',
  tags: ['affine', 'cipher', 'classical', 'encrypt', 'decrypt'],
  keywords: [
    'affine',
    'cipher',
    'modular',
    'inverse',
    'coprime',
    'monoalphabetic',
    'substitution',
  ],
  icon: 'SquareFunction',
  relatedTools: [],
};

export default meta;
