import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-docker-run-compose-converter-v1',
  name: 'Docker Run ↔ Compose Converter',
  slug: 'docker-run-compose-converter',
  description:
    'Convert docker run commands into a compose.yaml, or a compose file back into docker run commands, mapping ports, volumes, env, networks, healthchecks, GPUs and resource limits.',
  category: 'convert',
  tags: ['docker', 'compose', 'docker run', 'yaml', 'devops'],
  keywords: [
    'docker run to docker compose',
    'docker compose to docker run',
    'composerize',
    'decomposerize',
    'docker run converter',
    'compose.yaml generator',
    'docker-compose.yml from docker run',
    'podman run to compose',
  ],
  icon: 'Container',
  relatedTools: ['yaml-to-json', 'json-to-yaml', 'env-to-shell-exports'],
};

export default meta;
