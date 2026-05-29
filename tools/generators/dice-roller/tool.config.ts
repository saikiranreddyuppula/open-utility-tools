import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-dice-v1',
  name: 'Dice & Coin Roller',
  slug: 'dice-roller',
  description: 'Roll dice (d4–d100, multiple dice) and flip coins with fair randomness.',
  category: 'generators',
  tags: ['dice', 'coin', 'random', 'rng', 'roll'],
  keywords: ['dice roller', 'coin flip', 'd20', 'random number', 'rng', 'tabletop'],
  icon: 'Dice5',
  relatedTools: ['random-string', 'password-generator', 'uuid-generator'],
};

export default meta;
