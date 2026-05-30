import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-verhoeff-damm-check-v1',
  name: 'Verhoeff & Damm Check Digit',
  slug: 'verhoeff-damm-check',
  description: 'Compute and validate Verhoeff and Damm check digits for error-detecting numeric strings.',
  category: 'crypto',
  tags: ['verhoeff', 'damm', 'check-digit', 'checksum', 'validator'],
  keywords: ['dihedral', 'quasigroup', 'aadhaar', 'error detection', 'transposition'],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
