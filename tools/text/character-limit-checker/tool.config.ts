import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-character-limit-checker-v1',
  name: 'Character Limit & SMS Segment Counter',
  slug: 'character-limit-checker',
  description:
    'Count characters, graphemes, bytes and SMS segments (GSM-7 vs UCS-2), and check text against X, Bluesky, LinkedIn, Instagram, SEO and ad-copy limits.',
  category: 'text',
  tags: ['character count', 'sms', 'gsm-7', 'twitter', 'limit', 'segments'],
  keywords: [
    'sms segment counter',
    'gsm 7 bit',
    'ucs-2',
    'sms length',
    'character counter',
    'tweet length',
    'x post length',
    'twitter character limit',
    'bluesky 300',
    'instagram caption limit',
    'meta description length',
    'google ads character count',
    'grapheme count',
    'utf-8 bytes',
    'smart quotes sms',
  ],
  icon: 'Smartphone',
  relatedTools: ['word-count', 'text-statistics', 'unicode-inspector', 'smart-quotes'],
};

export default meta;
