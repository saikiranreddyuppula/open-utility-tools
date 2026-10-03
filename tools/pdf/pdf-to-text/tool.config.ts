import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-pdf-to-text-v1',
  name: 'PDF to Text',
  slug: 'pdf-to-text',
  description:
    'Extract the text layer of a PDF with page ranges, paragraph reflow and search — password-protected files supported.',
  category: 'pdf',
  tags: ['pdf', 'text', 'extract', 'copy', 'search'],
  keywords: [
    'pdf to text',
    'extract text from pdf',
    'pdf to txt',
    'pdf text extractor',
    'copy text from pdf',
    'pdf reflow paragraphs',
    'dehyphenate',
    'search in pdf',
  ],
  icon: 'FileType',
  relatedTools: ['pdf-metadata', 'split-pdf'],
  loadWasm: true,
};

export default meta;
