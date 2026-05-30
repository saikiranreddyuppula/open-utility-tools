import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-aes-gcm-file-v1',
  name: 'AES-GCM File Encrypt/Decrypt',
  slug: 'aes-gcm-file',
  description: 'Encrypt or decrypt a chosen file in-browser with AES-GCM using a passphrase.',
  category: 'crypto',
  tags: ['aes', 'gcm', 'file', 'encrypt', 'decrypt'],
  keywords: ['aes-gcm', 'file encryption', 'pbkdf2', 'authenticated encryption', 'passphrase', 'in-browser'],
  icon: 'FileLock',
  relatedTools: [],
};

export default meta;
