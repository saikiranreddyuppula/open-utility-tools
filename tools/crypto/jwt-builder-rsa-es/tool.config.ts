import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-jwt-builder-rsa-es-v1',
  name: 'JWT Builder (RS/ES)',
  slug: 'jwt-builder-rsa-es',
  description:
    'Build and sign JSON Web Tokens with RSA or ECDSA keys (RS256/384/512, ES256/384/512, PS256).',
  category: 'crypto',
  tags: ['jwt', 'rsa', 'ecdsa', 'sign', 'token'],
  keywords: ['jws', 'rs256', 'es256', 'ps256', 'pkcs8', 'asymmetric', 'json web token'],
  icon: 'FileKey',
  relatedTools: [],
};

export default meta;
