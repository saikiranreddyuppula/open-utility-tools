'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Auth = 'WPA' | 'WEP' | 'nopass';

/**
 * Escape reserved characters in SSID/password per the de-facto Wi-Fi QR spec.
 * Reserved: backslash, semicolon, comma, colon, and double-quote.
 */
function escapeField(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch === '\\' || ch === ';' || ch === ',' || ch === ':' || ch === '"') {
      out += '\\' + ch;
    } else {
      out += ch;
    }
  }
  return out;
}

export default function WifiQrPayloadGenerator() {
  const [ssid, setSsid] = useState('MyHomeNetwork');
  const [password, setPassword] = useState('s3cret;Pass:word');
  const [auth, setAuth] = useState<Auth>('WPA');
  const [hidden, setHidden] = useState(false);

  const result = useMemo<{ payload: string } | { error: string }>(() => {
    if (!ssid.trim()) return { error: 'SSID is required.' };
    if (auth !== 'nopass' && !password) {
      return { error: 'Password is required for WPA/WEP networks (or choose No password).' };
    }
    const parts: string[] = [`WIFI:T:${auth}`, `S:${escapeField(ssid)}`];
    if (auth !== 'nopass') {
      parts.push(`P:${escapeField(password)}`);
    }
    parts.push(`H:${hidden ? 'true' : 'false'}`);
    // Trailing double semicolon terminates the payload.
    const payload = parts.join(';') + ';;';
    return { payload };
  }, [ssid, password, auth, hidden]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Network details" />
        <OptionsBar>
          <Field label="SSID (network name)" className="min-w-[220px] flex-1">
            <Input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="My WiFi" />
          </Field>
          <Field label="Encryption">
            <Select value={auth} onValueChange={(v) => setAuth(v as Auth)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WPA">WPA / WPA2 / WPA3</SelectItem>
                <SelectItem value="WEP">WEP</SelectItem>
                <SelectItem value="nopass">No password (open)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Password"
            className="min-w-[220px] flex-1"
            hint={auth === 'nopass' ? 'Not used for open networks' : undefined}
          >
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Network password"
              disabled={auth === 'nopass'}
            />
          </Field>
          <Field label="Hidden network">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={hidden} onCheckedChange={setHidden} />
              <span className="text-sm text-muted-foreground">{hidden ? 'Hidden' : 'Visible'}</span>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="WiFi QR payload">
            <CopyButton value={result.payload} />
          </PanelHeader>
          <pre className="overflow-auto break-all whitespace-pre-wrap p-3 font-mono text-sm">
            {result.payload}
          </pre>
          <StatBar
            items={[
              `${result.payload.length} chars`,
              `type: ${auth}`,
              hidden ? 'hidden network' : 'visible network',
              'paste into any QR encoder',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
