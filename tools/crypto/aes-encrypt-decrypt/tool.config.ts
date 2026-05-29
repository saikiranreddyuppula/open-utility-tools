import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-aes-encrypt-decrypt-v1',
  name: 'AES Encrypt / Decrypt',
  slug: 'aes-encrypt-decrypt',
  description:
    'Encrypt and decrypt text with AES-GCM using a passphrase, producing self-contained Base64 output with embedded salt and IV.',
  category: 'crypto',
  tags: ['aes', 'encrypt', 'decrypt'],
  keywords: ['aes', 'encrypt', 'decrypt', 'aes-gcm', 'cipher', 'passphrase'],
  icon: 'Lock',
  relatedTools: [],
};

export default meta;
