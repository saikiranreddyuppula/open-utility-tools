'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Style = 'long' | 'short' | 'narrow';

const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'week', seconds: 604800 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
];

function parseInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Pure integer: treat as unix timestamp. 10 digits = seconds, 13 = ms.
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    const ms = trimmed.replace('-', '').length <= 10 ? n * 1000 : n;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function RelativeTimeFormatter() {
  const [locale, setLocale] = useState<string>('en');
  const [style, setStyle] = useState<Style>('long');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const date = parseInput(input);
      if (!date) {
        throw new Error(
          'Could not parse the date. Try an ISO date (2024-01-15T10:30:00Z) or a unix timestamp.'
        );
      }

      let rtf: Intl.RelativeTimeFormat;
      try {
        rtf = new Intl.RelativeTimeFormat(locale || 'en', { numeric: 'auto', style });
      } catch {
        throw new Error(`Invalid locale: "${locale}". Try "en", "fr", "es", "de", "ja".`);
      }

      const now = Date.now();
      const diffSeconds = (date.getTime() - now) / 1000;
      const absSeconds = Math.abs(diffSeconds);

      let chosen = UNITS[UNITS.length - 1] ?? { unit: 'second' as const, seconds: 1 };
      for (const u of UNITS) {
        if (absSeconds >= u.seconds) {
          chosen = u;
          break;
        }
      }

      const value = Math.round(diffSeconds / chosen.seconds);
      const phrase = rtf.format(value, chosen.unit);

      const lines = [
        phrase,
        '',
        `Parsed date: ${date.toISOString()}`,
        `Local time:  ${date.toLocaleString(locale || 'en')}`,
        `Unix (s):    ${Math.floor(date.getTime() / 1000)}`,
        `Difference:  ${value} ${chosen.unit}${Math.abs(value) === 1 ? '' : 's'} (${
          diffSeconds >= 0 ? 'future' : 'past'
        })`,
      ];
      return lines.join('\n');
    },
    [locale, style]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[locale, style]}
      inputLabel="Date or timestamp"
      outputLabel="Relative time"
      inputPlaceholder="2024-01-15T10:30:00Z or 1705312200"
      sample="2024-01-15T10:30:00Z"
      downloadName="relative-time.txt"
      options={
        <>
          <Field label="Locale" hint="BCP 47 tag, e.g. en, fr, ja">
            <Input
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="en"
              className="w-28"
            />
          </Field>
          <Field label="Style">
            <Tabs value={style} onValueChange={(v) => setStyle(v as Style)}>
              <TabsList>
                <TabsTrigger value="long">Long</TabsTrigger>
                <TabsTrigger value="short">Short</TabsTrigger>
                <TabsTrigger value="narrow">Narrow</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
