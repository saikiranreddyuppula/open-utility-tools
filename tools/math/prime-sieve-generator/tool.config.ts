import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-prime-sieve-generator-v1',
  name: 'Prime Sieve Generator',
  slug: 'prime-sieve-generator',
  description: 'Generate every prime up to N (or the first K primes) with the Sieve of Eratosthenes.',
  category: 'math',
  tags: ['primes', 'sieve', 'number-theory', 'generator', 'math'],
  keywords: [
    'prime numbers',
    'sieve of eratosthenes',
    'first n primes',
    'twin primes',
    'prime gap',
    'list primes',
    'generate primes',
  ],
  icon: 'Filter',
  relatedTools: [],
};

export default meta;
