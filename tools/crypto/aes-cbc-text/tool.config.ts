import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-aes-cbc-text-v1',
  name: 'AES-CBC Text Encrypt/Decrypt',
  slug: 'aes-cbc-text',
  description: 'Encrypt or decrypt text with AES-CBC using a passphrase-derived key and explicit IV.',
  category: 'crypto',
  tags: ['aes', 'cbc', 'encrypt', 'decrypt', 'pbkdf2'],
  keywords: ['aes-cbc', 'pbkdf2', 'symmetric encryption', 'iv', 'pkcs7', 'passphrase'],
  icon: 'Lock',
  relatedTools: [],
};

export default meta;
