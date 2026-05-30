'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Dialect = 'unix' | 'quartz' | 'spring';

const DIALECT_LABEL: Record<Dialect, string> = {
  unix: 'Unix (5 fields)',
  quartz: 'Quartz (6-7 fields)',
  spring: 'Spring (6 fields)',
};

const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

interface Parsed {
  second: string;
  minute: string;
  hour: string;
  dom: string;
  month: string;
  dow: string;
  year: string | null;
}

/** Split into fields and slot them per the source dialect. */
function parse(expr: string, dialect: Dialect): Parsed {
  const fields = expr.trim().split(/\s+/).filter((f) => f.length > 0);
  if (dialect === 'unix') {
    if (fields.length !== 5) {
      throw new Error(`Unix cron needs 5 fields; got ${fields.length}.`);
    }
    return {
      second: '0',
      minute: fields[0] ?? '*',
      hour: fields[1] ?? '*',
      dom: fields[2] ?? '*',
      month: fields[3] ?? '*',
      dow: fields[4] ?? '*',
      year: null,
    };
  }
  if (dialect === 'spring') {
    if (fields.length !== 6) {
      throw new Error(`Spring cron needs 6 fields; got ${fields.length}.`);
    }
    return {
      second: fields[0] ?? '0',
      minute: fields[1] ?? '*',
      hour: fields[2] ?? '*',
      dom: fields[3] ?? '*',
      month: fields[4] ?? '*',
      dow: fields[5] ?? '*',
      year: null,
    };
  }
  // quartz: 6 or 7 fields
  if (fields.length !== 6 && fields.length !== 7) {
    throw new Error(`Quartz cron needs 6 or 7 fields; got ${fields.length}.`);
  }
  return {
    second: fields[0] ?? '0',
    minute: fields[1] ?? '*',
    hour: fields[2] ?? '*',
    dom: fields[3] ?? '*',
    month: fields[4] ?? '*',
    dow: fields[5] ?? '?',
    year: fields[6] ?? null,
  };
}

/** Unix DOW: 0-6 (0=Sun). Quartz/Spring DOW: 1-7 (1=Sun). Convert a single token. */
function shiftDowToken(token: string, toQuartz: boolean): string {
  if (token === '*' || token === '?') return token;
  return token.replace(/\d+/g, (numStr) => {
    const n = Number(numStr);
    if (!Number.isFinite(n)) return numStr;
    if (toQuartz) {
      // unix 0-6 -> quartz 1-7
      return String(n === 7 ? 1 : n + 1);
    }
    // quartz 1-7 -> unix 0-6
    return String(n === 7 ? 6 : n - 1);
  });
}

function buildOutput(p: Parsed, target: Dialect, warnings: string[]): string {
  if (target === 'unix') {
    const dow = shiftDowToken(p.dow === '?' ? '*' : p.dow, false);
    const dom = p.dom === '?' ? '*' : p.dom;
    if (p.second !== '0' && p.second !== '*') {
      warnings.push(`Seconds field "${p.second}" cannot be represented in Unix cron and was dropped.`);
    }
    if (p.year) warnings.push(`Year field "${p.year}" is not supported in Unix cron and was dropped.`);
    return [p.minute, p.hour, dom, p.month, dow].join(' ');
  }
  if (target === 'spring') {
    const dow = shiftDowToken(p.dow === '?' ? '*' : p.dow, true);
    const dom = p.dom === '?' ? '*' : p.dom;
    if (p.year) warnings.push(`Year field "${p.year}" is not supported in Spring cron and was dropped.`);
    return [p.second, p.minute, p.hour, dom, p.month, dow].join(' ');
  }
  // quartz: DOM and DOW are mutually exclusive — one must be '?'
  let dom = p.dom;
  let dow = shiftDowToken(p.dow, true);
  if (dom !== '?' && dom !== '*' && dow !== '?' && dow !== '*') {
    warnings.push('Quartz cannot specify both day-of-month and day-of-week; set day-of-week to "?".');
    dow = '?';
  } else if (dow !== '?' && dow !== '*') {
    dom = '?';
  } else if (dom !== '?' && dom !== '*') {
    dow = '?';
  } else {
    // both wildcards: Quartz needs exactly one '?'
    dow = '?';
  }
  const base = [p.second, p.minute, p.hour, dom, p.month, dow];
  if (p.year) base.push(p.year);
  return base.join(' ');
}

/** Plain-English single-token describer for the summary. */
function describeField(token: string, kind: 'second' | 'minute' | 'hour' | 'dom' | 'month' | 'dow'): string {
  if (token === '*' || token === '?') {
    switch (kind) {
      case 'second': return 'every second';
      case 'minute': return 'every minute';
      case 'hour': return 'every hour';
      case 'dom': return 'every day';
      case 'month': return 'every month';
      case 'dow': return 'every weekday';
      default: return 'any';
    }
  }
  const step = /^\*\/(\d+)$/.exec(token);
  if (step && step[1]) return `every ${step[1]} ${kind === 'dom' ? 'days' : kind + 's'}`;
  if (kind === 'month') {
    return token.replace(/\d+/g, (n) => MONTH_NAMES[Number(n) - 1] ?? n);
  }
  if (kind === 'dow') {
    return token.replace(/\d+/g, (n) => DOW_NAMES[Number(n) % 7] ?? n);
  }
  return token;
}

function summarize(p: Parsed): string {
  const time =
    p.minute !== '*' && p.hour !== '*' && !p.minute.includes('/') && !p.hour.includes('/')
      ? `at ${p.hour.padStart(2, '0')}:${p.minute.padStart(2, '0')}`
      : `${describeField(p.minute, 'minute')}, ${describeField(p.hour, 'hour')}`;
  const parts = [
    p.second !== '0' && p.second !== '*' ? `second ${p.second}` : null,
    time,
    `on ${describeField(p.dom, 'dom')}`,
    `in ${describeField(p.month, 'month')}`,
    p.dow !== '*' && p.dow !== '?' ? `on ${describeField(p.dow, 'dow')}` : null,
    p.year ? `during year(s) ${p.year}` : null,
  ].filter((x): x is string => Boolean(x));
  return parts.join(', ');
}

export default function CronDialectTranslator() {
  const [source, setSource] = useState<Dialect>('unix');
  const [target, setTarget] = useState<Dialect>('quartz');

  return (
    <TextToolLayout
      deps={[source, target]}
      sample="30 2 1 * *"
      inputLabel={`Source — ${DIALECT_LABEL[source]}`}
      outputLabel={`Target — ${DIALECT_LABEL[target]}`}
      downloadName="cron.txt"
      transform={(input) => {
        if (!input.trim()) return '';
        const firstLine = input.split('\n').find((l) => l.trim().length > 0) ?? '';
        const parsed = parse(firstLine, source);
        const warnings: string[] = [];
        const converted = buildOutput(parsed, target, warnings);
        const lines: string[] = [];
        lines.push(converted);
        lines.push('');
        lines.push(`# ${DIALECT_LABEL[target]}`);
        lines.push(`# Summary: ${summarize(parsed)}`);
        if (warnings.length > 0) {
          lines.push('#');
          lines.push('# Warnings:');
          warnings.forEach((w) => lines.push(`#   - ${w}`));
        }
        return lines.join('\n');
      }}
      options={
        <>
          <Field label="Source dialect">
            <Select value={source} onValueChange={(v) => setSource(v as Dialect)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DIALECT_LABEL) as Dialect[]).map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIALECT_LABEL[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target dialect">
            <Select value={target} onValueChange={(v) => setTarget(v as Dialect)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(DIALECT_LABEL) as Dialect[]).map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIALECT_LABEL[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
