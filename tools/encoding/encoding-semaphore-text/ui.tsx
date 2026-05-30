'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Notation = 'compass' | 'clock';

// 8 arm directions. Angle in degrees clockwise from straight up (12 o'clock = 0°).
type Dir = 'S' | 'SW' | 'W' | 'NW' | 'N' | 'NE' | 'E' | 'SE';

const DIR_ANGLE: Record<Dir, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

const DIR_CLOCK: Record<Dir, string> = {
  N: '12 o’clock',
  NE: '1:30',
  E: '3 o’clock',
  SE: '4:30',
  S: '6 o’clock',
  SW: '7:30',
  W: '9 o’clock',
  NW: '10:30',
};

// Standard flag-semaphore alphabet: each letter = two arm directions (left, right)
// as seen facing the signaller. Built up the conventional way (A–G use the lowest
// arm fixed, then rotate the second arm, etc.).
const ALPHA: Record<string, [Dir, Dir]> = {
  A: ['S', 'SW'],
  B: ['S', 'W'],
  C: ['S', 'NW'],
  D: ['S', 'N'],
  E: ['NE', 'S'],
  F: ['E', 'S'],
  G: ['SE', 'S'],
  H: ['W', 'SW'],
  I: ['NW', 'SW'],
  J: ['E', 'N'],
  K: ['SW', 'N'],
  L: ['SW', 'NE'],
  M: ['SW', 'E'],
  N: ['SW', 'SE'],
  O: ['NW', 'W'],
  P: ['W', 'N'],
  Q: ['W', 'NE'],
  R: ['W', 'E'],
  S: ['W', 'SE'],
  T: ['NW', 'N'],
  U: ['NW', 'NE'],
  V: ['N', 'SE'],
  W: ['NE', 'E'],
  X: ['NE', 'SE'],
  Y: ['NW', 'E'],
  Z: ['SE', 'E'],
};

// Numeric convention: NUMERALS sign, then A–K (skipping J) map to 1..0.
const NUM_SIGN: [Dir, Dir] = ['SE', 'N'];
const DIGIT_LETTER: Record<string, string> = {
  '1': 'A',
  '2': 'B',
  '3': 'C',
  '4': 'D',
  '5': 'E',
  '6': 'F',
  '7': 'G',
  '8': 'H',
  '9': 'I',
  '0': 'K',
};

function describe(d: Dir, notation: Notation): string {
  return notation === 'compass' ? d : DIR_CLOCK[d];
}

/** A stick figure with two flag arms, drawn via SVG. */
function Figure({ left, right }: { left: Dir; right: Dir }) {
  const cx = 30;
  const cy = 34;
  const len = 22;
  const armPoint = (dir: Dir) => {
    const a = ((DIR_ANGLE[dir] - 90) * Math.PI) / 180; // 0° = up
    return { x: cx + len * Math.cos(a), y: cy + len * Math.sin(a) };
  };
  const l = armPoint(left);
  const r = armPoint(right);
  return (
    <svg viewBox="0 0 60 78" className="h-20 w-16" aria-hidden>
      <circle cx={cx} cy={14} r={6} className="fill-none stroke-foreground" strokeWidth={1.5} />
      <line x1={cx} y1={20} x2={cx} y2={56} className="stroke-foreground" strokeWidth={1.5} />
      <line x1={cx} y1={56} x2={cx - 8} y2={70} className="stroke-foreground" strokeWidth={1.5} />
      <line x1={cx} y1={56} x2={cx + 8} y2={70} className="stroke-foreground" strokeWidth={1.5} />
      <line x1={cx} y1={cy} x2={l.x} y2={l.y} className="stroke-primary" strokeWidth={2} />
      <rect x={l.x - 3} y={l.y - 3} width={6} height={6} className="fill-primary" />
      <line x1={cx} y1={cy} x2={r.x} y2={r.y} className="stroke-primary" strokeWidth={2} />
      <rect x={r.x - 3} y={r.y - 3} width={6} height={6} className="fill-primary" />
    </svg>
  );
}

interface OutItem {
  ch: string;
  arms: [Dir, Dir] | null;
  note: string;
}

export default function SemaphoreTextTool() {
  const [input, setInput] = useState('SOS 123');
  const [showDiagrams, setShowDiagrams] = useState(true);
  const [notation, setNotation] = useState<Notation>('compass');
  const [showLegend, setShowLegend] = useState(true);

  const items = useMemo<OutItem[]>(() => {
    const out: OutItem[] = [];
    let inNumeric = false;
    for (const raw of input) {
      const ch = raw.toUpperCase();
      if (/[A-Z]/.test(ch)) {
        if (inNumeric) {
          out.push({ ch: 'LET', arms: null, note: 'letters sign' });
          inNumeric = false;
        }
        const arms = ALPHA[ch];
        if (arms) out.push({ ch, arms, note: '' });
        continue;
      }
      if (/[0-9]/.test(ch)) {
        if (!inNumeric) {
          out.push({ ch: 'NUM', arms: NUM_SIGN, note: 'numerals sign' });
          inNumeric = true;
        }
        const letter = DIGIT_LETTER[ch];
        const arms = letter ? ALPHA[letter] : undefined;
        if (arms) out.push({ ch, arms, note: `digit ${ch}` });
        continue;
      }
      // Non-letter / non-digit passes through with a note.
      if (inNumeric) inNumeric = false;
      const label = ch === ' ' ? '␠' : ch;
      out.push({ ch: label, arms: null, note: 'pass-through' });
    }
    return out;
  }, [input]);

  const textOutput = useMemo(() => {
    return items
      .map((it) => {
        if (!it.arms) return `${it.ch} (${it.note})`;
        const [l, r] = it.arms;
        return `${it.ch}: L=${describe(l, notation)}, R=${describe(r, notation)}`;
      })
      .join('\n');
  }, [items, notation]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Show diagrams">
            <Switch checked={showDiagrams} onCheckedChange={setShowDiagrams} />
          </Field>
          <Field label="Notation">
            <Select value={notation} onValueChange={(v) => setNotation(v as Notation)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compass">Compass (N, NE…)</SelectItem>
                <SelectItem value="clock">Clock hours</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Show legend">
            <Switch checked={showLegend} onCheckedChange={setShowLegend} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Text">
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            onClick={() => setInput('SOS 123')}
          >
            Sample
          </button>
        </PanelHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          placeholder="Type text to signal…"
          className="min-h-[90px] resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar items={[`${input.length} chars`]} />
      </Panel>

      <Panel>
        <PanelHeader title="Semaphore positions">
          <CopyButton value={() => textOutput} disabled={!textOutput} />
        </PanelHeader>
        {showDiagrams ? (
          <div className="flex flex-wrap gap-3 p-3">
            {items.map((it, i) => (
              <div
                key={i}
                className="flex w-[88px] flex-col items-center gap-1 rounded-md border bg-background p-2 text-center"
              >
                {it.arms ? (
                  <Figure left={it.arms[0]} right={it.arms[1]} />
                ) : (
                  <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                    {it.note}
                  </div>
                )}
                <span className="font-mono text-sm font-semibold">{it.ch}</span>
                {it.arms && (
                  <span className="text-2xs leading-tight text-muted-foreground">
                    {describe(it.arms[0], notation)} / {describe(it.arms[1], notation)}
                  </span>
                )}
              </div>
            ))}
            {items.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Type text above.</div>
            )}
          </div>
        ) : (
          <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">
            {textOutput || 'Type text above.'}
          </pre>
        )}
      </Panel>

      {showLegend && (
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Alphabet reference (left / right arm)
          </div>
          <div className="grid grid-cols-2 gap-1 font-mono text-2xs sm:grid-cols-4 md:grid-cols-6">
            {Object.entries(ALPHA).map(([letter, arms]) => (
              <div key={letter} className="flex items-center gap-1 rounded bg-background px-1.5 py-1">
                <span className="w-4 font-semibold">{letter}</span>
                <span className="text-muted-foreground">
                  {describe(arms[0], notation)}/{describe(arms[1], notation)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
