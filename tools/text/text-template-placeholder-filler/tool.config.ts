import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-template-placeholder-filler-v1',
  name: 'Template Placeholder Filler',
  slug: 'text-template-placeholder-filler',
  description:
    'Fills {{name}}-style placeholders in a template using key=value pairs or a JSON object.',
  category: 'text',
  tags: ['template', 'placeholder', 'mustache', 'merge', 'variables'],
  keywords: [
    'fill template',
    'placeholder replace',
    'mustache',
    'mail merge',
    'string interpolation',
    'key value substitution',
    'variable substitution',
  ],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
