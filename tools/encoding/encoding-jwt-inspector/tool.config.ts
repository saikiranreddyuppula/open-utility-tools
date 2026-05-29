import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-jwt-inspector-v1',
  name: 'JWT Decoder & Inspector',
  slug: 'encoding-jwt-inspector',
  description:
    'Decode a JSON Web Token into its readable header and payload claims, with human-friendly timestamps for exp/iat/nbf.',
  category: 'encoding',
  tags: ['jwt', 'token', 'decode'],
  keywords: ['jwt', 'token', 'decode', 'claims', 'payload', 'inspect'],
  icon: 'KeyRound',
  relatedTools: [],
};

export default meta;
