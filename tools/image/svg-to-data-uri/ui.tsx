'use client';

import { useCallback, useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

const SAMPLE = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>';

function toDataUri(svg: string, mode: 'url' | 'base64'): string {
  const cleaned = svg.replace(/\s+/g, ' ').trim();
  if (mode === 'base64') {
    const b64 = btoa(unescape(encodeURIComponent(cleaned)));
    return `data:image/svg+xml;base64,${b64}`;
  }
  // URL-encoding optimized for SVG (keep readable chars).
  const encoded = encodeURIComponent(cleaned)
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
    .replace(/%22/g, "'");
  return `data:image/svg+xml,${encoded}`;
}

export default function SvgToDataUriTool() {
  const [svg, setSvg] = useState(SAMPLE);
  const [mode, setMode] = useState<'url' | 'base64'>('url');

  const uri = useMemo(() => (svg.trim() ? toDataUri(svg, mode) : ''), [svg, mode]);
  const css = uri ? `background-image: url("${uri}");` : '';

  const onChange = useCallback((v: string) => setSvg(v), []);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Encoding">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'url' | 'base64')}>
            <TabsList>
              <TabsTrigger value="url">URL-encoded</TabsTrigger>
              <TabsTrigger value="base64">Base64</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="SVG" />
        <Textarea
          value={svg}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {uri && (
        <Panel>
          <PanelHeader title="data-URI">
            <CopyButton value={uri} />
          </PanelHeader>
          <code className="block max-h-40 overflow-auto break-all p-3 font-mono text-xs">{uri}</code>
          <StatBar items={[`${uri.length.toLocaleString()} chars`, mode === 'url' ? 'URL-encoded (smaller for SVG)' : 'Base64']} />
        </Panel>
      )}
      {css && (
        <Panel>
          <PanelHeader title="CSS">
            <CopyButton value={css} />
          </PanelHeader>
          <code className="block break-all p-3 font-mono text-xs">{css}</code>
        </Panel>
      )}
    </div>
  );
}
