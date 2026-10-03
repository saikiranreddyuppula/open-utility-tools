import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-pdf-protect-unlock-v1',
  name: 'Protect & Unlock PDF',
  slug: 'pdf-protect-unlock',
  description:
    'Encrypt a PDF with an open password and permission limits (AES-256 or AES-128), or remove a password you already know.',
  category: 'pdf',
  tags: ['pdf', 'password', 'encrypt', 'decrypt', 'permissions'],
  keywords: [
    'password protect pdf',
    'encrypt pdf',
    'unlock pdf',
    'remove pdf password',
    'decrypt pdf',
    'restrict printing',
    'pdf permissions',
    'aes-256 pdf',
    'secure pdf',
  ],
  icon: 'FileLock',
  relatedTools: ['pdf-metadata', 'merge-pdf'],
  loadWasm: true,
};

export default meta;
