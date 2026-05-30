import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-snowflake-id-generator-v1',
  name: 'Snowflake ID Generator',
  slug: 'snowflake-id-generator',
  description:
    'Generate Twitter-style 64-bit Snowflake IDs with configurable epoch, worker, and sequence bits.',
  category: 'generators',
  tags: ['snowflake', 'id', 'distributed', 'bigint', 'timestamp'],
  keywords: [
    'snowflake id',
    'twitter id',
    'distributed id',
    '64-bit id',
    'worker id',
    'sequence',
    'discord id',
  ],
  icon: 'Snowflake',
  relatedTools: [],
};

export default meta;
