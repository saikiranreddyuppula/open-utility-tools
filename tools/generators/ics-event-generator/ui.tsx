'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronDown, ChevronUp, Copy, ExternalLink, Info, Plus, Trash2, X } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
  FLOATING,
  WEEKDAY_CODES,
  WEEKDAY_NAMES,
  alignStartToRule,
  blankEvent,
  buildRRule,
  defaultRecurrence,
  generateCalendar,
  listTimeZones,
  localDateString,
  nthPatternOf,
  previewOccurrences,
  providerUrl,
  resolveTimeMode,
  shiftEndWithStart,
  startMatchesRule,
  utf8Bytes,
  type Attendee,
  type EventStatus,
  type Freq,
  type IcsEvent,
  type Issue,
  type Provider,
  type RecurrenceSpec,
  type Reminder,
  type ReminderUnit,
  type Transp,
} from './logic';

const selectCls =
  'h-8 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-muted/40';

function makeUid(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return `${c.randomUUID()}@open-utility-tools`;
  const b = new Uint8Array(16);
  if (c) c.getRandomValues(b);
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}@open-utility-tools`;
}

function nextWeekday(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function numOrNaN(v: string): number {
  return v.trim() === '' ? Number.NaN : Number(v);
}

function numValue(n: number): string | number {
  return Number.isFinite(n) ? n : '';
}

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'google', label: 'Google Calendar' },
  { id: 'outlook', label: 'Outlook.com' },
  { id: 'office365', label: 'Office 365' },
  { id: 'yahoo', label: 'Yahoo' },
];

const FREQ_UNIT: Record<Exclude<Freq, 'NONE'>, string> = {
  DAILY: 'day(s)',
  WEEKLY: 'week(s)',
  MONTHLY: 'month(s)',
  YEARLY: 'year(s)',
};

/* ------------------------------------------------------------------ */

function RecurrenceEditor({
  ev,
  onChange,
  onAlign,
  rrule,
}: {
  ev: IcsEvent;
  onChange: (patch: Partial<RecurrenceSpec>) => void;
  onAlign: () => void;
  rrule: string | null;
}) {
  const r = ev.recurrence;
  const startWd = useMemo(() => {
    const d = new Date(`${ev.startDate}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? 1 : d.getUTCDay();
  }, [ev.startDate]);
  const effective = r.byDay.length ? r.byDay : [startWd];
  const preview = useMemo(() => previewOccurrences(ev, 10), [ev]);
  const mismatch = r.freq !== 'NONE' && !startMatchesRule(ev);

  const setFreq = (freq: Freq): void => {
    const pat = nthPatternOf(ev.startDate);
    onChange({ freq, byDay: [], ...(pat && freq !== 'NONE' ? { nth: pat.nth, nthWeekday: pat.weekday } : {}) });
  };
  const toggleDay = (wd: number): void => {
    const set = new Set(effective);
    if (set.has(wd)) {
      if (set.size === 1) return;
      set.delete(wd);
    } else set.add(wd);
    onChange({ byDay: [...set].sort((a, b) => a - b) });
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Repeat" className="w-44">
          <select className={selectCls} value={r.freq} onChange={(e) => setFreq(e.target.value as Freq)} aria-label="Repeat">
            <option value="NONE">Does not repeat</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </Field>
        {r.freq !== 'NONE' && (
          <Field label="Every" className="w-36">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={999}
                className="w-16"
                value={numValue(r.interval)}
                onChange={(e) => onChange({ interval: numOrNaN(e.target.value) })}
                aria-label="Repeat interval"
              />
              <span className="text-xs text-muted-foreground">{FREQ_UNIT[r.freq]}</span>
            </div>
          </Field>
        )}
      </div>

      {r.freq === 'WEEKLY' && (
        <Field label="On these days">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Weekdays">
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
              const on = effective.includes(wd);
              return (
                <button
                  key={wd}
                  type="button"
                  aria-pressed={on}
                  title={WEEKDAY_NAMES[wd]}
                  onClick={() => toggleDay(wd)}
                  className={cn(
                    'h-8 w-11 rounded-md border text-xs font-medium transition-colors',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'
                  )}
                >
                  {WEEKDAY_CODES[wd]}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      {(r.freq === 'MONTHLY' || r.freq === 'YEARLY') && (
        <div className="space-y-2">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${ev.uid}-mm`}
              checked={r.monthlyMode === 'dayOfMonth'}
              onChange={() => onChange({ monthlyMode: 'dayOfMonth' })}
            />
            {r.freq === 'MONTHLY' ? (
              <>
                <span>On day</span>
                <select
                  className={cn(selectCls, 'w-44')}
                  value={r.monthDay}
                  disabled={r.monthlyMode !== 'dayOfMonth'}
                  onChange={(e) => onChange({ monthDay: Number(e.target.value) })}
                  aria-label="Day of month"
                >
                  <option value={0}>same as start date</option>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                  <option value={-1}>last day of month</option>
                </select>
              </>
            ) : (
              <span>On the same date each year</span>
            )}
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${ev.uid}-mm`}
              checked={r.monthlyMode === 'nthWeekday'}
              onChange={() => {
                const pat = nthPatternOf(ev.startDate);
                onChange({ monthlyMode: 'nthWeekday', ...(pat ? { nth: pat.nth, nthWeekday: pat.weekday } : {}) });
              }}
            />
            <span>On the</span>
            <select
              className={cn(selectCls, 'w-24')}
              value={r.nth}
              disabled={r.monthlyMode !== 'nthWeekday'}
              onChange={(e) => onChange({ nth: Number(e.target.value) })}
              aria-label="Which occurrence"
            >
              <option value={1}>1st</option>
              <option value={2}>2nd</option>
              <option value={3}>3rd</option>
              <option value={4}>4th</option>
              <option value={-1}>last</option>
            </select>
            <select
              className={cn(selectCls, 'w-40')}
              value={r.nthWeekday}
              disabled={r.monthlyMode !== 'nthWeekday'}
              onChange={(e) => onChange({ nthWeekday: Number(e.target.value) })}
              aria-label="Weekday"
            >
              {WEEKDAY_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
              <option value={7}>weekday (Mon–Fri)</option>
            </select>
            {r.freq === 'YEARLY' && <span className="text-muted-foreground">of the start date&apos;s month</span>}
          </label>
        </div>
      )}

      {r.freq !== 'NONE' && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Ends" className="w-44">
            <select
              className={selectCls}
              value={r.endMode}
              onChange={(e) => onChange({ endMode: e.target.value as RecurrenceSpec['endMode'] })}
              aria-label="Ends"
            >
              <option value="never">Never</option>
              <option value="count">After N occurrences</option>
              <option value="until">On a date</option>
            </select>
          </Field>
          {r.endMode === 'count' && (
            <Field label="Occurrences" className="w-28">
              <Input
                type="number"
                min={1}
                value={numValue(r.count)}
                onChange={(e) => onChange({ count: numOrNaN(e.target.value) })}
                aria-label="Occurrence count"
              />
            </Field>
          )}
          {r.endMode === 'until' && (
            <Field label="Last day (inclusive)" className="w-44">
              <Input type="date" value={r.until} onChange={(e) => onChange({ until: e.target.value })} aria-label="Repeat until" />
            </Field>
          )}
        </div>
      )}

      {rrule && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
            <code className="min-w-0 flex-1 break-all font-mono text-xs" data-testid="rrule">
              RRULE:{rrule}
            </code>
            <CopyButton value={`RRULE:${rrule}`} size="icon-sm" label="Copy RRULE" />
          </div>
          {mismatch && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-warning">
              <span>The start date is not one of the occurrences.</span>
              <Button type="button" size="sm" variant="secondary" onClick={onAlign}>
                Move start to first match
              </Button>
            </div>
          )}
          <div>
            <div className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              First {preview.lines.length} occurrence{preview.lines.length === 1 ? '' : 's'}
              {preview.total > 0 && (
                <span className="ml-1 normal-case tracking-normal">
                  ({preview.truncated ? `${preview.total}+` : preview.total} total)
                </span>
              )}
            </div>
            {preview.lines.length === 0 ? (
              <div className="text-xs text-muted-foreground">No occurrences - check the pattern.</div>
            ) : (
              <ol className="grid grid-cols-1 gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-2">
                {preview.lines.map((l, i) => (
                  <li key={i} className="truncate" title={l.label}>
                    <span className="mr-1.5 text-muted-foreground">{String(i + 1).padStart(2, ' ')}.</span>
                    {l.label}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EventCard({
  ev,
  index,
  total,
  zones,
  browserTz,
  utc,
  open,
  note,
  onToggle,
  onChange,
  onRecurrence,
  onDuplicate,
  onRemove,
}: {
  ev: IcsEvent;
  index: number;
  total: number;
  zones: string[];
  browserTz: string;
  utc: boolean;
  open: boolean;
  note?: string;
  onToggle: () => void;
  onChange: (patch: Partial<IcsEvent>) => void;
  onRecurrence: (patch: Partial<RecurrenceSpec>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const mode = resolveTimeMode(ev, utc).mode;
  const rrule = buildRRule(ev, mode);
  const setStart = (patch: { startDate?: string; startTime?: string }): void => onChange({ ...patch, ...shiftEndWithStart(ev, patch) });

  const setAttendee = (i: number, patch: Partial<Attendee>): void =>
    onChange({ attendees: ev.attendees.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const setReminder = (i: number, patch: Partial<Reminder>): void =>
    onChange({ reminders: ev.reminders.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <Panel data-testid="event-card">
      <PanelHeader title={`Event ${index + 1}`}>
        <span className="mr-2 hidden max-w-[16rem] truncate text-xs text-muted-foreground sm:inline">{ev.title || 'Untitled'}</span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label="Duplicate event" title="Duplicate event">
          <Copy className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          disabled={total <= 1}
          aria-label="Remove event"
          title={total <= 1 ? 'At least one event is required' : 'Remove event'}
        >
          <Trash2 className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onToggle} aria-label={open ? 'Collapse event' : 'Expand event'} aria-expanded={open}>
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </PanelHeader>

      {open && (
        <div className="space-y-4 p-3">
          <Field label="Title" htmlFor={`${ev.uid}-title`}>
            <Input id={`${ev.uid}-title`} value={ev.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Team meeting" />
          </Field>

          <div className="flex items-center gap-2">
            <Switch id={`${ev.uid}-allday`} checked={ev.allDay} onCheckedChange={(c) => onChange({ allDay: c })} />
            <Label htmlFor={`${ev.uid}-allday`} className="text-sm">
              All-day event
            </Label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={ev.allDay ? 'First day' : 'Start'}>
              <div className="flex gap-2">
                <Input type="date" value={ev.startDate} onChange={(e) => setStart({ startDate: e.target.value })} aria-label="Start date" />
                {!ev.allDay && (
                  <Input type="time" value={ev.startTime} onChange={(e) => setStart({ startTime: e.target.value })} aria-label="Start time" className="w-28 shrink-0" />
                )}
              </div>
            </Field>
            <Field
              label={ev.allDay ? 'Last day (inclusive)' : 'End'}
              hint={ev.allDay ? 'DTEND is written as the day after (end dates are exclusive in iCalendar).' : undefined}
            >
              <div className="flex gap-2">
                <Input type="date" value={ev.endDate} onChange={(e) => onChange({ endDate: e.target.value })} aria-label="End date" />
                {!ev.allDay && (
                  <Input type="time" value={ev.endTime} onChange={(e) => onChange({ endTime: e.target.value })} aria-label="End time" className="w-28 shrink-0" />
                )}
              </div>
            </Field>
            {!ev.allDay && (
              <Field label="Time zone" className="sm:col-span-2">
                <select className={selectCls} value={ev.tz} onChange={(e) => onChange({ tz: e.target.value })} aria-label="Time zone">
                  <option value={FLOATING}>Floating (no time zone - same wall time everywhere)</option>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                      {z === browserTz ? '  (your time zone)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          {note && !ev.allDay && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>{note}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Location">
              <Input value={ev.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="Room 4, 12 Main St" />
            </Field>
            <Field label="URL">
              <Input value={ev.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://meet.example.com/abc" inputMode="url" />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={ev.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              placeholder={'Agenda, notes, dial-in…\nLine breaks are preserved.'}
              spellCheck={false}
              className="min-h-20"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Organizer name">
              <Input value={ev.organizerName} onChange={(e) => onChange({ organizerName: e.target.value })} placeholder="Alex Morgan" />
            </Field>
            <Field label="Organizer email">
              <Input type="email" value={ev.organizerEmail} onChange={(e) => onChange({ organizerEmail: e.target.value })} placeholder="alex@example.com" />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Attendees</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onChange({ attendees: [...ev.attendees, { name: '', email: '', rsvp: true }] })}
              >
                <Plus className="size-3.5" /> Add attendee
              </Button>
            </div>
            {ev.attendees.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2" data-testid="attendee-row">
                <Input className="min-w-32 flex-1" value={a.name} onChange={(e) => setAttendee(i, { name: e.target.value })} placeholder="Name" aria-label={`Attendee ${i + 1} name`} />
                <Input
                  className="min-w-40 flex-1"
                  type="email"
                  value={a.email}
                  onChange={(e) => setAttendee(i, { email: e.target.value })}
                  placeholder="email@example.com"
                  aria-label={`Attendee ${i + 1} email`}
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox checked={a.rsvp} onCheckedChange={(c) => setAttendee(i, { rsvp: c === true })} aria-label={`Attendee ${i + 1} RSVP requested`} />
                  RSVP
                </label>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange({ attendees: ev.attendees.filter((_, j) => j !== i) })} aria-label={`Remove attendee ${i + 1}`}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select className={selectCls} value={ev.status} onChange={(e) => onChange({ status: e.target.value as EventStatus })} aria-label="Status">
                <option value="CONFIRMED">Confirmed</option>
                <option value="TENTATIVE">Tentative</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </Field>
            <Field label="Show as">
              <select className={selectCls} value={ev.transp} onChange={(e) => onChange({ transp: e.target.value as Transp })} aria-label="Show as">
                <option value="OPAQUE">Busy</option>
                <option value="TRANSPARENT">Free</option>
              </select>
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Reminders</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onChange({ reminders: [...ev.reminders, { amount: 15, unit: 'minutes' }] })}
              >
                <Plus className="size-3.5" /> Add reminder
              </Button>
            </div>
            {ev.reminders.map((rem, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2" data-testid="reminder-row">
                <Input
                  type="number"
                  min={0}
                  className="w-20"
                  value={numValue(rem.amount)}
                  onChange={(e) => setReminder(i, { amount: numOrNaN(e.target.value) })}
                  aria-label={`Reminder ${i + 1} amount`}
                />
                <select
                  className={cn(selectCls, 'w-28')}
                  value={rem.unit}
                  onChange={(e) => setReminder(i, { unit: e.target.value as ReminderUnit })}
                  aria-label={`Reminder ${i + 1} unit`}
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                </select>
                <span className="text-xs text-muted-foreground">before (popup alert)</span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange({ reminders: ev.reminders.filter((_, j) => j !== i) })} aria-label={`Remove reminder ${i + 1}`}>
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Repeat</span>
            <RecurrenceEditor
              ev={ev}
              rrule={rrule}
              onChange={onRecurrence}
              onAlign={() => {
                const a = alignStartToRule(ev);
                if (a) onChange(a);
              }}
            />
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function IssueList({ issues, events }: { issues: Issue[]; events: IcsEvent[] }) {
  const label = (i: Issue): string => {
    if (i.eventIndex === null) return i.message;
    const t = events[i.eventIndex]?.title.trim();
    return `Event ${i.eventIndex + 1}${t ? ` (${t})` : ''}: ${i.message}`;
  };
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      {errors.length > 0 && <ErrorBanner error={errors.map(label).join('\n')} className="whitespace-pre-line" />}
      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          {warnings.map((w, i) => (
            <li key={i}>{label(w)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function IcsEventGenerator() {
  const [events, setEvents] = useState<IcsEvent[] | null>(null);
  const [utc, setUtc] = useState(true);
  const [zones, setZones] = useState<string[]>(['UTC']);
  const [browserTz, setBrowserTz] = useState('UTC');
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let tz = 'UTC';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      tz = 'UTC';
    }
    const list = listTimeZones();
    if (!list.includes(tz)) list.splice(1, 0, tz);
    setZones(list);
    setBrowserTz(tz);
    const day = localDateString(nextWeekday(new Date()));
    setEvents([
      {
        ...blankEvent(makeUid(), tz, day, day),
        title: 'Product launch planning',
        location: 'Conference Room B',
        description: 'Agenda:\n1. Launch timeline\n2. Marketing assets\n3. Open questions\n\nDial-in: https://meet.example.com/launch',
        url: 'https://meet.example.com/launch',
        organizerName: 'Alex Morgan',
        organizerEmail: 'alex@example.com',
        attendees: [{ name: 'Sam Lee', email: 'sam@example.com', rsvp: true }],
        reminders: [{ amount: 15, unit: 'minutes' }],
      },
    ]);
  }, []);

  const result = useMemo(() => (events ? generateCalendar(events, { utc }) : null), [events, utc]);

  const patchEvent = useCallback((uid: string, patch: Partial<IcsEvent>) => {
    setEvents((prev) => (prev ? prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e)) : prev));
  }, []);
  const patchRecurrence = useCallback((uid: string, patch: Partial<RecurrenceSpec>) => {
    setEvents((prev) => (prev ? prev.map((e) => (e.uid === uid ? { ...e, recurrence: { ...e.recurrence, ...patch } } : e)) : prev));
  }, []);

  const addEvent = (): void => {
    const day = localDateString(nextWeekday(new Date()));
    const base = events?.[events.length - 1];
    setEvents((prev) => [...(prev ?? []), { ...blankEvent(makeUid(), base?.tz ?? browserTz, base?.startDate ?? day, base?.endDate ?? day), recurrence: defaultRecurrence() }]);
  };
  const duplicate = (uid: string): void => {
    setEvents((prev) => {
      if (!prev) return prev;
      const i = prev.findIndex((e) => e.uid === uid);
      const src = prev[i];
      if (!src) return prev;
      const copy: IcsEvent = structuredClone(src);
      copy.uid = makeUid();
      copy.title = src.title ? `${src.title} (copy)` : '';
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  };
  const remove = (uid: string): void => setEvents((prev) => (prev && prev.length > 1 ? prev.filter((e) => e.uid !== uid) : prev));

  if (!events || !result) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const ics = result.ics;
  const hasError = result.issues.some((i) => i.level === 'error');
  const first = events[0];
  const lines = ics ? ics.split('\r\n').length - 1 : 0;
  const forcedTz = result.modes.some((m) => m.reason);

  return (
    <div className="space-y-4">
      <OptionsBar>
        <div className="flex items-center gap-2">
          <Switch id="ics-utc" checked={utc} onCheckedChange={setUtc} />
          <Label htmlFor="ics-utc" className="text-sm">
            Write times in UTC
          </Label>
        </div>
        <p className="min-w-[16rem] flex-1 text-xs text-muted-foreground">
          {utc
            ? 'Times are converted to UTC (…Z) - the safest option for one-off events. Repeating events in zones with daylight saving automatically use a time zone + VTIMEZONE so the local time does not drift.'
            : 'Times are written with TZID=<zone> and a generated VTIMEZONE (offsets and DST rules derived from your browser’s Intl data).'}
        </p>
        <Button type="button" size="sm" onClick={addEvent}>
          <Plus className="size-3.5" /> Add event
        </Button>
      </OptionsBar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {events.map((ev, i) => (
            <EventCard
              key={ev.uid}
              ev={ev}
              index={i}
              total={events.length}
              zones={zones}
              browserTz={browserTz}
              utc={utc}
              open={!closed[ev.uid]}
              note={result.modes[i]?.reason}
              onToggle={() => setClosed((c) => ({ ...c, [ev.uid]: !c[ev.uid] }))}
              onChange={(p) => patchEvent(ev.uid, p)}
              onRecurrence={(p) => patchRecurrence(ev.uid, p)}
              onDuplicate={() => duplicate(ev.uid)}
              onRemove={() => remove(ev.uid)}
            />
          ))}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Panel>
            <PanelHeader title="iCalendar file">
              <CopyButton value={() => ics} disabled={!ics} />
              <DownloadButton
                data={() => ics}
                filename={events.length > 1 ? 'events.ics' : 'event.ics'}
                mime="text/calendar;charset=utf-8"
                disabled={!ics}
                label="Download .ics"
              />
            </PanelHeader>
            <div className="space-y-2 p-3">
              <IssueList issues={result.issues} events={events} />
              {ics ? (
                <pre
                  className="max-h-[28rem] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed whitespace-pre"
                  data-testid="ics-preview"
                  tabIndex={0}
                >
                  {ics.replace(/\r\n/g, '\n')}
                </pre>
              ) : (
                !hasError && <div className="text-sm text-muted-foreground">Nothing to show yet.</div>
              )}
              <p className="text-2xs text-muted-foreground">
                RFC 5545 · CRLF line endings · lines folded at 75 octets · METHOD:PUBLISH. Importing a file does not email invitations to attendees.
                {forcedTz && ' Some events use a time zone instead of UTC (see the note on the event).'}
              </p>
            </div>
            <StatBar items={[`${events.length} event${events.length === 1 ? '' : 's'}`, ics && `${lines} lines`, ics && `${utf8Bytes(ics)} bytes`]} />
          </Panel>

          <Panel>
            <PanelHeader title={`Add event${events.length > 1 ? ' 1' : ''} to calendar`}>
              <CalendarPlus className="mr-1 size-3.5 text-muted-foreground" />
            </PanelHeader>
            <div className="space-y-2 p-3">
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => {
                  const href = first && !hasError ? providerUrl(first, p.id) : null;
                  return href ? (
                    <Button key={p.id} asChild variant="secondary" size="sm">
                      <a href={href} target="_blank" rel="noopener noreferrer" data-testid={`link-${p.id}`}>
                        {p.label} <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  ) : (
                    <Button key={p.id} variant="secondary" size="sm" disabled>
                      {p.label}
                    </Button>
                  );
                })}
              </div>
              <p className="text-2xs text-muted-foreground">
                Links just open the provider with the fields prefilled (nothing is sent from this page). Only Google receives the repeat rule; attendees,
                reminders and organizer are not supported by these links - use the .ics file for those.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
