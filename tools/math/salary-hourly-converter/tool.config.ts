import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-salary-hourly-converter-v1',
  name: 'Salary ↔ Hourly Pay Converter',
  slug: 'salary-hourly-converter',
  description:
    'Convert gross pay between hourly, daily, weekly, bi-weekly, semi-monthly, monthly, quarterly and annual, with overtime, time off, raise, offer comparison and freelance rate calculators.',
  category: 'math',
  tags: ['salary', 'hourly', 'pay', 'finance', 'career'],
  keywords: [
    'salary to hourly',
    'hourly to salary',
    'annual to hourly',
    'pay converter',
    'wage calculator',
    'overtime',
    'raise calculator',
    'compare job offers',
    'freelance rate',
    'bi-weekly pay',
    'semi-monthly',
  ],
  icon: 'Banknote',
  relatedTools: ['percent-increase-decrease', 'loan-emi-calculator'],
};

export default meta;
