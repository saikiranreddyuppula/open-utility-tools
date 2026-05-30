'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Browser = 'chrome' | 'firefox' | 'safari' | 'edge';
type OS = 'windows' | 'macos' | 'linux' | 'android' | 'ios';
type Device = 'desktop' | 'mobile' | 'tablet';
type Preset = 'custom' | 'googlebot' | 'bingbot' | 'curl' | 'wget';

interface Token {
  label: string;
  value: string;
}

interface PresetInfo {
  ua: string;
  tokens: Token[];
}

const PRESETS: Record<Exclude<Preset, 'custom'>, PresetInfo> = {
  googlebot: {
    ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    tokens: [
      { label: 'Product', value: 'Mozilla/5.0' },
      { label: 'Compatibility', value: 'compatible; Googlebot/2.1' },
      { label: 'Info URL', value: '+http://www.google.com/bot.html' },
    ],
  },
  bingbot: {
    ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    tokens: [
      { label: 'Product', value: 'Mozilla/5.0' },
      { label: 'Compatibility', value: 'compatible; bingbot/2.0' },
      { label: 'Info URL', value: '+http://www.bing.com/bingbot.htm' },
    ],
  },
  curl: {
    ua: 'curl/8.7.1',
    tokens: [{ label: 'Product/Version', value: 'curl/8.7.1' }],
  },
  wget: {
    ua: 'Wget/1.24.5',
    tokens: [{ label: 'Product/Version', value: 'Wget/1.24.5' }],
  },
};

// Default per-OS platform tokens used inside the (...) comment block.
function platformToken(os: OS, device: Device, osVer: string): string {
  switch (os) {
    case 'windows':
      return `Windows NT ${osVer || '10.0'}; Win64; x64`;
    case 'macos':
      return `Macintosh; Intel Mac OS X ${(osVer || '10.15.7').replace(/\./g, '_')}`;
    case 'linux':
      return 'X11; Linux x86_64';
    case 'android':
      return `Linux; Android ${osVer || '14'}; ${device === 'tablet' ? 'SM-X710' : 'Pixel 8'}`;
    case 'ios':
      return device === 'tablet'
        ? `iPad; CPU OS ${(osVer || '17_5').replace(/\./g, '_')} like Mac OS X`
        : `iPhone; CPU iPhone OS ${(osVer || '17_5').replace(/\./g, '_')} like Mac OS X`;
    default:
      return 'X11; Linux x86_64';
  }
}

function defaultOsVersion(os: OS): string {
  switch (os) {
    case 'windows':
      return '10.0';
    case 'macos':
      return '10.15.7';
    case 'linux':
      return '';
    case 'android':
      return '14';
    case 'ios':
      return '17.5';
    default:
      return '';
  }
}

function buildTokens(
  browser: Browser,
  os: OS,
  device: Device,
  browserVer: string,
  osVer: string,
): { ua: string; tokens: Token[] } {
  const platform = platformToken(os, device, osVer);
  const mobileTag =
    os === 'android'
      ? ' Mobile'
      : os === 'ios' && device !== 'tablet'
        ? ' Mobile/15E148'
        : '';
  const bv = browserVer.trim();
  const tokens: Token[] = [{ label: 'Product', value: 'Mozilla/5.0' }];
  tokens.push({ label: 'Platform', value: `(${platform})` });

  let ua: string;
  switch (browser) {
    case 'chrome': {
      const v = bv || '125.0.0.0';
      ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}${mobileTag} Safari/537.36`;
      tokens.push(
        { label: 'Engine', value: 'AppleWebKit/537.36 (KHTML, like Gecko)' },
        { label: 'Browser', value: `Chrome/${v}` },
        ...(mobileTag ? [{ label: 'Form factor', value: mobileTag.trim() }] : []),
        { label: 'Compatibility', value: 'Safari/537.36' },
      );
      return { ua, tokens };
    }
    case 'edge': {
      const v = bv || '125.0.0.0';
      ua = `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}${mobileTag} Safari/537.36 Edg/${v}`;
      tokens.push(
        { label: 'Engine', value: 'AppleWebKit/537.36 (KHTML, like Gecko)' },
        { label: 'Chromium base', value: `Chrome/${v}` },
        ...(mobileTag ? [{ label: 'Form factor', value: mobileTag.trim() }] : []),
        { label: 'Compatibility', value: 'Safari/537.36' },
        { label: 'Edge brand', value: `Edg/${v}` },
      );
      return { ua, tokens };
    }
    case 'firefox': {
      const v = bv || '126.0';
      const rv = v.split('.')[0] ?? '126';
      ua = `Mozilla/5.0 (${platform}; rv:${rv}.0) Gecko/20100101 Firefox/${v}`;
      tokens.push(
        { label: 'Gecko version', value: `rv:${rv}.0` },
        { label: 'Engine', value: 'Gecko/20100101' },
        { label: 'Browser', value: `Firefox/${v}` },
      );
      return { ua, tokens };
    }
    case 'safari': {
      const v = bv || '17.5';
      ua = `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v}${mobileTag} Safari/605.1.15`;
      tokens.push(
        { label: 'Engine', value: 'AppleWebKit/605.1.15 (KHTML, like Gecko)' },
        { label: 'Safari version', value: `Version/${v}` },
        ...(mobileTag ? [{ label: 'Form factor', value: mobileTag.trim() }] : []),
        { label: 'Compatibility', value: 'Safari/605.1.15' },
      );
      return { ua, tokens };
    }
    default:
      return { ua: 'Mozilla/5.0', tokens };
  }
}

const BROWSER_LABEL: Record<Browser, string> = {
  chrome: 'Chrome',
  firefox: 'Firefox',
  safari: 'Safari',
  edge: 'Edge',
};
const OS_LABEL: Record<OS, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  android: 'Android',
  ios: 'iOS',
};

export default function UserAgentBuilderTool() {
  const [preset, setPreset] = useState<Preset>('custom');
  const [browser, setBrowser] = useState<Browser>('chrome');
  const [os, setOS] = useState<OS>('windows');
  const [device, setDevice] = useState<Device>('desktop');
  const [browserVer, setBrowserVer] = useState('125.0.0.0');
  const [osVer, setOSVer] = useState('10.0');

  const result = useMemo<{ ua: string; tokens: Token[] }>(() => {
    if (preset !== 'custom') {
      return PRESETS[preset];
    }
    return buildTokens(browser, os, device, browserVer, osVer);
  }, [preset, browser, os, device, browserVer, osVer]);

  const onOSChange = (next: OS) => {
    setOS(next);
    setOSVer(defaultOsVersion(next));
  };

  const isBot = preset !== 'custom';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Preset">
            <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom build</SelectItem>
                <SelectItem value="googlebot">Googlebot</SelectItem>
                <SelectItem value="bingbot">Bingbot</SelectItem>
                <SelectItem value="curl">curl</SelectItem>
                <SelectItem value="wget">Wget</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {!isBot && (
            <>
              <Field label="Browser">
                <Select value={browser} onValueChange={(v) => setBrowser(v as Browser)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chrome">Chrome</SelectItem>
                    <SelectItem value="firefox">Firefox</SelectItem>
                    <SelectItem value="safari">Safari</SelectItem>
                    <SelectItem value="edge">Edge</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Operating system">
                <Select value={os} onValueChange={(v) => onOSChange(v as OS)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="windows">Windows</SelectItem>
                    <SelectItem value="macos">macOS</SelectItem>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="android">Android</SelectItem>
                    <SelectItem value="ios">iOS</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Device class">
                <Select value={device} onValueChange={(v) => setDevice(v as Device)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Browser version">
                <Input
                  value={browserVer}
                  onChange={(e) => setBrowserVer(e.target.value)}
                  className="w-32 font-mono"
                  placeholder="125.0.0.0"
                />
              </Field>

              <Field label="OS version">
                <Input
                  value={osVer}
                  onChange={(e) => setOSVer(e.target.value)}
                  className="w-28 font-mono"
                  placeholder="10.0"
                />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="User-Agent string">
          <CopyButton value={() => result.ua} label="Copy" />
        </PanelHeader>
        <div className="flex items-start gap-2 p-3">
          <code className="block min-w-0 flex-1 break-all rounded bg-muted px-3 py-2 font-mono text-sm">
            {result.ua}
          </code>
          <CopyButton value={result.ua} size="icon-sm" />
        </div>
        <StatBar
          items={[
            `${result.ua.length} chars`,
            isBot ? 'preset bot/tool' : `${BROWSER_LABEL[browser]} on ${OS_LABEL[os]}`,
            isBot ? null : device,
          ]}
        />
      </Panel>

      <Panel>
        <PanelHeader title="Token breakdown" />
        <div className="max-h-[360px] divide-y overflow-auto">
          {result.tokens.map((t, i) => (
            <div key={`${t.label}-${i}`} className="flex items-center gap-3 px-3 py-2">
              <span className="w-32 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                {t.label}
              </span>
              <code className="min-w-0 flex-1 break-all font-mono text-xs">
                {t.value}
              </code>
              <CopyButton value={t.value} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar items={[`${result.tokens.length} tokens`]} />
      </Panel>

      {!isBot && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBrowser('chrome');
              setOS('windows');
              setDevice('desktop');
              setBrowserVer('125.0.0.0');
              setOSVer('10.0');
            }}
          >
            Desktop Chrome example
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBrowser('safari');
              setOS('ios');
              setDevice('mobile');
              setBrowserVer('17.5');
              setOSVer('17.5');
            }}
          >
            iPhone Safari example
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBrowser('chrome');
              setOS('android');
              setDevice('mobile');
              setBrowserVer('125.0.0.0');
              setOSVer('14');
            }}
          >
            Android Chrome example
          </Button>
        </div>
      )}
    </div>
  );
}
