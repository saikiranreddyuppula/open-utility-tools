import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-asn1-der-decoder-v1',
  name: 'ASN.1 Decoder & Certificate Parser',
  slug: 'asn1-der-decoder',
  description:
    'Decode any ASN.1 DER/BER data (PEM, Base64, hex or file) into an interactive tree with a synced hex dump, plus smart summaries for X.509 certificates, CSRs, keys and PKCS#7 bundles.',
  category: 'crypto',
  tags: ['asn1', 'der', 'x509', 'certificate', 'pem', 'csr'],
  keywords: [
    'asn.1 decoder', 'der parser', 'ber', 'openssl asn1parse', 'certificate parser', 'x509 decoder',
    'csr decoder', 'pkcs7', 'p7b', 'pkcs8', 'public key', 'oid lookup', 'fingerprint', 'spki pin',
    'subject alternative name', 'asn1js', 'hex dump', 'pem to text', 'cer crt',
  ],
  icon: 'ListTree',
  relatedTools: ['certificate-decoder-x509', 'jwk-pem-viewer', 'certificate-chain-builder', 'protobuf-binary-decoder'],
};

export default meta;
