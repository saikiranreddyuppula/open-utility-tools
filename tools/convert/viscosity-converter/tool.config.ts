import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-viscosity-converter-v1',
  name: 'Viscosity Converter',
  slug: 'viscosity-converter',
  description: 'Convert dynamic and kinematic viscosity between poise, pascal-seconds, and stokes.',
  category: 'convert',
  tags: ['viscosity', 'units', 'converter', 'fluid', 'physics'],
  keywords: [
    'poise',
    'centipoise',
    'pascal second',
    'stokes',
    'centistokes',
    'dynamic viscosity',
    'kinematic viscosity',
  ],
  icon: 'Droplet',
  relatedTools: [],
};

export default meta;
