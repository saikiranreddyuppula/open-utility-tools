'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface FieldExp {
  label: string;
  value: string;
  note?: string;
}

interface ParsedLine {
  format: 'passwd' | 'shadow' | 'unknown';
  raw: string;
  fields: FieldExp[];
  error?: string;
}

const HASH_IDS: Record<string, string> = {
  '1': 'MD5 (crypt)',
  '2': 'bcrypt',
  '2a': 'bcrypt',
  '2b': 'bcrypt',
  '2x': 'bcrypt',
  '2y': 'bcrypt',
  '5': 'SHA-256 (crypt)',
  '6': 'SHA-512 (crypt)',
  '7': 'scrypt (libscrypt)',
  y: 'yescrypt',
  gy: 'gost-yescrypt',
  argon2id: 'Argon2id',
  argon2i: 'Argon2i',
};

function explainHash(hash: string): string {
  if (hash === '' ) return 'empty — no password set (passwordless login possible)';
  if (hash === '*' ) return 'login disabled (no valid password)';
  if (hash === '!' || hash === '!!') return 'account locked / password not set';
  if (hash.startsWith('!')) return 'locked account (prefixed with !)';
  if (hash.startsWith('x')) return 'placeholder — actual hash is in /etc/shadow';
  const m = hash.match(/^\$([^$]+)\$/);
  if (m && m[1]) {
    const id = m[1];
    const algo = HASH_IDS[id] ?? `unknown crypt id "$${id}$"`;
    return `${algo} hash`;
  }
  if (/^[./0-9A-Za-z]{13}$/.test(hash)) return 'legacy DES crypt hash';
  return 'password hash';
}

function passwdFields(parts: string[]): FieldExp[] {
  const [name, passwd, uid, gid, gecos, home, shell] = parts;
  const uidNum = Number(uid);
  let uidNote = '';
  if (Number.isFinite(uidNum)) {
    if (uidNum === 0) uidNote = 'root / superuser';
    else if (uidNum < 1000) uidNote = 'system / service account';
    else uidNote = 'regular user';
  }
  return [
    { label: 'Username', value: name ?? '' },
    { label: 'Password', value: passwd ?? '', note: explainHash(passwd ?? '') },
    { label: 'UID', value: uid ?? '', note: uidNote },
    { label: 'GID', value: gid ?? '', note: 'primary group id' },
    { label: 'GECOS / comment', value: gecos ?? '', note: 'full name & contact info' },
    { label: 'Home directory', value: home ?? '' },
    { label: 'Login shell', value: shell ?? '', note: (shell ?? '').includes('nologin') || (shell ?? '').endsWith('false') ? 'login disabled' : '' },
  ];
}

function shadowFields(parts: string[]): FieldExp[] {
  const [name, hash, last, min, max, warn, inactive, expire] = parts;
  function days(label: string, v: string | undefined, note: string): FieldExp {
    if (v === undefined || v === '') return { label, value: '', note: 'unset' };
    return { label, value: v, note };
  }
  let lastNote = 'days since 1970-01-01 of last change';
  if (last === '0') lastNote = 'must change password at next login';
  return [
    { label: 'Username', value: name ?? '' },
    { label: 'Password hash', value: hash ?? '', note: explainHash(hash ?? '') },
    days('Last change', last, lastNote),
    days('Min days', min, 'minimum days before change allowed'),
    days('Max days', max, 'maximum days the password is valid'),
    days('Warn days', warn, 'days before expiry to warn the user'),
    days('Inactive days', inactive, 'grace days after expiry before lockout'),
    days('Expire date', expire, 'days since 1970-01-01 when account disables'),
  ];
}

function parseLine(line: string): ParsedLine {
  const parts = line.split(':');
  if (parts.length === 7) return { format: 'passwd', raw: line, fields: passwdFields(parts) };
  if (parts.length === 9 || parts.length === 8) {
    // shadow has 9 colon-separated fields (8 colons); 8 parts when trailing reserved field omitted
    return { format: 'shadow', raw: line, fields: shadowFields(parts) };
  }
  return {
    format: 'unknown',
    raw: line,
    fields: [],
    error: `Expected 7 fields (passwd) or 9 fields (shadow); found ${parts.length}.`,
  };
}

const SAMPLE = [
  'root:x:0:0:root:/root:/bin/bash',
  'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
  'alice:$6$rounds=5000$abcd1234$Xy9...hashbytes...:19500:0:99999:7:::',
].join('\n');

export default function PasswdShadowParser() {
  const [input, setInput] = useState('');

  const parsed = useMemo<ParsedLine[]>(() => {
    return input
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))
      .map(parseLine);
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="passwd / shadow lines" className="flex-1">
          <span className="text-2xs text-muted-foreground">
            Format is auto-detected by field count: 7 = passwd, 8–9 = shadow.
          </span>
        </Field>
        <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
          Sample
        </Button>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Input lines" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="root:x:0:0:root:/root:/bin/bash"
          spellCheck={false}
          className="min-h-28 rounded-none border-0 font-mono text-xs"
        />
      </Panel>

      {parsed.map((p, idx) => (
        <Panel key={`${p.raw}-${idx}`}>
          <PanelHeader
            title={`${p.format === 'unknown' ? 'Unrecognized line' : `${p.format} entry`}${
              p.fields[0]?.value ? ` — ${p.fields[0].value}` : ''
            }`}
          />
          {p.error ? (
            <div className="px-3 py-2 font-mono text-xs text-destructive">{p.error}: <span className="break-all">{p.raw}</span></div>
          ) : (
            <div className="divide-y">
              {p.fields.map((f) => (
                <div key={f.label} className="flex items-start gap-3 px-3 py-1.5">
                  <span className="w-36 shrink-0 text-xs text-muted-foreground">{f.label}</span>
                  <code className="min-w-0 flex-1 break-all font-mono text-xs">
                    {f.value === '' ? <span className="text-muted-foreground">(empty)</span> : f.value}
                  </code>
                  {f.note && <span className="w-56 shrink-0 text-2xs text-muted-foreground">{f.note}</span>}
                </div>
              ))}
            </div>
          )}
        </Panel>
      ))}

      {input.trim() && (
        <StatBar items={[`${parsed.length} line${parsed.length === 1 ? '' : 's'} parsed`, 'parsing only — not validated against any system']} />
      )}
    </div>
  );
}
