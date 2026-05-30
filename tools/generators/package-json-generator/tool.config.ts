import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-package-json-generator-v1',
  name: 'package.json Generator',
  slug: 'package-json-generator',
  description:
    'Scaffold a valid package.json from form fields: name, version, type, scripts, deps placeholders, license.',
  category: 'generators',
  tags: ['package.json', 'npm', 'node', 'scaffold', 'json'],
  keywords: ['package json', 'npm init', 'manifest', 'scripts', 'dependencies', 'semver', 'spdx'],
  icon: 'Package',
  relatedTools: [],
};

export default meta;
