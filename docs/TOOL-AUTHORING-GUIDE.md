# Tool Authoring Guide (for implementation agents)

You implement self-contained client-side utility tools for a Next.js **static-export** app.
Everything runs in the browser. **No network. No server. No new npm dependencies.**

The build is **strict**: `tsc --noEmit` and `next build` run with `strict: true`,
`noUncheckedIndexedAccess: true`, `noFallthroughCasesInSwitch: true`, and
`typescript.ignoreBuildErrors: false`. **Any type error fails the whole build.** Your
code must compile cleanly the first time.

## 1. File layout (per tool — exactly two files)

```
tools/<category>/<slug>/tool.config.ts   # static metadata (default export)
tools/<category>/<slug>/ui.tsx           # the React component (default export)
```

- `<category>` is one of: `image pdf data convert text crypto encoding generators web time math color`
- `<slug>` is the unique kebab-case slug given in your assignment. Do **not** invent or change it.
- Create the folders; do not touch any other files. Never edit the registry, icon.tsx, or shared components.
- A build step scans these folders automatically — there is no central list to edit.

## 2. `tool.config.ts` — exact shape

```ts
import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: '<category>-<slug>-v1',
  name: 'Human Readable Name',
  slug: '<slug>',
  description: 'One clear sentence describing what the tool does and its value.',
  category: '<category>',
  tags: ['three', 'to', 'six', 'tags'],
  keywords: ['search', 'synonyms', 'aliases'],
  icon: 'IconName',
  relatedTools: [],
};

export default meta;
```

- `id` MUST be exactly `<category>-<slug>-v1`. `slug` MUST equal the folder name.
- `category` MUST equal `<category>`.
- `icon` MUST be one of the names registered in `components/icon.tsx` (the `ICONS` map — 301 valid lucide names). Pick a fitting one. An unlisted name silently renders a wrench — do not risk it.
- `relatedTools` MUST be `[]` (empty). Do not reference other slugs.
- Keep `description` to one sentence. No trailing period is fine either way.

## 3. `ui.tsx` — rules

- First line MUST be `'use client';`.
- MUST `export default` a React component (no props).
- Pure browser code only. Allowed Web APIs: `crypto`/`crypto.subtle`, `TextEncoder`/`TextDecoder`,
  `URL`, `Intl`, `atob`/`btoa`, `structuredClone`, `<canvas>`, `FileReader`, `URL.createObjectURL`.
- **Never** import a package other than the allowlist in §4. No `fs`, no Node APIs, no `fetch` to a network.
- Access `crypto` via `const wc = (globalThis as unknown as { crypto: Crypto }).crypto;` (the bare global `crypto` type resolves to `never` under @types/node).
- Keep each tool self-contained: all logic lives inside its own `ui.tsx`. Do NOT create shared files.

### Strict-TS survival rules (these cause most failures — follow exactly)

- `noUncheckedIndexedAccess` is ON: `arr[i]`, `obj[key]`, `str[i]`, regex `match[1]`, and `.split()[n]`
  are all `T | undefined`. Guard or default them: `const x = arr[i] ?? fallback;` or `if (!row) continue;`.
- `String.prototype.at()` and `Array.prototype.at()` also return `T | undefined`.
- `switch` statements: every `case` must `return`/`break`/`throw` — no fallthrough. Prefer exhaustive returns.
- Never use `any` implicitly. Type `useState` generics, function params, and array literals.
- For `parseInt`/`Number`, check `Number.isFinite(...)` / `Number.isNaN(...)` before use.
- When mapping over `Object.entries(x)`, the value is typed; annotate `x` if it's parsed JSON (`as Record<string, unknown>`).
- Don't leave unused imports/vars (eslint is not the build gate, but keep it clean).
- **Union return narrowing:** when a `useMemo`/function returns `{ error: string } | { value: T }`, narrow with BOTH the `in` check AND truthiness, e.g. `'value' in r && r.value ? r.value.join('\n') : ''` (a bare `'value' in r` can still leave it `T | undefined`). Or use a discriminated union with a literal `kind`/`ok` field and check that.
- **Blob from bytes:** TS's `BlobPart` wants `Uint8Array<ArrayBuffer>`, so a generic `Uint8Array` fails. Write `new Blob([bytes as unknown as BlobPart], { type })`.
- **WebCrypto byte args:** pass message bytes as `data as unknown as ArrayBuffer` to `wc.subtle.digest/sign/verify`, and key/salt/info material as `bytesVar as BufferSource` to `importKey`/`deriveBits` (matches existing crypto tools). Don't compare a narrowed union value against a literal that isn't in its type (dead `else if` branches cause TS2367 — delete unreachable branches).

## 4. Allowed imports (the ONLY modules you may import)

```ts
// React
import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';

// Shared tool layouts & widgets
import { TextToolLayout } from '@/components/tools/text-tool';
import { GeneratorList } from '@/components/tools/generator-list';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';

// shadcn/ui primitives
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Utilities
import { cn } from '@/lib/utils';

// Any real lucide-react icon may be imported for INLINE JSX use (e.g. button icons):
import { Upload, Plus, X, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
```

Component prop notes:
- `<Input value={s} onChange={(e) => setS(e.target.value)} />` — controlled string. Use `type="number"`/`inputMode="decimal"` as needed.
- `<Textarea value={s} onChange={(e) => setS(e.target.value)} spellCheck={false} />`.
- `<Button variant="default|secondary|outline|ghost|destructive|link" size="sm|default|lg|icon|icon-sm" onClick={...}>`.
- `<Slider value={[n]} min={0} max={10} step={1} onValueChange={(v) => setN(v[0] ?? 0)} />` (value is `number[]`).
- `<Switch checked={b} onCheckedChange={setB} />`, `<Checkbox checked={b} onCheckedChange={(c) => setB(c === true)} />`.
- `<Tabs value={v} onValueChange={(x) => setV(x as MyType)}>` with `<TabsList><TabsTrigger value="...">…</TabsTrigger></TabsList>`.
- `<Select value={v} onValueChange={(x) => setV(x as MyType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">A</SelectItem></SelectContent></Select>`.
- `<CopyButton value={() => text} />` or `<CopyButton value={text} size="icon-sm" />`.
- `<DownloadButton data={() => text} filename="x.txt" />`.
- `<ErrorBanner error={errOrNull} />` (renders nothing when null).

`TextToolLayout` already wraps your `options` node in an OptionsBar — pass bare `<Field>` elements, do not add your own `OptionsBar` there. For self-built layouts (templates B/C/D/E), use `<OptionsBar>` yourself.

## 5. The five canonical templates — pick the closest, copy, adapt

### Template A — Text transform (encoders, formatters, line/case/string ops)

```tsx
'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'encode' | 'decode';

export default function ExampleTool() {
  const [mode, setMode] = useState<Mode>('encode');

  return (
    <TextToolLayout
      deps={[mode]}
      transform={(input) => {
        if (!input) return '';
        // Throw to show an error banner:
        // if (bad) throw new Error('Explain what is wrong');
        return mode === 'encode' ? input.toUpperCase() : input.toLowerCase();
      }}
      inputLabel="Input"
      outputLabel="Result"
      sample="Sample text"
      downloadName="output.txt"
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="encode">Encode</TabsTrigger>
              <TabsTrigger value="decode">Decode</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
```

### Template B — Calculator / multi-output converter

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

export default function ExampleCalc() {
  const [a, setA] = useState('10');
  const [b, setB] = useState('3');

  const result = useMemo(() => {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: 'Enter valid numbers.' };
    if (y === 0) return { error: 'Divisor cannot be zero.' };
    return { rows: [
      { label: 'Sum', value: (x + y).toString() },
      { label: 'Quotient', value: (x / y).toFixed(4) },
    ] };
  }, [a, b]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="A"><Input value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" /></Field>
          <Field label="B"><Input value={b} onChange={(e) => setB(e.target.value)} inputMode="decimal" /></Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`A = ${a}`, `B = ${b}`]} />
        </Panel>
      )}
    </div>
  );
}
```

### Template C — Reference / lookup table (cheatsheets, code lists)

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';

interface Row { name: string; value: string; desc: string }

const DATA: Row[] = [
  { name: '200', value: 'OK', desc: 'Request succeeded' },
  { name: '404', value: 'Not Found', desc: 'Resource does not exist' },
];

export default function ExampleReference() {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DATA;
    return DATA.filter((d) => `${d.name} ${d.value} ${d.desc}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <Panel>
      <PanelHeader title="Reference">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-7 w-48" />
      </PanelHeader>
      <div className="max-h-[480px] divide-y overflow-auto">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3 px-3 py-2">
            <code className="w-20 shrink-0 font-mono text-xs">{r.name}</code>
            <span className="w-40 shrink-0 text-sm">{r.value}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{r.desc}</span>
            <CopyButton value={`${r.name} ${r.value}`} size="icon-sm" />
          </div>
        ))}
      </div>
      <StatBar items={[`${rows.length} of ${DATA.length}`]} />
    </Panel>
  );
}
```

### Template D — Generator (random/data generators)

```tsx
'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Slider } from '@/components/ui/slider';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

export default function ExampleGenerator() {
  const [len, setLen] = useState(12);
  const gen = () => {
    const bytes = new Uint8Array(len);
    wc.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  };
  return (
    <GeneratorList
      generate={gen}
      deps={[len]}
      downloadName="generated.txt"
      label="Output"
      options={
        <Field label={`Length: ${len}`} className="min-w-[220px] flex-1">
          <Slider value={[len]} min={1} max={64} step={1} onValueChange={(v) => setLen(v[0] ?? 12)} />
        </Field>
      }
    />
  );
}
```

### Template E — Canvas image tool (resize/crop/filter/convert — pure browser, no WASM)

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ErrorBanner } from '@/components/tools/error-banner';

export default function ExampleImageTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(50);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback((dataUrl: string, pct: number) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.naturalWidth * pct) / 100));
      canvas.height = Math.max(1, Math.round((img.naturalHeight * pct) / 100));
      const ctx = canvas.getContext('2d');
      if (!ctx) { setError('Canvas not supported.'); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setOutUrl(canvas.toDataURL('image/png'));
    };
    img.onerror = () => setError('Could not load image.');
    img.src = dataUrl;
  }, []);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url) { setError('Could not read file.'); return; }
      setSrc(url);
      process(url, scale);
    };
    reader.readAsDataURL(file);
  }, [process, scale]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload image
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          <Field label={`Scale: ${scale}%`} className="min-w-[200px]">
            <Slider value={[scale]} min={1} max={200} step={1}
              onValueChange={(v) => { const p = v[0] ?? 50; setScale(p); if (src) process(src, p); }} />
          </Field>
        </OptionsBar>
      </Panel>
      <ErrorBanner error={error} />
      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="result" className="max-h-[420px] rounded border" />
            <a href={outUrl} download="image.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
```

## 6. Quality bar

- The tool must actually work and be genuinely useful — correct algorithm, sensible defaults, a prefilled
  sample where it helps, clear error messages on bad input.
- Use `useMemo` for derived results; never block the main thread with huge loops (cap inputs reasonably).
- Match the visual style of the templates (Panel/Field/StatBar, mono for code/values, muted labels).
- Re-read your code mentally against the strict-TS rules in §3 before finishing. If `arr[i]` could be
  undefined, you handled it. If a `switch` could fall through, you returned in every case.
- Do not add comments that merely restate code; a short note on non-obvious algorithms is welcome.

## 7. Output

Write both files for every assigned tool. Then your final message must be a short status line:
`DONE: <n> tools written: slug1, slug2, …` (or list any you intentionally skipped and why).
