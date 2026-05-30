'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Mode = 'preset' | 'ldml';
type Style = 'full' | 'long' | 'medium' | 'short';

const LOCALES: { code: string; label: string }[] = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'nl-NL', label: 'Dutch' },
  { code: 'sv-SE', label: 'Swedish' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'ar-SA', label: 'Arabic' },
  { code: 'hi-IN', label: 'Hindi' },
];

function pad(n: number, w = 2): string {
  return Math.abs(n).toString().padStart(w, '0');
}

function defaultDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Render an LDML-ish pattern using Intl parts for locale-aware names.
function renderLdml(pattern: string, date: Date, locale: string): string {
  const lookup = (opts: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat(locale, opts).format(date);
    } catch {
      return '';
    }
  };
  const tokens: { tok: string; fn: () => string }[] = [
    { tok: 'yyyy', fn: () => pad(date.getFullYear(), 4) },
    { tok: 'yy', fn: () => pad(date.getFullYear() % 100) },
    { tok: 'MMMM', fn: () => lookup({ month: 'long' }) },
    { tok: 'MMM', fn: () => lookup({ month: 'short' }) },
    { tok: 'MM', fn: () => pad(date.getMonth() + 1) },
    { tok: 'M', fn: () => (date.getMonth() + 1).toString() },
    { tok: 'dd', fn: () => pad(date.getDate()) },
    { tok: 'd', fn: () => date.getDate().toString() },
    { tok: 'EEEE', fn: () => lookup({ weekday: 'long' }) },
    { tok: 'EEE', fn: () => lookup({ weekday: 'short' }) },
    { tok: 'HH', fn: () => pad(date.getHours()) },
    { tok: 'H', fn: () => date.getHours().toString() },
    { tok: 'hh', fn: () => pad(((date.getHours() + 11) % 12) + 1) },
    { tok: 'h', fn: () => (((date.getHours() + 11) % 12) + 1).toString() },
    { tok: 'mm', fn: () => pad(date.getMinutes()) },
    { tok: 'm', fn: () => date.getMinutes().toString() },
    { tok: 'ss', fn: () => pad(date.getSeconds()) },
    { tok: 's', fn: () => date.getSeconds().toString() },
    { tok: 'a', fn: () => (date.getHours() < 12 ? 'AM' : 'PM') },
  ];

  let out = '';
  let i = 0;
  while (i < pattern.length) {
    // literal text between single quotes
    if (pattern[i] === "'") {
      const end = pattern.indexOf("'", i + 1);
      if (end < 0) {
        out += pattern.slice(i + 1);
        break;
      }
      const lit = pattern.slice(i + 1, end);
      out += lit === '' ? "'" : lit;
      i = end + 1;
      continue;
    }
    let matched = false;
    for (const { tok, fn } of tokens) {
      if (pattern.startsWith(tok, i)) {
        out += fn();
        i += tok.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += pattern[i] ?? '';
      i++;
    }
  }
  return out;
}

interface Result {
  output: string;
  resolved: string;
}

function compute(
  dateStr: string,
  locale: string,
  mode: Mode,
  dateStyle: Style,
  timeStyle: Style,
  pattern: string,
): Result | { error: string } {
  const ms = Date.parse(dateStr);
  if (!Number.isFinite(ms)) return { error: 'Enter a valid datetime.' };
  const date = new Date(ms);

  if (mode === 'preset') {
    try {
      const opts: Intl.DateTimeFormatOptions = { dateStyle, timeStyle };
      const fmt = new Intl.DateTimeFormat(locale, opts);
      const resolvedOpts = fmt.resolvedOptions();
      const resolved = `locale=${resolvedOpts.locale}, calendar=${resolvedOpts.calendar}, numberingSystem=${resolvedOpts.numberingSystem}, dateStyle=${dateStyle}, timeStyle=${timeStyle}`;
      return { output: fmt.format(date), resolved };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Formatting failed.' };
    }
  }

  if (!pattern.trim()) return { error: 'Enter an LDML pattern (e.g. EEEE, dd MMM yyyy HH:mm).' };
  const output = renderLdml(pattern, date, locale);
  return { output, resolved: `locale=${locale}, pattern="${pattern}"` };
}

export default function DateFormatPlayground() {
  const [dateStr, setDateStr] = useState(defaultDate());
  const [locale, setLocale] = useState('en-US');
  const [mode, setMode] = useState<Mode>('preset');
  const [dateStyle, setDateStyle] = useState<Style>('full');
  const [timeStyle, setTimeStyle] = useState<Style>('medium');
  const [pattern, setPattern] = useState('EEEE, dd MMM yyyy HH:mm:ss');

  const result = useMemo(
    () => compute(dateStr, locale, mode, dateStyle, timeStyle, pattern),
    [dateStr, locale, mode, dateStyle, timeStyle, pattern],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Datetime">
            <Input type="datetime-local" step={1} value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </Field>
          <Field label="Locale">
            <Select value={locale} onValueChange={(v) => setLocale(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label} ({l.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="preset">Intl preset</TabsTrigger>
                <TabsTrigger value="ldml">LDML pattern</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        {mode === 'preset' ? (
          <OptionsBar className="rounded-t-none border-t-0">
            <Field label="Date style">
              <Select value={dateStyle} onValueChange={(v) => setDateStyle(v as Style)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">full</SelectItem>
                  <SelectItem value="long">long</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="short">short</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Time style">
              <Select value={timeStyle} onValueChange={(v) => setTimeStyle(v as Style)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">full</SelectItem>
                  <SelectItem value="long">long</SelectItem>
                  <SelectItem value="medium">medium</SelectItem>
                  <SelectItem value="short">short</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>
        ) : (
          <OptionsBar className="rounded-t-none border-t-0">
            <Field label="LDML pattern" className="min-w-[280px] flex-1" hint="yyyy MM dd EEEE MMM HH mm ss h a — quote literals with ' '">
              <Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="font-mono" />
            </Field>
          </OptionsBar>
        )}
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Formatted">
            <CopyButton value={() => result.output} />
          </PanelHeader>
          <div className="p-4">
            <div className="break-words rounded-md border bg-muted/30 px-3 py-3 font-mono text-lg">{result.output}</div>
          </div>
          <StatBar items={[result.resolved]} />
        </Panel>
      )}
    </div>
  );
}
