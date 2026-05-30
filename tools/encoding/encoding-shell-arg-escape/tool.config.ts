import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-shell-arg-escape-v1',
  name: 'Shell Argument Escaper / Quoter',
  slug: 'encoding-shell-arg-escape',
  description: 'Safely quote text as a single shell argument for POSIX sh/bash or PowerShell.',
  category: 'encoding',
  tags: ['shell', 'bash', 'escape', 'quote', 'powershell'],
  keywords: ['shell', 'bash', 'sh', 'posix', 'powershell', 'escape', 'quote', 'argument', 'shlex'],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
