'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type EntityType = 'email' | 'url' | 'phone' | 'ipv4' | 'number';

const PATTERNS: Record<EntityType, RegExp> = {
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  url: /\bhttps?:\/\/[^\s<>"')\]]+/gi,
  phone: /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{1,4}(?:[\s.-]?\d{2,4}){1,4}/g,
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  number: /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g,
};

const LABELS: Record<EntityType, string> = {
  email: 'Email addresses',
  url: 'URLs',
  phone: 'Phone numbers',
  ipv4: 'IPv4 addresses',
  number: 'Numbers',
};

export default function ExtractData() {
  const [text, setText] = useState('');
  const [type, setType] = useState<EntityType>('email');
  const [dedupe, setDedupe] = useState(true);
  const [sortResults, setSortResults] = useState(false);

  const { output, total, unique } = useMemo(() => {
    if (!text) return { output: '', total: 0, unique: 0 };
    const re = new RegExp(PATTERNS[type].source, PATTERNS[type].flags);
    const raw: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = (m[0] ?? '').trim();
      if (value) raw.push(value);
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
    let list = raw;
    if (dedupe) {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const item of raw) {
        if (!seen.has(item)) {
          seen.add(item);
          out.push(item);
        }
      }
      list = out;
    }
    if (sortResults) {
      list = [...list].sort((a, b) =>
        type === 'number'
          ? (Number(a.replace(/,/g, '')) || 0) - (Number(b.replace(/,/g, '')) || 0)
          : a.localeCompare(b),
      );
    }
    return { output: list.join('\n'), total: raw.length, unique: list.length };
  }, [text, type, dedupe, sortResults]);

  return (
    <Panel>
      <OptionsBar>
        <Field label="Extract">
          <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Emails</SelectItem>
              <SelectItem value="url">URLs</SelectItem>
              <SelectItem value="phone">Phone numbers</SelectItem>
              <SelectItem value="ipv4">IPv4 addresses</SelectItem>
              <SelectItem value="number">Numbers</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox id="dedupe" checked={dedupe} onCheckedChange={(v) => setDedupe(Boolean(v))} />
          <Label htmlFor="dedupe">Deduplicate</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="sort" checked={sortResults} onCheckedChange={(v) => setSortResults(Boolean(v))} />
          <Label htmlFor="sort">Sort</Label>
        </div>
      </OptionsBar>

      <Field label="Input text" className="w-full">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text containing emails, URLs, numbers…"
          className="min-h-[180px] font-mono text-sm"
        />
      </Field>

      <Panel>
        <PanelHeader title={LABELS[type]}>
          <div className="flex items-center gap-2">
            <CopyButton value={() => output} disabled={!output} />
            <DownloadButton data={() => output} filename="extracted.txt" disabled={!output} />
          </div>
        </PanelHeader>
        <Textarea
          value={output}
          readOnly
          placeholder="Matches appear here, one per line…"
          className="min-h-[180px] font-mono text-sm"
        />
        <StatBar
          items={[
            `${unique} ${dedupe ? 'unique ' : ''}result${unique === 1 ? '' : 's'}`,
            dedupe && total !== unique && `${total} total before dedupe`,
          ]}
        />
      </Panel>
    </Panel>
  );
}
