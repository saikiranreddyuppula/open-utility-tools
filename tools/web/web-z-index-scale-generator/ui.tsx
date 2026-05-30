'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Format = 'css' | 'sass' | 'js' | 'ts';

const DEFAULT_LAYERS = [
  'base',
  'dropdown',
  'sticky',
  'fixed',
  'modal-backdrop',
  'modal',
  'popover',
  'tooltip',
  'toast',
].join('\n');

interface Layer {
  name: string;
  value: number;
}

const FORMAT_EXT: Record<Format, string> = {
  css: 'z-index.css',
  sass: 'z-index.scss',
  js: 'z-index.js',
  ts: 'z-index.ts',
};

// Convert an arbitrary layer name into a valid identifier for JS/TS keys.
function toIdent(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!cleaned) return '_';
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

function parseLayers(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function buildOutput(
  layers: Layer[],
  format: Format,
  docComment: boolean,
): string {
  const header = docComment
    ? (() => {
        switch (format) {
          case 'css':
          case 'sass':
            return `/**\n * Z-index scale. Reference these tokens instead of magic numbers\n * so stacking order stays predictable across the codebase.\n */\n`;
          case 'js':
          case 'ts':
            return `/**\n * Z-index scale. Reference these tokens instead of magic numbers\n * so stacking order stays predictable across the codebase.\n */\n`;
          default:
            return '';
        }
      })()
    : '';

  switch (format) {
    case 'css': {
      const body = layers
        .map((l) => `  --z-${l.name}: ${l.value};`)
        .join('\n');
      return `${header}:root {\n${body}\n}`;
    }
    case 'sass': {
      const body = layers
        .map((l) => `  '${l.name}': ${l.value},`)
        .join('\n');
      return `${header}$z-index: (\n${body}\n);\n\n// Usage: z-index: map-get($z-index, 'modal');`;
    }
    case 'js': {
      const body = layers
        .map((l) => `  ${toIdent(l.name)}: ${l.value},`)
        .join('\n');
      return `${header}export const zIndex = {\n${body}\n};`;
    }
    case 'ts': {
      const body = layers
        .map((l) => `  ${toIdent(l.name)}: ${l.value},`)
        .join('\n');
      return `${header}export const zIndex = {\n${body}\n} as const;\n\nexport type ZIndexLayer = keyof typeof zIndex;`;
    }
    default:
      return '';
  }
}

export default function ZIndexScaleGeneratorTool() {
  const [layersRaw, setLayersRaw] = useState(DEFAULT_LAYERS);
  const [start, setStart] = useState('10');
  const [step, setStep] = useState('10');
  const [reverse, setReverse] = useState(false);
  const [docComment, setDocComment] = useState(true);
  const [format, setFormat] = useState<Format>('css');

  const computed = useMemo<
    { error: string } | { layers: Layer[]; output: string }
  >(() => {
    const names = parseLayers(layersRaw);
    if (names.length === 0) {
      return { error: 'Enter at least one named layer (one per line).' };
    }
    if (names.length > 200) {
      return { error: 'Too many layers — keep it under 200.' };
    }
    const startN = Number(start);
    const stepN = Number(step);
    if (!Number.isFinite(startN)) {
      return { error: 'Starting value must be a number.' };
    }
    if (!Number.isFinite(stepN) || stepN === 0) {
      return { error: 'Step increment must be a non-zero number.' };
    }
    const seen = new Set<string>();
    for (const n of names) {
      if (seen.has(n)) {
        return { error: `Duplicate layer name: "${n}".` };
      }
      seen.add(n);
    }

    const ordered = reverse ? [...names].reverse() : names;
    const layers: Layer[] = ordered.map((name, i) => ({
      name,
      value: Math.round(startN + i * stepN),
    }));
    const output = buildOutput(layers, format, docComment);
    return { layers, output };
  }, [layersRaw, start, step, reverse, docComment, format]);

  const hasError = 'error' in computed;
  const output = hasError ? '' : computed.output;
  const layers = hasError ? [] : computed.layers;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="css">CSS custom properties</SelectItem>
                <SelectItem value="sass">Sass $z-index map</SelectItem>
                <SelectItem value="js">JS const object</SelectItem>
                <SelectItem value="ts">TS const (as const)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start value">
            <Input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Step">
            <Input
              value={step}
              onChange={(e) => setStep(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Reverse order">
            <Switch checked={reverse} onCheckedChange={setReverse} />
          </Field>
          <Field label="Doc comment">
            <Switch checked={docComment} onCheckedChange={setDocComment} />
          </Field>
        </OptionsBar>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Named layers (bottom to top)" />
          <div className="p-3">
            <Textarea
              value={layersRaw}
              onChange={(e) => setLayersRaw(e.target.value)}
              spellCheck={false}
              rows={12}
              className="font-mono text-sm"
              placeholder="One layer name per line"
            />
            <p className="mt-2 text-2xs text-muted-foreground">
              First line is the lowest layer. Enable “Reverse order” to assign
              the highest value to the first line instead.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Output">
            <CopyButton value={() => output} label="Copy" disabled={!output} />
            <DownloadButton
              data={() => output}
              filename={FORMAT_EXT[format]}
              disabled={!output}
            />
          </PanelHeader>
          {hasError ? (
            <div className="p-3">
              <ErrorBanner error={computed.error} />
            </div>
          ) : (
            <>
              <pre className="max-h-[420px] overflow-auto bg-muted/30 p-3 font-mono text-xs leading-relaxed">
                {output}
              </pre>
              <StatBar
                items={[
                  `${layers.length} layers`,
                  `${layers[0]?.value ?? 0} – ${layers[layers.length - 1]?.value ?? 0}`,
                  reverse ? 'reversed' : 'ascending',
                ]}
              />
            </>
          )}
        </Panel>
      </div>

      {!hasError && (
        <Panel>
          <PanelHeader title="Assigned values" />
          <div className="max-h-[280px] divide-y overflow-auto">
            {layers.map((l) => (
              <div key={l.name} className="flex items-center gap-3 px-3 py-1.5">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {l.name}
                </code>
                <code className="w-20 shrink-0 text-right font-mono text-sm tabular">
                  {l.value}
                </code>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
