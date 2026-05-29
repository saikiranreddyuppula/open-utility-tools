'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';

export default function RobotsTxtTool() {
  const [allowAll, setAllowAll] = useState(true);
  const [disallow, setDisallow] = useState('/admin\n/private\n/*.json$');
  const [sitemap, setSitemap] = useState('https://example.com/sitemap.xml');
  const [crawlDelay, setCrawlDelay] = useState('');

  const output = useMemo(() => {
    const lines = ['User-agent: *'];
    if (allowAll) {
      const dis = disallow.split('\n').map((l) => l.trim()).filter(Boolean);
      if (dis.length === 0) lines.push('Disallow:');
      else for (const d of dis) lines.push(`Disallow: ${d}`);
    } else {
      lines.push('Disallow: /');
    }
    if (crawlDelay.trim()) lines.push(`Crawl-delay: ${crawlDelay.trim()}`);
    if (sitemap.trim()) {
      lines.push('');
      lines.push(`Sitemap: ${sitemap.trim()}`);
    }
    return lines.join('\n') + '\n';
  }, [allowAll, disallow, sitemap, crawlDelay]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Access">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={allowAll} onCheckedChange={setAllowAll} id="aa" />
            <Label htmlFor="aa" className="text-xs text-muted-foreground">{allowAll ? 'Allow with exceptions' : 'Block everything'}</Label>
          </div>
        </Field>
        <Field label="Crawl-delay" hint="optional">
          <Input value={crawlDelay} onChange={(e) => setCrawlDelay(e.target.value)} className="w-24 font-mono" placeholder="10" />
        </Field>
        <Field label="Sitemap URL" className="flex-1">
          <Input value={sitemap} onChange={(e) => setSitemap(e.target.value)} className="font-mono" />
        </Field>
      </OptionsBar>

      {allowAll && (
        <Panel>
          <PanelHeader title="Disallowed paths (one per line)" />
          <Textarea value={disallow} onChange={(e) => setDisallow(e.target.value)} spellCheck={false} className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent" />
        </Panel>
      )}

      <Panel>
        <PanelHeader title="robots.txt">
          <CopyButton value={output} />
          <DownloadButton data={output} filename="robots.txt" />
        </PanelHeader>
        <pre className="overflow-auto p-3 font-mono text-xs">{output}</pre>
      </Panel>
    </div>
  );
}
