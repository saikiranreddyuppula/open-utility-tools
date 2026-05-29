import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-lorem-ipsum-v1',
  name: 'Lorem Ipsum Generator',
  slug: 'lorem-ipsum',
  description: 'Generate placeholder lorem ipsum text by paragraphs, sentences, or words.',
  category: 'text',
  tags: ['lorem', 'ipsum', 'placeholder', 'dummy text', 'filler'],
  keywords: ['lorem ipsum', 'placeholder text', 'dummy', 'filler', 'mockup'],
  icon: 'Pilcrow',
  relatedTools: ['word-count', 'case-converter', 'slugify'],
};

export default meta;
