import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generators-systemd-service-unit-v1',
  name: 'systemd Service Unit Generator',
  slug: 'generators-systemd-service-unit',
  description: 'Generate a systemd .service unit file from descriptive form inputs.',
  category: 'generators',
  tags: ['systemd', 'service', 'linux', 'unit', 'daemon'],
  keywords: ['systemd', 'service unit', '.service', 'ExecStart', 'daemon', 'linux', 'systemctl'],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
