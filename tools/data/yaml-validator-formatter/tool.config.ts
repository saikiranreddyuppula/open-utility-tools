import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-yaml-validator-formatter-v1',
  name: 'YAML Validator & Formatter',
  slug: 'yaml-validator-formatter',
  description:
    'Validate YAML 1.2 with line and column errors, lint for gotchas like the Norway problem, then reformat with your indentation, quoting and wrapping and view the parsed JSON.',
  category: 'data',
  tags: ['yaml', 'validator', 'formatter', 'linter', 'json'],
  keywords: [
    'yaml validator',
    'yaml formatter',
    'yaml lint',
    'yaml beautifier',
    'yaml checker',
    'yaml syntax check',
    'yaml pretty print',
    'yaml to json',
    'kubernetes yaml',
    'github actions yaml',
    'docker compose yaml',
    'norway problem',
    'yaml anchors',
    'yamllint',
  ],
  icon: 'ClipboardCheck',
  relatedTools: ['yaml-to-json', 'json-to-yaml', 'json-validator', 'data-yaml-anchor-expander'],
};

export default meta;
