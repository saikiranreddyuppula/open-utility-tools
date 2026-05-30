import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generators-ssh-config-builder-v1',
  name: 'SSH Config Block Builder',
  slug: 'generators-ssh-config-builder',
  description: 'Build a well-formed ~/.ssh/config Host block from form fields.',
  category: 'generators',
  tags: ['ssh', 'config', 'devops', 'host', 'proxyjump'],
  keywords: ['ssh config', 'host block', 'identityfile', 'proxyjump', 'forwardagent', 'ssh aliases'],
  icon: 'ServerCog',
  relatedTools: [],
};

export default meta;
