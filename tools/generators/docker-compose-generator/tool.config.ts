import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-docker-compose-generator-v1',
  name: 'docker-compose.yml Generator',
  slug: 'docker-compose-generator',
  description: 'Build a docker-compose.yml from selected services (web, postgres, redis, mysql, mongo) with ports and volumes.',
  category: 'generators',
  tags: ['docker', 'docker-compose', 'yaml', 'devops', 'containers'],
  keywords: ['docker compose', 'docker-compose.yml', 'compose file', 'postgres', 'redis', 'mysql', 'mongo', 'nginx'],
  icon: 'Boxes',
  relatedTools: [],
};

export default meta;
