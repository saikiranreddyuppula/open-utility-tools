'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import {
  generatePassword,
  generatePassphrase,
  entropyBits,
  type PasswordOptions,
} from '@/lib/generators/password';

function strengthLabel(bits: number): { label: string; className: string } {
  if (bits < 40) return { label: 'Weak', className: 'text-destructive' };
  if (bits < 64) return { label: 'Fair', className: 'text-warning' };
  if (bits < 100) return { label: 'Strong', className: 'text-success' };
  return { label: 'Very strong', className: 'text-success' };
}

export default function PasswordGeneratorTool() {
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');

  // password options
  const [length, setLength] = useState(20);
  const [opts, setOpts] = useState<Omit<PasswordOptions, 'length'>>({
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    excludeSimilar: false,
  });

  // passphrase options
  const [words, setWords] = useState(5);
  const [capitalize, setCapitalize] = useState(false);

  const [value, setValue] = useState('');

  const poolSize = useMemo(() => {
    let n = 0;
    if (opts.lower) n += 26;
    if (opts.upper) n += 26;
    if (opts.digits) n += 10;
    if (opts.symbols) n += 24;
    if (opts.excludeSimilar) n -= 7;
    return Math.max(n, 0);
  }, [opts]);

  const regen = useCallback(() => {
    if (mode === 'password') {
      setValue(generatePassword({ length, ...opts }));
    } else {
      setValue(generatePassphrase(words, '-', capitalize));
    }
  }, [mode, length, opts, words, capitalize]);

  useEffect(() => {
    regen();
  }, [regen]);

  const bits =
    mode === 'password'
      ? entropyBits(length, poolSize)
      : Math.round(words * Math.log2(1296));
  const strength = strengthLabel(bits);

  const toggle = (k: keyof typeof opts) => setOpts((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Type">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'password' | 'passphrase')}>
            <TabsList>
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="passphrase">Passphrase</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>

        {mode === 'password' ? (
          <>
            <Field label={`Length · ${length}`} className="min-w-44">
              <Slider
                value={[length]}
                onValueChange={([v]) => setLength(v ?? 20)}
                min={4}
                max={128}
                step={1}
                className="mt-2.5"
              />
            </Field>
            <Field label="Sets">
              <div className="flex h-8 flex-wrap items-center gap-3">
                {(['lower', 'upper', 'digits', 'symbols'] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1.5 text-xs">
                    <Switch checked={opts[k]} onCheckedChange={() => toggle(k)} />
                    {k}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Exclude similar">
              <div className="flex h-8 items-center gap-2">
                <Switch
                  checked={opts.excludeSimilar}
                  onCheckedChange={() => toggle('excludeSimilar')}
                />
                <Label className="text-xs text-muted-foreground">il1Lo0O</Label>
              </div>
            </Field>
          </>
        ) : (
          <>
            <Field label={`Words · ${words}`} className="min-w-44">
              <Slider
                value={[words]}
                onValueChange={([v]) => setWords(v ?? 5)}
                min={3}
                max={12}
                step={1}
                className="mt-2.5"
              />
            </Field>
            <Field label="Capitalize">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={capitalize} onCheckedChange={setCapitalize} />
                <Label className="text-xs text-muted-foreground">Title-Case</Label>
              </div>
            </Field>
          </>
        )}
      </OptionsBar>

      <Panel>
        <PanelHeader title="Generated">
          <Button variant="ghost" size="sm" onClick={regen}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
          <CopyButton value={value} disabled={!value} />
        </PanelHeader>
        <div className="p-4">
          <code className="block break-all font-mono text-base">
            {value || <span className="text-muted-foreground">—</span>}
          </code>
        </div>
        <StatBar
          items={[
            `~${bits} bits entropy`,
            value && `${value.length} chars`,
          ]}
        />
      </Panel>
      <p className={`px-1 text-xs ${strength.className}`}>Strength: {strength.label}</p>
    </div>
  );
}
