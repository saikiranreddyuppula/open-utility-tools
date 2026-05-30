'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SameSite = 'Strict' | 'Lax' | 'None' | '';
type Prefix = 'none' | '__Host-' | '__Secure-';

export default function CookieStringBuilderTool() {
  const [name, setName] = useState('session_id');
  const [value, setValue] = useState('abc123');
  const [encode, setEncode] = useState(true);
  const [domain, setDomain] = useState('');
  const [path, setPath] = useState('/');
  const [expires, setExpires] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [secure, setSecure] = useState(true);
  const [httpOnly, setHttpOnly] = useState(true);
  const [sameSite, setSameSite] = useState<SameSite>('Lax');
  const [partitioned, setPartitioned] = useState(false);
  const [prefix, setPrefix] = useState<Prefix>('none');

  const result = useMemo(() => {
    const warnings: string[] = [];
    const fullName = (prefix === 'none' ? '' : prefix) + name.trim();

    if (!name.trim()) warnings.push('Cookie name is required.');
    if (/[\s()<>@,;:\\"/[\]?={}]/.test(name.trim())) {
      warnings.push('Cookie name contains characters not allowed in a token (no spaces, ; , = etc.).');
    }

    const encodedValue = encode ? encodeURIComponent(value) : value;
    const parts: string[] = [`${fullName}=${encodedValue}`];

    const effectiveSecure = secure || prefix !== 'none' || sameSite === 'None';
    const effectivePath = prefix === '__Host-' ? '/' : path.trim();
    const effectiveDomain = prefix === '__Host-' ? '' : domain.trim();

    if (effectiveDomain) parts.push(`Domain=${effectiveDomain}`);
    if (effectivePath) parts.push(`Path=${effectivePath}`);

    if (expires.trim()) {
      const d = new Date(expires);
      if (Number.isNaN(d.getTime())) {
        warnings.push('Expires date could not be parsed; ignoring it.');
      } else {
        parts.push(`Expires=${d.toUTCString()}`);
      }
    }
    if (maxAge.trim()) {
      const n = Number(maxAge);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        warnings.push('Max-Age must be an integer number of seconds; ignoring it.');
      } else {
        parts.push(`Max-Age=${n}`);
      }
    }

    if (effectiveSecure) parts.push('Secure');
    if (httpOnly) parts.push('HttpOnly');
    if (sameSite) parts.push(`SameSite=${sameSite}`);
    if (partitioned) parts.push('Partitioned');

    // Validation rules
    if (sameSite === 'None' && !effectiveSecure) {
      warnings.push('SameSite=None requires Secure — the cookie will be rejected without it.');
    }
    if (prefix === '__Host-') {
      if (!effectiveSecure) warnings.push('__Host- prefix requires Secure (auto-applied).');
      if (effectiveDomain) warnings.push('__Host- prefix forbids a Domain attribute (removed).');
      if (effectivePath !== '/') warnings.push('__Host- prefix requires Path=/ (auto-applied).');
    }
    if (prefix === '__Secure-' && !effectiveSecure) {
      warnings.push('__Secure- prefix requires Secure (auto-applied).');
    }
    if (partitioned && !effectiveSecure) {
      warnings.push('Partitioned cookies require Secure.');
    }
    if (expires.trim() && maxAge.trim()) {
      warnings.push('Both Expires and Max-Age set — browsers prefer Max-Age when both are present.');
    }

    return { header: parts.join('; '), warnings };
  }, [
    name,
    value,
    encode,
    domain,
    path,
    expires,
    maxAge,
    secure,
    httpOnly,
    sameSite,
    partitioned,
    prefix,
  ]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Cookie" />
        <div className="space-y-4 p-3">
          <OptionsBar>
            <Field label="Name" className="w-48">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="font-mono" />
            </Field>
            <Field label="Value" className="min-w-[200px] flex-1">
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" />
            </Field>
            <Field label="Prefix" className="w-40">
              <Select value={prefix} onValueChange={(v) => setPrefix(v as Prefix)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">(none)</SelectItem>
                  <SelectItem value="__Host-">__Host-</SelectItem>
                  <SelectItem value="__Secure-">__Secure-</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Domain" className="w-48">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="font-mono"
                disabled={prefix === '__Host-'}
              />
            </Field>
            <Field label="Path" className="w-40">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="font-mono"
                disabled={prefix === '__Host-'}
              />
            </Field>
            <Field label="SameSite" className="w-32">
              <Select value={sameSite || 'unset'} onValueChange={(v) => setSameSite((v === 'unset' ? '' : v) as SameSite)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">(unset)</SelectItem>
                  <SelectItem value="Strict">Strict</SelectItem>
                  <SelectItem value="Lax">Lax</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Expires (date)" className="w-56">
              <Input
                type="datetime-local"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Max-Age (seconds)" className="w-40">
              <Input
                type="number"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                placeholder="3600"
                className="font-mono"
              />
            </Field>
          </OptionsBar>

          <div className="flex flex-wrap gap-4">
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Switch checked={secure} onCheckedChange={setSecure} /> Secure
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Switch checked={httpOnly} onCheckedChange={setHttpOnly} /> HttpOnly
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Switch checked={partitioned} onCheckedChange={setPartitioned} /> Partitioned
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Switch checked={encode} onCheckedChange={setEncode} /> URL-encode value
            </Label>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Set-Cookie header">
          <CopyButton value={() => `Set-Cookie: ${result.header}`} label="Copy header" />
          <CopyButton value={() => result.header} size="icon-sm" />
        </PanelHeader>
        <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-sm">
          {`Set-Cookie: ${result.header}`}
        </pre>
        <StatBar items={[`${result.header.length} chars`]} />
      </Panel>

      {result.warnings.length > 0 && (
        <Panel>
          <PanelHeader title="Validation" />
          <ul className="space-y-1 p-3 text-xs text-amber-600 dark:text-amber-500">
            {result.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
