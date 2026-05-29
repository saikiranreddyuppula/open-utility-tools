'use client';

import { useEffect, useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';

function parseUA(ua: string) {
  const out: Record<string, string> = {};

  // Browser
  const browsers: [string, RegExp][] = [
    ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
    ['Internet Explorer', /MSIE ([\d.]+)|Trident.*rv:([\d.]+)/],
  ];
  for (const [name, re] of browsers) {
    const m = ua.match(re);
    if (m) {
      out.Browser = `${name} ${m[1] ?? m[2] ?? ''}`.trim();
      break;
    }
  }

  // Engine
  if (/Gecko\/|rv:/.test(ua) && /Firefox/.test(ua)) out.Engine = 'Gecko';
  else if (/AppleWebKit\/([\d.]+)/.test(ua)) {
    const m = ua.match(/AppleWebKit\/([\d.]+)/);
    out.Engine = `WebKit ${m?.[1] ?? ''}`.trim();
    if (/Chrome|Edg|OPR/.test(ua)) out.Engine = `Blink (WebKit ${m?.[1] ?? ''})`;
  } else if (/Trident/.test(ua)) out.Engine = 'Trident';

  // OS
  const os: [string, RegExp][] = [
    ['Windows 11/10', /Windows NT 10\.0/],
    ['Windows 8.1', /Windows NT 6\.3/],
    ['Windows 7', /Windows NT 6\.1/],
    ['macOS', /Mac OS X ([\d_]+)/],
    ['iOS', /(?:iPhone|iPad).*OS ([\d_]+)/],
    ['Android', /Android ([\d.]+)/],
    ['Linux', /Linux/],
  ];
  for (const [name, re] of os) {
    const m = ua.match(re);
    if (m) {
      out.OS = m[1] ? `${name} ${m[1].replace(/_/g, '.')}` : name;
      break;
    }
  }

  // Device type
  if (/Mobile|iPhone|Android.*Mobile/.test(ua)) out.Device = 'Mobile';
  else if (/iPad|Tablet/.test(ua)) out.Device = 'Tablet';
  else if (/bot|crawl|spider/i.test(ua)) out.Device = 'Bot';
  else out.Device = 'Desktop';

  return out;
}

export default function UserAgentParserTool() {
  const [ua, setUa] = useState('');

  useEffect(() => {
    if (typeof navigator !== 'undefined') setUa(navigator.userAgent);
  }, []);

  const parsed = useMemo(() => (ua.trim() ? parseUA(ua) : {}), [ua]);
  const entries = Object.entries(parsed);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="User-Agent">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setUa(typeof navigator !== 'undefined' ? navigator.userAgent : '')}
          >
            Use mine
          </Button>
        </PanelHeader>
        <Textarea
          value={ua}
          onChange={(e) => setUa(e.target.value)}
          placeholder="Paste a User-Agent string…"
          spellCheck={false}
          className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {entries.length > 0 && (
        <Panel>
          <PanelHeader title="Parsed" />
          <div className="divide-y">
            {entries.map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 px-3 py-2">
                <span className="w-20 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                <code className="min-w-0 flex-1 font-mono text-xs">{v}</code>
                <CopyButton value={v} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">Parsed entirely in your browser — nothing is sent anywhere.</p>
    </div>
  );
}
