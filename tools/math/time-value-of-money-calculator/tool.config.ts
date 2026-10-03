import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-time-value-of-money-calculator-v1',
  name: 'TVM, NPV & IRR Calculator',
  slug: 'time-value-of-money-calculator',
  description:
    'Solve for N, rate, PV, PMT or FV with an amortization schedule, then analyse cash flows with NPV, IRR, MIRR, XIRR, payback and inflation-adjusted value.',
  category: 'math',
  tags: ['finance', 'tvm', 'npv', 'irr', 'annuity'],
  keywords: [
    'time value of money',
    'present value',
    'future value',
    'net present value',
    'internal rate of return',
    'xirr',
    'xnpv',
    'mirr',
    'payback period',
    'annuity',
    'amortization',
    'financial calculator',
    'inflation',
    'real return',
    'fisher equation',
  ],
  icon: 'Landmark',
  relatedTools: ['loan-emi-calculator', 'compound-interest-calculator', 'cagr-calculator', 'roi-calculator'],
};

export default meta;
