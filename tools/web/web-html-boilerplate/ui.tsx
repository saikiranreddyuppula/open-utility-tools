'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

export default function HtmlBoilerplateTool() {
  const [title, setTitle] = useState('Document');
  const [lang, setLang] = useState('en');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [includeViewport, setIncludeViewport] = useState(true);
  const [includeMeta, setIncludeMeta] = useState(true);
  const [includeOg, setIncludeOg] = useState(false);
  const [linkCss, setLinkCss] = useState(true);
  const [linkJs, setLinkJs] = useState(true);

  const output = useMemo(() => {
    const indent = '    ';
    const head: string[] = [];
    head.push(`${indent}<meta charset="UTF-8" />`);
    if (includeViewport) {
      head.push(
        `${indent}<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
      );
    }
    head.push(`${indent}<title>${escapeHtml(title || 'Document')}</title>`);

    if (includeMeta) {
      if (description.trim()) {
        head.push(`${indent}<meta name="description" content="${escapeAttr(description.trim())}" />`);
      }
      if (author.trim()) {
        head.push(`${indent}<meta name="author" content="${escapeAttr(author.trim())}" />`);
      }
    }

    if (includeOg) {
      head.push('');
      head.push(`${indent}<!-- Open Graph -->`);
      head.push(`${indent}<meta property="og:type" content="website" />`);
      head.push(`${indent}<meta property="og:title" content="${escapeAttr(title || 'Document')}" />`);
      if (description.trim()) {
        head.push(
          `${indent}<meta property="og:description" content="${escapeAttr(description.trim())}" />`,
        );
      }
    }

    if (linkCss) {
      head.push('');
      head.push(`${indent}<link rel="stylesheet" href="styles.css" />`);
    }

    const bodyLines: string[] = [`${indent}<h1>${escapeHtml(title || 'Document')}</h1>`];
    if (linkJs) {
      bodyLines.push(`${indent}<script src="script.js"></script>`);
    }

    const safeLang = escapeAttr(lang.trim() || 'en');

    return `<!DOCTYPE html>
<html lang="${safeLang}">
  <head>
${head.join('\n')}
  </head>
  <body>
${bodyLines.join('\n')}
  </body>
</html>`;
  }, [
    title,
    lang,
    description,
    author,
    includeViewport,
    includeMeta,
    includeOg,
    linkCss,
    linkJs,
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Title" className="w-full">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document" />
          </Field>
          <Field label="Language">
            <Input
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              placeholder="en"
              className="w-[100px]"
            />
          </Field>
          <Field label="Description" className="w-full">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Page description"
            />
          </Field>
          <Field label="Author" className="w-full">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Jane Doe" />
          </Field>

          <div className="flex w-full flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
              <Switch id="viewport" checked={includeViewport} onCheckedChange={setIncludeViewport} />
              <Label htmlFor="viewport" className="text-sm">
                Responsive viewport meta
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="meta" checked={includeMeta} onCheckedChange={setIncludeMeta} />
              <Label htmlFor="meta" className="text-sm">
                Description / author meta
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="og" checked={includeOg} onCheckedChange={setIncludeOg} />
              <Label htmlFor="og" className="text-sm">
                Open Graph tags
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="css" checked={linkCss} onCheckedChange={setLinkCss} />
              <Label htmlFor="css" className="text-sm">
                Link styles.css
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="js" checked={linkJs} onCheckedChange={setLinkJs} />
              <Label htmlFor="js" className="text-sm">
                Link script.js
              </Label>
            </div>
          </div>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="index.html">
          <div className="flex gap-1">
            <CopyButton value={output} />
            <DownloadButton data={output} filename="index.html" mime="text/html" />
          </div>
        </PanelHeader>
        <Textarea
          value={output}
          readOnly
          className="min-h-[360px] resize-y border-0 bg-muted/20 font-mono text-sm focus-visible:ring-0"
        />
      </Panel>
    </div>
  );
}
