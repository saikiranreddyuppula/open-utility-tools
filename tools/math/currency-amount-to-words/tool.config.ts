import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-currency-amount-to-words-v1',
  name: 'Currency Amount to Words',
  slug: 'currency-amount-to-words',
  description: "Spell a monetary amount in legal/cheque form like 'One Thousand Two Hundred Dollars and 50/100'.",
  category: 'math',
  tags: ['currency', 'cheque', 'words', 'legal', 'amount'],
  keywords: ['amount in words', 'cheque', 'check writing', 'dollars', 'rupees', 'lakh', 'crore', 'spell amount', 'legal amount'],
  icon: 'Banknote',
  relatedTools: [],
};

export default meta;
