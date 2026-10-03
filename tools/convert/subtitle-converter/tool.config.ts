import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-subtitle-converter-v1',
  name: 'Subtitle Converter & Time Shifter',
  slug: 'subtitle-converter',
  description:
    'Convert subtitles between SRT, WebVTT, SBV, ASS, LRC and TTML, shift or re-sync timings, change frame rate and clean up cues.',
  category: 'convert',
  tags: ['subtitles', 'srt', 'vtt', 'captions', 'lrc', 'ass'],
  keywords: [
    'srt to vtt',
    'vtt to srt',
    'subtitle shifter',
    'subtitle sync',
    'fix subtitle delay',
    'ass to srt',
    'sbv youtube captions',
    'lrc lyrics',
    'ttml dfxp',
    'closed captions',
    'frame rate conversion',
    'remove sdh',
  ],
  icon: 'Speech',
  relatedTools: [],
};

export default meta;
