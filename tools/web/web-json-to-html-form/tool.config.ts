import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-json-to-html-form-v1',
  name: 'JSON to HTML Form Generator',
  slug: 'web-json-to-html-form',
  description:
    "Turn a JSON object into a matching HTML form with labeled inputs inferred from each field's value type.",
  category: 'web',
  tags: ['json', 'html', 'form', 'generator', 'scaffold'],
  keywords: ['json to form', 'html form', 'form generator', 'input fields', 'scaffold form', 'labeled inputs'],
  icon: 'ClipboardList',
  relatedTools: [],
};

export default meta;
