import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-electrical-calculator-v1',
  name: "Electrical Calculator (Ohm's Law, Resistors & Power)",
  slug: 'electrical-calculator',
  description:
    "Ohm's law and power wheel, resistor colour codes with E-series and SMD decoder, series/parallel, voltage divider, LED resistor, AC power and wire voltage drop in one tabbed toolkit.",
  category: 'math',
  tags: ['electronics', 'ohms law', 'resistor', 'power', 'wire'],
  keywords: [
    'ohms law',
    'power wheel',
    'resistor color code',
    'resistor colour code',
    'smd resistor code',
    'eia-96',
    'e12',
    'e24',
    'e96',
    'series parallel resistors',
    'voltage divider',
    'led resistor',
    'kva kw amps',
    'three phase power',
    'power factor',
    'voltage drop',
    'awg wire',
    'wire gauge',
  ],
  icon: 'Zap',
  relatedTools: ['engineering-notation-converter', 'unit-converter'],
};

export default meta;
