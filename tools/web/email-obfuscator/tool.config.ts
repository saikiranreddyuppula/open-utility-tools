import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-email-obfuscator-v1',
  name: 'Email Obfuscator',
  slug: 'email-obfuscator',
  description: 'Obfuscate an email address (entities / JS) to deter scrapers.',
  category: 'web',
  tags: ['email', 'obfuscate', 'anti-spam', 'entities'],
  keywords: ['email obfuscator', 'hide email', 'anti spam', 'html entities email', 'protect email'],
  icon: 'AtSign',
  relatedTools: ['html-entities', 'url-encode', 'meta-tags'],
};

export default meta;
