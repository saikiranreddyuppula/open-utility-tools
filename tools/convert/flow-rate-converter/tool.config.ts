import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-flow-rate-converter-v1',
  name: 'Flow Rate Converter',
  slug: 'flow-rate-converter',
  description: 'Convert volumetric flow between L/s, m3/h, GPM, and CFM.',
  category: 'convert',
  tags: ['flow', 'flow-rate', 'gpm', 'cfm', 'volumetric', 'plumbing'],
  keywords: [
    'flow rate',
    'volumetric flow',
    'liters per second',
    'cubic meters per hour',
    'gallons per minute',
    'gpm',
    'cfm',
    'cubic feet per minute',
    'discharge',
  ],
  icon: 'Waves',
  relatedTools: [],
};

export default meta;
