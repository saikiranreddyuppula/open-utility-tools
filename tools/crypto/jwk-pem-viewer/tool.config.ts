import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-jwk-pem-viewer-v1',
  name: 'JWK / PEM Key Viewer',
  slug: 'jwk-pem-viewer',
  description:
    'Inspect and convert between JWK and PEM key representations and display their parameters.',
  category: 'crypto',
  tags: ['jwk', 'pem', 'key', 'rsa', 'ec'],
  keywords: ['spki', 'pkcs8', 'public key', 'fingerprint', 'webcrypto', 'convert', 'inspect'],
  icon: 'FileSearch',
  relatedTools: [],
};

export default meta;
