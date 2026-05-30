import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-password-strength-checker-v1',
  name: 'Password Strength Checker',
  slug: 'password-strength-checker',
  description:
    'Score a password using composition rules and common-pattern detection with actionable feedback.',
  category: 'crypto',
  tags: ['password', 'strength', 'security', 'entropy', 'audit'],
  keywords: ['weak', 'strong', 'common password', 'keyboard', 'sequence', 'feedback'],
  icon: 'Shield',
  relatedTools: [],
};

export default meta;
