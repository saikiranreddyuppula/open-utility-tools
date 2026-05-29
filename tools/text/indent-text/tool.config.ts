import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-indent-text-v1',
  name: 'Indent & Dedent Text',
  slug: 'indent-text',
  description:
    'Add or remove leading indentation on every line, converting tabs to spaces or spaces to tabs with a configurable width.',
  category: 'text',
  tags: ['indent', 'dedent', 'whitespace'],
  keywords: ['indent', 'dedent', 'tabs to spaces', 'format', 'whitespace'],
  icon: 'AlignJustify',
  relatedTools: [],
};

export default meta;
