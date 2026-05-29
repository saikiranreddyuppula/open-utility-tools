import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-quoted-printable-v1',
  name: 'Quoted-Printable Encode / Decode',
  slug: 'encoding-quoted-printable',
  description:
    'Encode text to MIME quoted-printable or decode quoted-printable email content back to text.',
  category: 'encoding',
  tags: ['quoted printable', 'mime', 'email'],
  keywords: ['quoted printable', 'mime', 'email', 'encode', 'decode', '=XX'],
  icon: 'Mail',
  relatedTools: [],
};

export default meta;
