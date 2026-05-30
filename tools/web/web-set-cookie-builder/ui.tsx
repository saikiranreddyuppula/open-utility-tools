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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SameSite = 'Strict' | 'Lax' | 'None';
type Prefix = 'none' | '__Host-' | '__Secure-';
type Expiry = 'session' | 'max-age' | 'expires';

export default function SetCookieBuilder() {
  const [name, setName] = useState('session_id');
  const [value, setValue] = useState('abc123==');
  const [encodeValue, setEncodeValue] = useState(true);
  const [prefix, setPrefix] = useState<Prefix>('none');
  const [domain, setDomain] = useState('');
  const [path, setPath] = useState('/');
  const [expiry, setExpiry] = useState<Expiry>('max-age');
  const [maxAge, setMaxAge] = useState('3600');
  const [expiresAt, setExpiresAt] = useState('');
  const [secure, setSecure] = useState(true);
  const [httpOnly, setHttpOnly] = useState(true);
  const [sameSite, setSameSite] = useState<SameSite>('Lax');

  const result = useMemo(() => {
    const warnings: string[] = [];
    const effectivePrefix = prefix === 'none' ? '' : prefix;
    const fullName = `${effectivePrefix}${name.trim()}`;

    // Cookie name validation (RFC 6265 token).
    if (!name.trim()) {
      warnings.push('Cookie name is required.');
    } else if (/[\s()<>@,;:\\"/[\]?={}]/.test(name.trim())) {
      warnings.push('Cookie name contains characters not allowed in a token.');
    }

    // Prefix rules.
    let forceSecure = secure;
    let forcePathRoot = false;
    if (prefix === '__Host-') {
      if (domain.trim())
        warnings.push('__Host- cookies must NOT set a Domain attribute.');
      if (path.trim() !== '/')
        warnings.push('__Host- cookies require Path=/.');
      if (!secure) warnings.push('__Host- cookies require the Secure attribute.');
      forceSecure = true;
      forcePathRoot = true;
    } else if (prefix === '__Secure-') {
      if (!secure)
        warnings.push('__Secure- cookies require the Secure attribute.');
      forceSecure = true;
    }

    // SameSite=None requires Secure.
    if (sameSite === 'None' && !forceSecure) {
      warnings.push('SameSite=None requires the Secure attribute.');
    }

    const rawValue = value;
    const outValue = encodeValue ? encodeURIComponent(rawValue) : rawValue;
    if (!encodeValue && /[\s,;\\"]/.test(rawValue)) {
      warnings.push(
        'Value contains characters that should be URL-encoded (enable encoding).',
      );
    }

    const parts: string[] = [`${fullName}=${outValue}`];

    if (domain.trim() && prefix !== '__Host-')
      parts.push(`Domain=${domain.trim()}`);

    const finalPath = forcePathRoot ? '/' : path.trim() || '/';
    parts.push(`Path=${finalPath}`);

    if (expiry === 'max-age') {
      const ma = Number(maxAge);
      if (!Number.isFinite(ma)) {
        warnings.push('Max-Age must be a number of seconds.');
      } else {
        parts.push(`Max-Age=${Math.trunc(ma)}`);
      }
    } else if (expiry === 'expires') {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) {
        warnings.push('Expires date is invalid.');
      } else {
        parts.push(`Expires=${d.toUTCString()}`);
      }
    }

    if (forceSecure) parts.push('Secure');
    if (httpOnly) parts.push('HttpOnly');
    parts.push(`SameSite=${sameSite}`);

    const header = `Set-Cookie: ${parts.join('; ')}`;
    return { header, warnings, fullName, forceSecure };
  }, [
    name,
    value,
    encodeValue,
    prefix,
    domain,
    path,
    expiry,
    maxAge,
    expiresAt,
    secure,
    httpOnly,
    sameSite,
  ]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Cookie attributes" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Prefix">
              <Select value={prefix} onValueChange={(v) => setPrefix(v as Prefix)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">none</SelectItem>
                  <SelectItem value="__Host-">__Host-</SelectItem>
                  <SelectItem value="__Secure-">__Secure-</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Name" className="min-w-[140px] flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-mono"
                spellCheck={false}
              />
            </Field>
          </OptionsBar>
          <Field label="Value">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="font-mono"
              spellCheck={false}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={encodeValue} onCheckedChange={setEncodeValue} />
            URL-encode value (encodeURIComponent)
          </label>

          <OptionsBar>
            <Field label="Domain" className="min-w-[140px] flex-1">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="(host-only)"
                className="font-mono"
                spellCheck={false}
                disabled={prefix === '__Host-'}
              />
            </Field>
            <Field label="Path">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-28 font-mono"
                spellCheck={false}
                disabled={prefix === '__Host-'}
              />
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Expiry">
              <Select value={expiry} onValueChange={(v) => setExpiry(v as Expiry)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="session">session</SelectItem>
                  <SelectItem value="max-age">Max-Age</SelectItem>
                  <SelectItem value="expires">Expires</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {expiry === 'max-age' && (
              <Field label="Max-Age (seconds)">
                <Input
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                  className="w-28 font-mono"
                  inputMode="numeric"
                />
              </Field>
            )}
            {expiry === 'expires' && (
              <Field label="Expires (date/time)">
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-52 font-mono"
                />
              </Field>
            )}
          </OptionsBar>

          <OptionsBar>
            <Field label="Secure">
              <Switch
                checked={result.forceSecure}
                onCheckedChange={setSecure}
                disabled={prefix !== 'none' || sameSite === 'None'}
              />
            </Field>
            <Field label="HttpOnly">
              <Switch checked={httpOnly} onCheckedChange={setHttpOnly} />
            </Field>
            <Field label="SameSite">
              <Select
                value={sameSite}
                onValueChange={(v) => setSameSite(v as SameSite)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Strict">Strict</SelectItem>
                  <SelectItem value="Lax">Lax</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Set-Cookie header">
            <CopyButton value={() => result.header} />
          </PanelHeader>
          <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
            {result.header}
          </pre>
          <StatBar
            items={[
              result.fullName,
              `SameSite=${sameSite}`,
              result.forceSecure ? 'Secure' : 'not secure',
              httpOnly ? 'HttpOnly' : 'JS-readable',
            ]}
          />
        </Panel>

        {result.warnings.length > 0 && (
          <Panel>
            <PanelHeader title="Validation warnings" />
            <ul className="space-y-1.5 p-3 text-xs text-amber-700 dark:text-amber-400">
              {result.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
