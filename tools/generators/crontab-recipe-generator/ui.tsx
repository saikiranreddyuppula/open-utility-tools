'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Preset = 'minute' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'reboot' | 'custom';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

interface Job {
  id: number;
  preset: Preset;
  hour: string; // for daily/weekly/monthly
  minute: string;
  dow: string; // weekly day-of-week 0-6
  dom: string; // monthly day-of-month 1-31
  custom: string;
  command: string;
  comment: string;
}

let nextId = 3;

function clampInt(s: string, min: number, max: number, fallback: number): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(n, max));
}

// Validate one field of a 5-field cron expression against a numeric range.
function validField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;
  return field.split(',').every((part) => {
    const [range, stepRaw] = part.split('/');
    if (stepRaw !== undefined) {
      const step = parseInt(stepRaw, 10);
      if (!Number.isFinite(step) || step <= 0) return false;
    }
    if (range === '*' || range === undefined) return true;
    const bounds = range.split('-');
    if (bounds.length === 1) {
      const v = parseInt(bounds[0] ?? '', 10);
      return Number.isFinite(v) && v >= min && v <= max;
    }
    if (bounds.length === 2) {
      const lo = parseInt(bounds[0] ?? '', 10);
      const hi = parseInt(bounds[1] ?? '', 10);
      return Number.isFinite(lo) && Number.isFinite(hi) && lo >= min && hi <= max && lo <= hi;
    }
    return false;
  });
}

function validateCron(expr: string): string | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return `Expected 5 fields, got ${fields.length}`;
  const specs: [number, number, string][] = [
    [0, 59, 'minute'],
    [0, 23, 'hour'],
    [1, 31, 'day-of-month'],
    [1, 12, 'month'],
    [0, 7, 'day-of-week'],
  ];
  for (let i = 0; i < 5; i++) {
    const spec = specs[i];
    const f = fields[i];
    if (!spec || f === undefined) return 'Invalid expression';
    if (!validField(f, spec[0], spec[1])) return `Bad ${spec[2]} field: "${f}"`;
  }
  return null;
}

function buildSchedule(j: Job): string {
  const m = clampInt(j.minute, 0, 59, 0);
  const h = clampInt(j.hour, 0, 23, 0);
  const dow = clampInt(j.dow, 0, 6, 1);
  const dom = clampInt(j.dom, 1, 31, 1);
  switch (j.preset) {
    case 'minute':
      return '* * * * *';
    case 'hourly':
      return `${m} * * * *`;
    case 'daily':
      return `${m} ${h} * * *`;
    case 'weekly':
      return `${m} ${h} * * ${dow}`;
    case 'monthly':
      return `${m} ${h} ${dom} * *`;
    case 'reboot':
      return '@reboot';
    case 'custom':
      return j.custom.trim() || '* * * * *';
    default:
      return '* * * * *';
  }
}

function autoComment(j: Job): string {
  if (j.comment.trim()) return j.comment.trim();
  const m = clampInt(j.minute, 0, 59, 0);
  const h = clampInt(j.hour, 0, 23, 0);
  const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  switch (j.preset) {
    case 'minute':
      return 'Every minute';
    case 'hourly':
      return `Every hour at :${m.toString().padStart(2, '0')}`;
    case 'daily':
      return `Every day at ${time}`;
    case 'weekly':
      return `Every ${DAYS[clampInt(j.dow, 0, 6, 1)] ?? 'Monday'} at ${time}`;
    case 'monthly':
      return `On day ${clampInt(j.dom, 1, 31, 1)} of each month at ${time}`;
    case 'reboot':
      return 'At system startup';
    case 'custom':
      return 'Custom schedule';
    default:
      return '';
  }
}

export default function CrontabRecipeGeneratorTool() {
  const [shell, setShell] = useState('/bin/bash');
  const [path, setPath] = useState('/usr/local/bin:/usr/bin:/bin');
  const [mailto, setMailto] = useState('');
  const [header, setHeader] = useState('Deployment crontab — generated, edit with `crontab -e`');
  const [jobs, setJobs] = useState<Job[]>([
    {
      id: 1, preset: 'daily', hour: '3', minute: '30', dow: '1', dom: '1', custom: '0 0 * * *',
      command: '/usr/local/bin/backup.sh', comment: '',
    },
    {
      id: 2, preset: 'reboot', hour: '0', minute: '0', dow: '1', dom: '1', custom: '0 0 * * *',
      command: 'cd /srv/app && ./start.sh', comment: '',
    },
  ]);

  const addJob = () =>
    setJobs((p) => [
      ...p,
      { id: nextId++, preset: 'hourly', hour: '0', minute: '0', dow: '1', dom: '1', custom: '*/5 * * * *', command: 'echo hello', comment: '' },
    ]);
  const removeJob = (id: number) => setJobs((p) => p.filter((j) => j.id !== id));
  const update = (id: number, patch: Partial<Job>) =>
    setJobs((p) => p.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const { output, errors } = useMemo(() => {
    const lines: string[] = [];
    if (header.trim()) {
      for (const l of header.split('\n')) lines.push(`# ${l}`);
      lines.push('');
    }
    if (shell.trim()) lines.push(`SHELL=${shell.trim()}`);
    if (path.trim()) lines.push(`PATH=${path.trim()}`);
    if (mailto.trim()) lines.push(`MAILTO=${mailto.trim()}`);
    if (shell.trim() || path.trim() || mailto.trim()) lines.push('');

    const errs: string[] = [];
    jobs.forEach((j, idx) => {
      const schedule = buildSchedule(j);
      const cmd = j.command.trim() || '/bin/true';
      lines.push(`# ${autoComment(j)}`);
      if (j.preset === 'reboot') {
        lines.push(`@reboot ${cmd}`);
      } else {
        const err = validateCron(schedule);
        if (err) errs.push(`Job ${idx + 1}: ${err}`);
        lines.push(`${schedule} ${cmd}`);
      }
      lines.push('');
    });

    return { output: lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', errors: errs };
  }, [shell, path, mailto, header, jobs]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="SHELL">
          <Input value={shell} onChange={(e) => setShell(e.target.value)} className="w-44 font-mono" placeholder="/bin/bash" />
        </Field>
        <Field label="PATH" className="min-w-[220px] flex-1">
          <Input value={path} onChange={(e) => setPath(e.target.value)} className="font-mono" />
        </Field>
        <Field label="MAILTO" hint="optional">
          <Input value={mailto} onChange={(e) => setMailto(e.target.value)} className="w-44 font-mono" placeholder="ops@example.com" />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Header comment (one line each)" />
        <Input
          value={header}
          onChange={(e) => setHeader(e.target.value)}
          className="rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
        />
      </Panel>

      {jobs.map((j, idx) => (
        <Panel key={j.id}>
          <PanelHeader title={`Job ${idx + 1}`}>
            <Button variant="ghost" size="icon-sm" onClick={() => removeJob(j.id)} aria-label="Remove job">
              <Trash2 className="size-3.5" />
            </Button>
          </PanelHeader>
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Schedule">
                <Select value={j.preset} onValueChange={(v) => update(j.id, { preset: v as Preset })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minute">Every minute</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily at HH:MM</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="reboot">@reboot</SelectItem>
                    <SelectItem value="custom">Custom 5-field</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {(j.preset === 'hourly' || j.preset === 'daily' || j.preset === 'weekly' || j.preset === 'monthly') && (
                <Field label="Minute">
                  <Input value={j.minute} onChange={(e) => update(j.id, { minute: e.target.value })} className="w-20 font-mono" inputMode="numeric" />
                </Field>
              )}
              {(j.preset === 'daily' || j.preset === 'weekly' || j.preset === 'monthly') && (
                <Field label="Hour">
                  <Input value={j.hour} onChange={(e) => update(j.id, { hour: e.target.value })} className="w-20 font-mono" inputMode="numeric" />
                </Field>
              )}
              {j.preset === 'weekly' && (
                <Field label="Day of week">
                  <Select value={j.dow} onValueChange={(v) => update(j.id, { dow: v })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {j.preset === 'monthly' && (
                <Field label="Day of month">
                  <Input value={j.dom} onChange={(e) => update(j.id, { dom: e.target.value })} className="w-20 font-mono" inputMode="numeric" />
                </Field>
              )}
              {j.preset === 'custom' && (
                <Field label="Expression" hint="min hour dom mon dow">
                  <Input value={j.custom} onChange={(e) => update(j.id, { custom: e.target.value })} className="w-48 font-mono" placeholder="*/5 * * * *" />
                </Field>
              )}
            </div>
            <Field label="Command">
              <Input value={j.command} onChange={(e) => update(j.id, { command: e.target.value })} className="font-mono" placeholder="/usr/local/bin/job.sh" />
            </Field>
            <Field label="Comment" hint="auto-generated if blank">
              <Input value={j.comment} onChange={(e) => update(j.id, { comment: e.target.value })} placeholder={autoComment(j)} />
            </Field>
          </div>
        </Panel>
      ))}

      <div>
        <Button variant="secondary" size="sm" onClick={addJob}>
          <Plus className="size-3.5" />
          Add job
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      <Panel>
        <PanelHeader title="crontab">
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename="crontab" />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{output}</pre>
        <StatBar items={[`${jobs.length} jobs`, errors.length ? `${errors.length} invalid` : 'all valid']} />
      </Panel>
    </div>
  );
}
