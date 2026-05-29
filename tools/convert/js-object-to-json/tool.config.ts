import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-js-object-to-json-v1',
  name: 'JS Object to JSON',
  slug: 'js-object-to-json',
  description:
    'Convert a relaxed JavaScript object literal (unquoted keys, single quotes, trailing commas, comments) into strict, valid JSON.',
  category: 'convert',
  tags: ['javascript', 'json', 'convert'],
  keywords: ['javascript', 'object', 'json', 'convert', 'json5', 'literal'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
