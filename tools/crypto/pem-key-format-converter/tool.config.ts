import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-pem-key-format-converter-v1',
  name: 'PEM Key Converter & Key Matcher',
  slug: 'pem-key-format-converter',
  description:
    'Convert RSA, EC and Ed25519 keys between PKCS#1, PKCS#8, SEC1, SPKI, OpenSSH, DER, Base64 and JWK, decrypt password-protected keys, repair mangled PEM and check that a certificate, key and CSR match.',
  category: 'crypto',
  tags: ['pem', 'pkcs8', 'pkcs1', 'openssh', 'key', 'converter'],
  keywords: [
    'pem converter', 'pkcs1 to pkcs8', 'pkcs8 to pkcs1', 'sec1', 'ec private key', 'rsa private key', 'spki', 'public key from private key',
    'openssh public key', 'ssh-rsa to pem', 'ssh-keygen -i', 'jwk', 'jwk to pem', 'der', 'decrypt private key', 'remove passphrase', 'fix pem',
    'rewrap pem', 'key matcher', 'certificate key match', 'modulus md5', 'openssl pkey', 'ed25519',
  ],
  icon: 'FileKey',
  relatedTools: ['jwk-pem-viewer', 'certificate-decoder-x509', 'crypto-key-fingerprint', 'rsa-keypair-generator'],
};

export default meta;
