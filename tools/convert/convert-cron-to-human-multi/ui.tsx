'use client';

import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `# m h dom mon dow command
30 2 * * 1 /usr/bin/backup.sh
*/15 * * * * curl -s https://example.com/ping
0 0 1 * * /opt/report.sh
@reboot /opt/startup.sh
@daily logrotate /etc/logrotate.conf
0 9-17 * * 1-5 echo "business hours"`;

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_TOKENS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};
const MONTH_TOKENS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const MACROS: Record<string, string> = {
  '@reboot': 'at system startup',
  '@yearly': 'at 00:00 on January 1st',
  '@annually': 'at 00:00 on January 1st',
  '@monthly': 'at 00:00 on the 1st of every month',
  '@weekly': 'at 00:00 every Sunday',
  '@daily': 'at 00:00 every day',
  '@midnight': 'at 00:00 every day',
  '@hourly': 'at minute 0 of every hour',
};

type FieldKind = 'minute' | 'hour' | 'dom' | 'month' | 'dow';

function nameFor(kind: FieldKind, n: number): string {
  if (kind === 'dow') return DOW_NAMES[n % 7] ?? String(n);
  if (kind === 'month') return MONTH_NAMES[n - 1] ?? String(n);
  return String(n);
}

function normalizeToken(kind: FieldKind, tok: string): string {
  const low = tok.toLowerCase();
  if (kind === 'dow' && DOW_TOKENS[low] !== undefined) return String(DOW_TOKENS[low]);
  if (kind === 'month' && MONTH_TOKENS[low] !== undefined) return String(MONTH_TOKENS[low]);
  return tok;
}

/** Describe a single cron field token (handles *, lists, ranges, steps, names). */
function describeField(kind: FieldKind, raw: string): string {
  const parts = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  const pieces: string[] = [];
  for (const part of parts) {
    const stepMatch = /^(.+)\/(\d+)$/.exec(part);
    if (stepMatch && stepMatch[1] !== undefined && stepMatch[2] !== undefined) {
      const base = stepMatch[1];
      const step = stepMatch[2];
      if (base === '*') {
        pieces.push(`every ${step} ${unit(kind)}`);
      } else {
        const rangeM = /^(\S+)-(\S+)$/.exec(base);
        if (rangeM && rangeM[1] !== undefined && rangeM[2] !== undefined) {
          const a = normalizeToken(kind, rangeM[1]);
          const b = normalizeToken(kind, rangeM[2]);
          pieces.push(`every ${step} ${unit(kind)} from ${labelNum(kind, a)} to ${labelNum(kind, b)}`);
        } else {
          pieces.push(`every ${step} ${unit(kind)} starting at ${labelNum(kind, normalizeToken(kind, base))}`);
        }
      }
      continue;
    }
    const rangeM = /^(\S+)-(\S+)$/.exec(part);
    if (rangeM && rangeM[1] !== undefined && rangeM[2] !== undefined) {
      const a = normalizeToken(kind, rangeM[1]);
      const b = normalizeToken(kind, rangeM[2]);
      pieces.push(`${labelNum(kind, a)} through ${labelNum(kind, b)}`);
      continue;
    }
    if (part === '*') {
      pieces.push(everyLabel(kind));
      continue;
    }
    pieces.push(labelNum(kind, normalizeToken(kind, part)));
  }
  return pieces.join(', ');
}

function unit(kind: FieldKind): string {
  switch (kind) {
    case 'minute': return 'minutes';
    case 'hour': return 'hours';
    case 'dom': return 'days';
    case 'month': return 'months';
    case 'dow': return 'days of the week';
    default: return 'units';
  }
}

function everyLabel(kind: FieldKind): string {
  switch (kind) {
    case 'minute': return 'every minute';
    case 'hour': return 'every hour';
    case 'dom': return 'every day';
    case 'month': return 'every month';
    case 'dow': return 'every day of the week';
    default: return 'any';
  }
}

function labelNum(kind: FieldKind, tok: string): string {
  const n = Number(tok);
  if (!Number.isFinite(n)) return tok;
  switch (kind) {
    case 'minute': return `minute ${n}`;
    case 'hour': return `hour ${n}`;
    case 'dom': return `day ${n}`;
    case 'month': return nameFor('month', n);
    case 'dow': return nameFor('dow', n);
    default: return String(n);
  }
}

function explainSchedule(min: string, hour: string, dom: string, month: string, dow: string): string {
  // Common case: exact minute + hour.
  const exactTime =
    /^\d+$/.test(min) && /^\d+$/.test(hour)
      ? `at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
      : `${describeField('minute', min)}, ${describeField('hour', hour)}`;

  const parts = [exactTime];
  if (dom !== '*' || dow !== '*') {
    if (dom !== '*') parts.push(`on ${describeField('dom', dom)}`);
    if (dow !== '*') parts.push(`on ${describeField('dow', dow)}`);
  } else {
    parts.push('every day');
  }
  if (month !== '*') parts.push(`in ${describeField('month', month)}`);
  return parts.join(', ');
}

function explainLine(line: string): string {
  const trimmed = line.trim();
  const macroMatch = /^(@\w+)\s*(.*)$/.exec(trimmed);
  if (macroMatch && macroMatch[1] !== undefined) {
    const macro = macroMatch[1].toLowerCase();
    const cmd = (macroMatch[2] ?? '').trim();
    const when = MACROS[macro];
    if (when) {
      return cmd ? `Run \`${cmd}\` ${when}.` : `${when}.`;
    }
    return `Unknown macro "${macro}".`;
  }

  const fields = trimmed.split(/\s+/);
  if (fields.length < 5) {
    return `Not enough fields (need 5 schedule fields + command).`;
  }
  const min = fields[0] ?? '*';
  const hour = fields[1] ?? '*';
  const dom = fields[2] ?? '*';
  const month = fields[3] ?? '*';
  const dow = fields[4] ?? '*';
  const cmd = fields.slice(5).join(' ').trim();
  const when = explainSchedule(min, hour, dom, month, dow);
  const sentence = when.charAt(0).toUpperCase() + when.slice(1);
  return cmd ? `${sentence}, run \`${cmd}\`.` : `${sentence}.`;
}

export default function CrontabExplainer() {
  return (
    <TextToolLayout
      sample={SAMPLE}
      inputLabel="Crontab"
      outputLabel="Explanation"
      downloadName="crontab-explained.txt"
      mono={false}
      transform={(input) => {
        if (!input.trim()) return '';
        const out: string[] = [];
        const lines = input.replace(/\r\n?/g, '\n').split('\n');
        for (const line of lines) {
          const t = line.trim();
          if (t === '') continue;
          if (t.startsWith('#')) {
            out.push(`# (comment) ${t.replace(/^#+\s*/, '')}`);
            continue;
          }
          // Environment assignment like SHELL=/bin/sh
          if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(t) && !/\s/.test(t.split('=')[0] ?? '')) {
            out.push(`(env) ${t}`);
            continue;
          }
          out.push(explainLine(t));
        }
        return out.join('\n');
      }}
    />
  );
}
