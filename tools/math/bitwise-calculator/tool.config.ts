import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-bitwise-v1',
  name: 'Bitwise Calculator',
  slug: 'bitwise-calculator',
  description: 'Perform AND, OR, XOR, NOT and shifts on two integers, shown in all bases.',
  category: 'math',
  tags: ['bitwise', 'and', 'or', 'xor', 'shift', 'binary'],
  keywords: ['bitwise', 'and or xor', 'bit shift', 'binary operations', 'mask'],
  icon: 'Binary',
  relatedTools: ['number-base-converter', 'binary-text', 'prime-checker'],
};

export default meta;
