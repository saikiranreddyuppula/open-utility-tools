'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { markdownToHtml } from '@/lib/text/markdown';

const SAMPLE = `# Hello

Some **bold** and *italic* text with \`inline code\`.

- list item one
- list item two

> A blockquote

\`\`\`js
const x = 42;
\`\`\`

[A link](https://example.com)
`;

export default function MarkdownPreviewTool() {
  const [md, setMd] = useState(SAMPLE);
  const [view, setView] = useState<'preview' | 'html'>('preview');

  const html = useMemo(() => markdownToHtml(md), [md]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Markdown" />
        <Textarea
          value={md}
          onChange={(e) => setMd(e.target.value)}
          spellCheck={false}
          className="min-h-[420px] resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>
      <Panel>
        <PanelHeader title={view === 'preview' ? 'Preview' : 'HTML'}>
          <Tabs value={view} onValueChange={(v) => setView(v as 'preview' | 'html')}>
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>
          </Tabs>
          <CopyButton value={() => html} label="Copy HTML" />
        </PanelHeader>
        {view === 'preview' ? (
          <div
            className="ut-prose min-h-[420px] overflow-auto p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="min-h-[420px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap break-all">
            {html}
          </pre>
        )}
      </Panel>
    </div>
  );
}
