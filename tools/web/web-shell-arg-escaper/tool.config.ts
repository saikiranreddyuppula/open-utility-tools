import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-shell-arg-escaper-v1',
  name: 'Shell Argument Escaper',
  slug: 'web-shell-arg-escaper',
  description:
    'Safely quote and escape strings for bash, sh, PowerShell, or cmd.exe.',
  category: 'web',
  tags: ['shell', 'escape', 'quote', 'bash', 'powershell'],
  keywords: ['cmd', 'sh', 'argument', 'command line', 'injection', 'quoting'],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
