'use client';

import { GeneratorList } from '@/components/tools/generator-list';
import { ulid } from '@/lib/generators/ids';

export default function UlidGeneratorTool() {
  return <GeneratorList generate={ulid} downloadName="ulids.txt" label="ULIDs" />;
}
