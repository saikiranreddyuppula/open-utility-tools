import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-trim-lines-v1',
  name: 'Trim & Strip Lines',
  slug: 'trim-lines',
  description:
    'Remove leading/trailing whitespace, trailing whitespace only, or strip custom characters from each line.',
  category: 'text',
  tags: ['trim', 'whitespace', 'strip', 'lines', 'cleanup'],
  keywords: [
    'trim lines',
    'strip whitespace',
    'trailing whitespace',
    'remove leading spaces',
    'strip prefix suffix',
    'collapse spaces',
  ],
  icon: 'Eraser',
  relatedTools: [],
};

export default meta;
