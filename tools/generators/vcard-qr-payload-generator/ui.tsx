'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Format = 'mecard' | 'vcard';

interface CapRow {
  version: string;
  modules: string;
  alnum: string;
  byte: string;
}

// Approximate capacities (error-correction level L) for selected QR versions.
const CAP_TABLE: CapRow[] = [
  { version: '2', modules: '25×25', alnum: '47', byte: '32' },
  { version: '4', modules: '33×33', alnum: '114', byte: '78' },
  { version: '6', modules: '41×41', alnum: '195', byte: '134' },
  { version: '8', modules: '49×49', alnum: '293', byte: '202' },
  { version: '10', modules: '57×57', alnum: '395', byte: '271' },
  { version: '15', modules: '77×77', alnum: '758', byte: '520' },
];

/** Escape for MECARD: backslash, semicolon, colon, comma. */
function escMecard(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,');
}

/** Escape for vCard text values per RFC 6350. */
function escVcard(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function splitLines(s: string): string[] {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export default function VcardQrPayloadGenerator() {
  const [format, setFormat] = useState<Format>('mecard');
  const [last, setLast] = useState('Doe');
  const [first, setFirst] = useState('Jane');
  const [phones, setPhones] = useState('+15550100');
  const [emailsRaw, setEmailsRaw] = useState('jane@example.com');
  const [address, setAddress] = useState('123 Main St, Springfield, IL 62704');
  const [url, setUrl] = useState('https://example.com');
  const [note, setNote] = useState('');

  const payload = useMemo(() => {
    const phoneList = splitLines(phones);
    const emailList = splitLines(emailsRaw);

    if (format === 'mecard') {
      const parts: string[] = [];
      if (last.trim() || first.trim()) {
        parts.push(`N:${escMecard(last.trim())},${escMecard(first.trim())}`);
      }
      for (const p of phoneList) parts.push(`TEL:${escMecard(p)}`);
      for (const e of emailList) parts.push(`EMAIL:${escMecard(e)}`);
      if (address.trim()) parts.push(`ADR:${escMecard(address.trim())}`);
      if (url.trim()) parts.push(`URL:${escMecard(url.trim())}`);
      if (note.trim()) parts.push(`NOTE:${escMecard(note.trim())}`);
      return `MECARD:${parts.join(';')};;`;
    }

    // Minimal inline vCard (3.0) — uses literal \n line breaks so it is one scannable string.
    const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
    lines.push(`N:${escVcard(last.trim())};${escVcard(first.trim())};;;`);
    const fn = [first.trim(), last.trim()].filter((x) => x).join(' ');
    if (fn) lines.push(`FN:${escVcard(fn)}`);
    for (const p of phoneList) lines.push(`TEL:${escVcard(p)}`);
    for (const e of emailList) lines.push(`EMAIL:${escVcard(e)}`);
    if (address.trim()) lines.push(`ADR:;;${escVcard(address.trim())};;;;`);
    if (url.trim()) lines.push(`URL:${escVcard(url.trim())}`);
    if (note.trim()) lines.push(`NOTE:${escVcard(note.trim())}`);
    lines.push('END:VCARD');
    return lines.join('\n');
  }, [format, last, first, phones, emailsRaw, address, url, note]);

  const byteLen = useMemo(() => new TextEncoder().encode(payload).length, [payload]);
  const charLen = payload.length;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Contact fields" />
        <OptionsBar>
          <Field label="Format">
            <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
              <TabsList>
                <TabsTrigger value="mecard">MECARD (shortest)</TabsTrigger>
                <TabsTrigger value="vcard">vCard (inline)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="First name">
            <Input value={first} onChange={(e) => setFirst(e.target.value)} className="w-36" />
          </Field>
          <Field label="Last name">
            <Input value={last} onChange={(e) => setLast(e.target.value)} className="w-36" />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="Phones (one per line)" className="min-w-[200px] flex-1">
            <Textarea value={phones} onChange={(e) => setPhones(e.target.value)} rows={2} className="font-mono text-sm" />
          </Field>
          <Field label="Emails (one per line)" className="min-w-[200px] flex-1">
            <Textarea value={emailsRaw} onChange={(e) => setEmailsRaw(e.target.value)} rows={2} className="font-mono text-sm" />
          </Field>
        </OptionsBar>
        <Field label="Address">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <OptionsBar>
          <Field label="URL" className="min-w-[200px] flex-1">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Note" className="min-w-[200px] flex-1">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="QR payload string">
          <CopyButton value={() => payload} />
        </PanelHeader>
        <pre className="max-h-[240px] overflow-auto break-all whitespace-pre-wrap p-3 font-mono text-xs">{payload}</pre>
        <StatBar items={[`${charLen} chars`, `${byteLen} bytes (UTF-8)`, format === 'mecard' ? 'MECARD' : 'vCard 3.0']} />
      </Panel>

      <Panel>
        <PanelHeader title="QR capacity hint (ECC level L)" />
        <div className="max-h-[280px] divide-y overflow-auto">
          <div className="flex items-center gap-3 px-3 py-1.5 text-2xs font-medium text-muted-foreground">
            <span className="w-16 shrink-0">Version</span>
            <span className="w-20 shrink-0">Modules</span>
            <span className="w-24 shrink-0">Alphanumeric</span>
            <span className="w-24 shrink-0">Byte mode</span>
            <span className="flex-1">Fits this payload?</span>
          </div>
          {CAP_TABLE.map((r) => {
            const cap = Number.parseInt(r.byte, 10);
            const fits = Number.isFinite(cap) && byteLen <= cap;
            return (
              <div key={r.version} className="flex items-center gap-3 px-3 py-1.5 font-mono text-xs">
                <span className="w-16 shrink-0">{r.version}</span>
                <span className="w-20 shrink-0">{r.modules}</span>
                <span className="w-24 shrink-0">{r.alnum}</span>
                <span className="w-24 shrink-0">{r.byte}</span>
                <span className={fits ? 'flex-1 text-emerald-500' : 'flex-1 text-muted-foreground'}>
                  {fits ? 'yes' : 'no'}
                </span>
              </div>
            );
          })}
        </div>
        <StatBar items={['Capacities are approximate; lower ECC levels store more.']} />
      </Panel>
    </div>
  );
}
