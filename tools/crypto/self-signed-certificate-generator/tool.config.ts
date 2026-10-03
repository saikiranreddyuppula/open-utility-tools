import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-self-signed-certificate-generator-v1',
  name: 'Self-Signed Certificate & CSR Generator',
  slug: 'self-signed-certificate-generator',
  description:
    'Generate a self-signed X.509 certificate, a PKCS#10 CSR, or a local CA with a signed leaf certificate (mkcert-style) with SANs, key usage and ECDSA, RSA or Ed25519 keys - entirely in your browser.',
  category: 'crypto',
  tags: ['certificate', 'x509', 'csr', 'self-signed', 'tls', 'ca'],
  keywords: [
    'self signed certificate', 'openssl req', 'generate csr', 'mkcert', 'local ca', 'localhost certificate', 'dev certificate',
    'san certificate', 'wildcard certificate', 'ip address certificate', 'ecdsa certificate', 'rsa certificate', 'ed25519 certificate',
    'pem', 'pkcs8', 'fullchain.pem', 'root ca', 'code signing certificate', 'client certificate', 'webcrypto',
  ],
  icon: 'Stamp',
  relatedTools: ['certificate-decoder-x509', 'csr-generator-validator', 'certificate-chain-builder', 'rsa-keypair-generator'],
};

export default meta;
