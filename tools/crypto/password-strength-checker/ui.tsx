'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';

// A small bundled set of very common passwords (offline). Not exhaustive but
// catches the most-used credentials.
const COMMON = new Set<string>([
  '123456', '123456789', 'password', '12345678', 'qwerty', '12345', '123123',
  '1234567', '1234567890', 'iloveyou', 'admin', 'welcome', 'monkey', 'login',
  'abc123', 'starwars', '123321', 'dragon', 'passw0rd', 'master', 'hello',
  'freedom', 'whatever', 'qazwsx', 'trustno1', '000000', '111111', '654321',
  'superman', 'letmein', 'sunshine', 'princess', 'football', 'baseball',
  'shadow', 'michael', 'jennifer', 'jordan', 'harley', 'ranger', 'hunter',
  'buster', 'soccer', 'pokemon', 'batman', 'test', 'pass', 'root', 'guest',
  'p@ssw0rd', 'password1', 'qwerty123', '1q2w3e4r', 'zaq12wsx', 'asdfgh',
]);

const KEYBOARD_ROWS = [
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '1234567890',
];

interface Analysis {
  score: number; // 0-4
  label: string;
  entropy: number;
  weaknesses: string[];
  patterns: string[];
  tips: string[];
  length: number;
}

function hasKeyboardSequence(pw: string): boolean {
  const lower = pw.toLowerCase();
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i + 4 <= row.length; i++) {
      const seq = row.slice(i, i + 4);
      const rev = seq.split('').reverse().join('');
      if (lower.includes(seq) || lower.includes(rev)) return true;
    }
  }
  return false;
}

function hasRepeatRun(pw: string): boolean {
  return /(.)\1\1/.test(pw);
}

function hasNumericSequence(pw: string): boolean {
  for (let i = 0; i + 4 <= pw.length; i++) {
    const slice = pw.slice(i, i + 4);
    if (!/^\d{4}$/.test(slice)) continue;
    let asc = true;
    let desc = true;
    for (let j = 1; j < slice.length; j++) {
      const a = slice.charCodeAt(j - 1);
      const b = slice.charCodeAt(j);
      if (b !== a + 1) asc = false;
      if (b !== a - 1) desc = false;
    }
    if (asc || desc) return true;
  }
  return false;
}

function hasDate(pw: string): boolean {
  return /(19|20)\d{2}/.test(pw) || /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/.test(pw);
}

function analyze(pw: string): Analysis {
  const length = pw.length;
  const lower = /[a-z]/.test(pw);
  const upper = /[A-Z]/.test(pw);
  const digit = /[0-9]/.test(pw);
  const symbol = /[^A-Za-z0-9]/.test(pw);

  let pool = 0;
  if (lower) pool += 26;
  if (upper) pool += 26;
  if (digit) pool += 10;
  if (symbol) pool += 33;
  const entropy = length > 0 && pool > 0 ? length * Math.log2(pool) : 0;

  const classes = [lower, upper, digit, symbol].filter(Boolean).length;
  const weaknesses: string[] = [];
  const patterns: string[] = [];
  const tips: string[] = [];

  if (length < 8) weaknesses.push('Too short (under 8 characters)');
  else if (length < 12) weaknesses.push('Length is okay but under the recommended 12+');
  if (!upper) tips.push('Add uppercase letters');
  if (!lower) tips.push('Add lowercase letters');
  if (!digit) tips.push('Add digits');
  if (!symbol) tips.push('Add symbols (e.g. ! @ # $ %)');
  if (length < 16) tips.push('Make it longer — length beats complexity');

  if (COMMON.has(pw.toLowerCase())) patterns.push('Appears in the common-password list');
  if (hasKeyboardSequence(pw)) patterns.push('Contains a keyboard sequence (qwerty/asdf)');
  if (hasRepeatRun(pw)) patterns.push('Contains a repeated character run (aaa, 111)');
  if (hasNumericSequence(pw)) patterns.push('Contains a numeric sequence (1234)');
  if (hasDate(pw)) patterns.push('Looks like it contains a year or date');

  // Base score from entropy.
  let score: number;
  if (entropy < 28) score = 0;
  else if (entropy < 36) score = 1;
  else if (entropy < 60) score = 2;
  else if (entropy < 80) score = 3;
  else score = 4;

  // Deductions for detected patterns / poor composition.
  if (COMMON.has(pw.toLowerCase())) score = 0;
  else {
    if (patterns.length > 0) score = Math.max(0, score - 1);
    if (classes <= 1) score = Math.max(0, score - 1);
    if (length < 8) score = Math.min(score, 1);
  }
  if (length === 0) score = 0;

  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const label = labels[score] ?? 'Very Weak';

  return { score, label, entropy, weaknesses, patterns, tips, length };
}

const BAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-emerald-500',
];

export default function PasswordStrengthCheckerTool() {
  const [pw, setPw] = useState('Tr0ub4dor&3');
  const [show, setShow] = useState(true);

  const a = useMemo(() => analyze(pw), [pw]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Password" className="flex-1">
          <div className="flex items-center gap-2">
            <Input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Type a password to score it"
              className="font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShow((s) => !s)}
              title={show ? 'Hide' : 'Show'}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title={`Strength: ${a.label}`} />
        <div className="space-y-3 p-3">
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i <= a.score && pw.length > 0
                    ? BAR_COLORS[a.score] ?? 'bg-muted'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            Score {a.score} / 4 · estimated entropy ≈ {a.entropy.toFixed(1)} bits
          </div>
        </div>
        <StatBar
          items={[
            `${a.length} chars`,
            `${a.patterns.length} risky patterns`,
            `~${a.entropy.toFixed(0)} bits`,
          ]}
        />
      </Panel>

      {a.patterns.length > 0 && (
        <Panel>
          <PanelHeader title="Matched weak patterns" />
          <ul className="space-y-1 p-3 text-sm">
            {a.patterns.map((p) => (
              <li key={p} className="flex items-start gap-2 text-red-600 dark:text-red-400">
                <span>•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(a.weaknesses.length > 0 || a.tips.length > 0) && (
        <Panel>
          <PanelHeader title="How to improve" />
          <ul className="space-y-1 p-3 text-sm text-muted-foreground">
            {[...a.weaknesses, ...a.tips].map((t, i) => (
              <li key={`${t}-${i}`} className="flex items-start gap-2">
                <span>→</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Everything runs locally — the password is never sent anywhere.
      </p>
    </div>
  );
}
