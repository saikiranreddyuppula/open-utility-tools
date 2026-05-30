import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-hcl-v1',
  name: 'JSON to HCL / Terraform',
  slug: 'json-to-hcl',
  description: 'Convert a JSON object to HCL2 (Terraform-style) syntax.',
  category: 'data',
  tags: ['json', 'hcl', 'terraform', 'config', 'convert'],
  keywords: ['json to hcl', 'terraform', 'hcl2', 'config', 'infrastructure as code'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
