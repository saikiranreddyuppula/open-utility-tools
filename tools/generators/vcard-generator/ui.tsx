'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Version = '3.0' | '4.0';
type TelType = 'CELL' | 'WORK' | 'HOME' | 'FAX';
type EmailType = 'WORK' | 'HOME' | 'INTERNET';

interface TelRow {
  type: TelType;
  value: string;
}
interface EmailRow {
  type: EmailType;
  value: string;
}

/** Escape per RFC 6350: backslash, comma, semicolon, newline. */
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Fold a content line at 75 octets (UTF-8) with leading space continuation, CRLF joined. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;
  const dec = new TextDecoder();
  const out: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    // Avoid splitting a UTF-8 multibyte sequence: back off until a lead byte.
    let end = Math.min(start + limit, bytes.length);
    while (end < bytes.length && (bytes[end] ?? 0) >= 0x80 && (bytes[end] ?? 0) < 0xc0) {
      end -= 1;
    }
    out.push(dec.decode(bytes.slice(start, end)));
    start = end;
    limit = 74; // continuation lines start with a space, leaving 74 octets
  }
  return out.join('\r\n ');
}

export default function VcardGenerator() {
  const [version, setVersion] = useState<Version>('3.0');
  const [fullName, setFullName] = useState('Jane Q. Doe');
  const [last, setLast] = useState('Doe');
  const [first, setFirst] = useState('Jane');
  const [middle, setMiddle] = useState('Q.');
  const [prefix, setPrefix] = useState('Dr.');
  const [suffix, setSuffix] = useState('');
  const [org, setOrg] = useState('Acme, Inc.');
  const [title, setTitle] = useState('Engineer');
  const [tels, setTels] = useState<TelRow[]>([{ type: 'CELL', value: '+1-555-0100' }]);
  const [emails, setEmails] = useState<EmailRow[]>([{ type: 'WORK', value: 'jane@example.com' }]);
  const [street, setStreet] = useState('123 Main St');
  const [city, setCity] = useState('Springfield');
  const [region, setRegion] = useState('IL');
  const [postal, setPostal] = useState('62704');
  const [country, setCountry] = useState('USA');
  const [url, setUrl] = useState('https://example.com');
  const [note, setNote] = useState('');
  const [bday, setBday] = useState('');

  const vcf = useMemo(() => {
    const lines: string[] = [];
    lines.push('BEGIN:VCARD');
    lines.push(`VERSION:${version}`);

    const nParts = [last, first, middle, prefix, suffix].map(esc).join(';');
    lines.push(`N:${nParts}`);
    const fn = fullName.trim() || [prefix, first, middle, last, suffix].filter((p) => p.trim()).join(' ');
    lines.push(`FN:${esc(fn)}`);

    if (org.trim()) lines.push(`ORG:${esc(org)}`);
    if (title.trim()) lines.push(`TITLE:${esc(title)}`);

    for (const t of tels) {
      if (!t.value.trim()) continue;
      if (version === '4.0') {
        const tel = t.value.trim().startsWith('tel:') ? t.value.trim() : `tel:${t.value.trim()}`;
        lines.push(`TEL;TYPE=${t.type.toLowerCase()};VALUE=uri:${esc(tel)}`);
      } else {
        lines.push(`TEL;TYPE=${t.type}:${esc(t.value.trim())}`);
      }
    }
    for (const e of emails) {
      if (!e.value.trim()) continue;
      lines.push(`EMAIL;TYPE=${version === '4.0' ? e.type.toLowerCase() : e.type}:${esc(e.value.trim())}`);
    }

    const adrParts = ['', '', street, city, region, postal, country].map(esc).join(';');
    if (street.trim() || city.trim() || region.trim() || postal.trim() || country.trim()) {
      lines.push(`ADR;TYPE=${version === '4.0' ? 'home' : 'HOME'}:${adrParts}`);
    }

    if (url.trim()) lines.push(`URL:${esc(url.trim())}`);
    if (bday.trim()) lines.push(`BDAY:${esc(bday.trim())}`);
    if (note.trim()) lines.push(`NOTE:${esc(note)}`);

    lines.push('END:VCARD');
    return lines.map(fold).join('\r\n');
  }, [
    version, fullName, last, first, middle, prefix, suffix, org, title,
    tels, emails, street, city, region, postal, country, url, note, bday,
  ]);

  const addTel = () => setTels([...tels, { type: 'WORK', value: '' }]);
  const addEmail = () => setEmails([...emails, { type: 'HOME', value: '' }]);
  const display = vcf.replace(/\r\n/g, '\n');

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Contact fields" />
        <OptionsBar>
          <Field label="Version">
            <Tabs value={version} onValueChange={(v) => setVersion(v as Version)}>
              <TabsList>
                <TabsTrigger value="3.0">vCard 3.0</TabsTrigger>
                <TabsTrigger value="4.0">vCard 4.0</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <Field label="Formatted name (FN)">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <OptionsBar>
          <Field label="Prefix">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-24" />
          </Field>
          <Field label="First">
            <Input value={first} onChange={(e) => setFirst(e.target.value)} className="w-28" />
          </Field>
          <Field label="Middle">
            <Input value={middle} onChange={(e) => setMiddle(e.target.value)} className="w-24" />
          </Field>
          <Field label="Last">
            <Input value={last} onChange={(e) => setLast(e.target.value)} className="w-28" />
          </Field>
          <Field label="Suffix">
            <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="w-24" />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="Organization">
            <Input value={org} onChange={(e) => setOrg(e.target.value)} />
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </OptionsBar>

        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Phones</span>
            <Button variant="outline" size="sm" onClick={addTel}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
          {tels.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={t.type}
                onValueChange={(v) =>
                  setTels(tels.map((row, idx) => (idx === i ? { ...row, type: v as TelType } : row)))
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CELL">Cell</SelectItem>
                  <SelectItem value="WORK">Work</SelectItem>
                  <SelectItem value="HOME">Home</SelectItem>
                  <SelectItem value="FAX">Fax</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={t.value}
                onChange={(e) =>
                  setTels(tels.map((row, idx) => (idx === i ? { ...row, value: e.target.value } : row)))
                }
                placeholder="+1-555-0100"
                className="font-mono"
              />
              <Button variant="ghost" size="icon-sm" onClick={() => setTels(tels.filter((_, idx) => idx !== i))}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Emails</span>
            <Button variant="outline" size="sm" onClick={addEmail}>
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
          {emails.map((em, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={em.type}
                onValueChange={(v) =>
                  setEmails(emails.map((row, idx) => (idx === i ? { ...row, type: v as EmailType } : row)))
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORK">Work</SelectItem>
                  <SelectItem value="HOME">Home</SelectItem>
                  <SelectItem value="INTERNET">Internet</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={em.value}
                onChange={(e) =>
                  setEmails(emails.map((row, idx) => (idx === i ? { ...row, value: e.target.value } : row)))
                }
                placeholder="name@example.com"
                className="font-mono"
              />
              <Button variant="ghost" size="icon-sm" onClick={() => setEmails(emails.filter((_, idx) => idx !== i))}>
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <OptionsBar>
          <Field label="Street">
            <Input value={street} onChange={(e) => setStreet(e.target.value)} />
          </Field>
          <Field label="City">
            <Input value={city} onChange={(e) => setCity(e.target.value)} className="w-32" />
          </Field>
          <Field label="Region">
            <Input value={region} onChange={(e) => setRegion(e.target.value)} className="w-24" />
          </Field>
          <Field label="Postal">
            <Input value={postal} onChange={(e) => setPostal(e.target.value)} className="w-24" />
          </Field>
          <Field label="Country">
            <Input value={country} onChange={(e) => setCountry(e.target.value)} className="w-28" />
          </Field>
        </OptionsBar>
        <OptionsBar>
          <Field label="URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Birthday (YYYY-MM-DD)">
            <Input value={bday} onChange={(e) => setBday(e.target.value)} placeholder="1990-05-30" className="w-40 font-mono" />
          </Field>
        </OptionsBar>
        <Field label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
      </Panel>

      <Panel>
        <PanelHeader title="vCard (.vcf)">
          <CopyButton value={() => vcf} />
          <DownloadButton data={() => vcf} filename="contact.vcf" />
        </PanelHeader>
        <pre className="max-h-[360px] overflow-auto p-3 font-mono text-xs">{display}</pre>
        <StatBar items={[`vCard ${version}`, `${display.split('\n').length} lines`, 'CRLF, folded at 75 octets']} />
      </Panel>
    </div>
  );
}
