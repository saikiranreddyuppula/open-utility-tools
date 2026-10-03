'use client';

import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, SlidersHorizontal, Upload, XCircle } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  LINT_RULES,
  formatYaml,
  lintYaml,
  normalizeYamlSource,
  parseYaml,
  parsedToValues,
  sourceSnippet,
  streamToJson,
  verifyFormat,
  type FormatOptions,
  type YamlDocument,
  type YamlIssue,
} from './logic';

const MAX_CHARS = 2_000_000;

const SAMPLES: { id: string; label: string; text: string }[] = [
  {
    id: 'actions',
    label: 'GitHub Actions workflow',
    text: `name: CI
on:
  push:
    branches: [ main, 'release/**' ]
  pull_request:
    types: [opened, synchronize]

env:
  PYTHON_VERSION: 3.10   # becomes 3.1 !
  FAIL_FAST: no

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - name: Setup node
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
      # run the suite
      - name: Run tests
        run: |
          npm ci
          npm test -- --coverage
        env:
          CI: 'true'
`,
  },
  {
    id: 'k8s',
    label: 'Kubernetes manifests (2 documents)',
    text: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels: {app: web, tier: frontend}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: nginx
          image: "nginx:1.25"
          ports:
          - containerPort: 80
          env:
            - {name: LOG_LEVEL, value: info}
            - name: MODE
              value: 0755   # file mode?
          args: ["--port=80",
                 "--verbose"]
          resources:
            limits: {cpu: 500m, memory: 128Mi}
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
`,
  },
  {
    id: 'compose',
    label: 'docker-compose with anchors & merge keys',
    text: `x-common: &common
  restart: unless-stopped
  logging:
    driver: json-file
    options: {max-size: "10m"}

services:
  app:
    <<: *common
    image: myapp:latest
    ports: ["8080:80"]
    environment:
      DEBUG: "false"
      TIMEOUT: 1:30
    depends_on: [db]
  db:
    <<: *common
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: example
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
`,
  },
  {
    id: 'broken',
    label: 'Broken YAML (see the error reports)',
    text: `name: broken example
items:
  - one
  - two:
      nested: 1
     misaligned: 2
settings:
	tabbed: true
text: "never closed
alias: *nowhere
list: [1, 2
last: value
`,
  },
];

type OutTab = 'formatted' | 'json';

const DEFAULTS: FormatOptions = {
  indent: 2,
  seqIndent: 'indented',
  sortKeys: false,
  quote: 'preserve',
  quoteKeys: false,
  width: 80,
  comments: true,
  blockMultiline: true,
};

const ALL_RULE_IDS = LINT_RULES.map((r) => r.id);

function describeRoot(doc: YamlDocument): string {
  const r = doc.root;
  if (!r) return 'empty';
  if (r.type === 'map') return `mapping · ${r.pairs.length} key${r.pairs.length === 1 ? '' : 's'}`;
  if (r.type === 'seq') return `sequence · ${r.items.length} item${r.items.length === 1 ? '' : 's'}`;
  if (r.type === 'alias') return 'alias';
  return 'scalar';
}

/* ---------------- line-numbered editor ---------------- */

interface Marker {
  line: number;
  level: 'error' | 'warning' | 'info';
}

function LineEditor({
  value,
  onChange,
  markers,
  textareaRef,
  onDropText,
}: {
  value: string;
  onChange: (v: string) => void;
  markers: Marker[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onDropText: (file: File) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const lineCount = useMemo(() => {
    let n = 1;
    for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 10) n++;
    return n;
  }, [value]);
  const numbers = useMemo(() => {
    const parts: string[] = [];
    for (let i = 1; i <= lineCount; i++) parts.push(String(i));
    return parts.join('\n');
  }, [lineCount]);
  const worst = useMemo(() => {
    const m = new Map<number, Marker['level']>();
    const rank = { error: 3, warning: 2, info: 1 } as const;
    for (const k of markers) {
      const prev = m.get(k.line);
      if (!prev || rank[k.level] > rank[prev]) m.set(k.line, k.level);
    }
    return [...m.entries()].slice(0, 400);
  }, [markers]);
  const gutterW = `${Math.max(2, String(lineCount).length) + 1.6}ch`;

  return (
    <div
      className="relative flex h-[28rem] overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const f = e.dataTransfer.files[0];
        if (f) {
          e.preventDefault();
          onDropText(f);
        }
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none relative shrink-0 select-none overflow-hidden border-r bg-muted/40 text-right font-mono text-xs leading-5 text-muted-foreground"
        style={{ width: gutterW }}
      >
        <div style={{ transform: `translateY(${-scrollTop}px)` }} className="relative px-1.5 pt-2">
          <pre className="m-0 font-mono">{numbers}</pre>
          {worst.map(([line, level]) => (
            <span
              key={line}
              className={cn(
                'absolute left-0 w-1 rounded-r-sm',
                level === 'error' ? 'bg-destructive' : level === 'warning' ? 'bg-warning' : 'bg-muted-foreground/50'
              )}
              style={{ top: `calc(0.5rem + ${(line - 1) * 1.25}rem)`, height: '1.25rem' }}
            />
          ))}
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-label="YAML input"
        placeholder="Paste YAML here, or drop a .yaml file…"
        className="field-sizing-fixed h-full flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  );
}

/* ---------------- main component ---------------- */

export default function YamlValidatorFormatterTool() {
  const [input, setInput] = useState(SAMPLES[0]?.text ?? '');
  const [opts, setOpts] = useState<FormatOptions>(DEFAULTS);
  const [tab, setTab] = useState<OutTab>('formatted');
  const [jsonIndent, setJsonIndent] = useState('2');
  const [merge, setMerge] = useState(true);
  const [enabled, setEnabled] = useState<string[]>(ALL_RULE_IDS);
  const [showRules, setShowRules] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const deferred = useDeferredValue(input);
  const stale = deferred !== input;
  const tooBig = deferred.length > MAX_CHARS;

  const parsed = useMemo(() => (tooBig ? null : parseYaml(deferred)), [deferred, tooBig]);
  const conv = useMemo(() => (parsed ? parsedToValues(parsed, { merge }) : null), [parsed, merge]);

  const errors: YamlIssue[] = useMemo(() => {
    if (!parsed || !conv) return [];
    return [...parsed.errors, ...conv.errors].sort((a, b) => a.offset - b.offset);
  }, [parsed, conv]);
  const valid = parsed !== null && errors.length === 0;

  const enabledSet = useMemo(() => new Set(enabled), [enabled]);
  const lintAll = useMemo(() => (parsed ? lintYaml(parsed) : []), [parsed]);
  const lint = useMemo(() => lintAll.filter((i) => enabledSet.has(i.rule)), [lintAll, enabledSet]);
  const lintCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of lintAll) m.set(i.rule, (m.get(i.rule) ?? 0) + 1);
    return m;
  }, [lintAll]);

  const formatted = useMemo(() => {
    if (!parsed || !valid) return null;
    const f = formatYaml(parsed, opts);
    const v = verifyFormat(parsed, f.text);
    return { ...f, verified: v };
  }, [parsed, valid, opts]);

  const json = useMemo(() => {
    if (!conv || !valid) return null;
    try {
      const indent = jsonIndent === 'min' ? 0 : jsonIndent === 'tab' ? 2 : Number(jsonIndent);
      const r = streamToJson(conv.values, Number.isFinite(indent) ? indent : 2);
      const text = jsonIndent === 'tab' ? r.text.replace(/^( +)/gm, (m) => '\t'.repeat(m.length / 2)) : r.text;
      return { text, nonFinite: r.nonFinite, error: null as string | null };
    } catch (e) {
      return { text: '', nonFinite: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }, [conv, valid, jsonIndent]);

  const markers: Marker[] = useMemo(
    () => [
      ...errors.map((e) => ({ line: e.line, level: 'error' as const })),
      ...lint.map((l) => ({ line: l.line, level: l.level === 'info' ? ('info' as const) : ('warning' as const) })),
    ],
    [errors, lint]
  );

  const warnCount = lint.filter((l) => l.level === 'warning').length;
  const infoCount = lint.length - warnCount;
  const lineCount = useMemo(() => (parsed ? parsed.source.split('\n').length : 0), [parsed]);

  const jump = useCallback((offset: number) => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    const end = Math.min(ta.value.length, offset + 1);
    ta.setSelectionRange(Math.min(offset, ta.value.length), end);
    const before = ta.value.slice(0, offset);
    let line = 0;
    for (let i = 0; i < before.length; i++) if (before.charCodeAt(i) === 10) line++;
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (line - 3) * lh);
  }, []);

  const loadFile = useCallback(async (file: File) => {
    setLoadError(null);
    if (file.size > MAX_CHARS * 2) {
      setLoadError(`"${file.name}" is ${(file.size / 1e6).toFixed(1)} MB. The editor handles up to about 2 MB of YAML.`);
      return;
    }
    try {
      const text = normalizeYamlSource(await file.text());
      if (text.length > MAX_CHARS) {
        setLoadError(`"${file.name}" has ${text.length.toLocaleString()} characters; the limit is ${MAX_CHARS.toLocaleString()}.`);
        return;
      }
      setInput(text);
    } catch {
      setLoadError(`Could not read "${file.name}".`);
    }
  }, []);

  const setOpt = <K extends keyof FormatOptions>(key: K, value: FormatOptions[K]) => setOpts((o) => ({ ...o, [key]: value }));
  const toggleRule = (id: string, on: boolean) => setEnabled((cur) => (on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id)));
  const styleHasQuotes = opts.quote === 'single' || opts.quote === 'double';

  return (
    <div className="flex flex-col gap-3">
      {/* status */}
      <div
        role="status"
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2',
          tooBig || stale
            ? 'bg-muted/40'
            : valid
              ? 'border-success/30 bg-success/10'
              : 'border-destructive/30 bg-destructive/10'
        )}
      >
        {tooBig ? (
          <>
            <XCircle className="size-4 text-destructive" />
            <span className="text-sm font-medium">Input is too large ({deferred.length.toLocaleString()} characters; limit {MAX_CHARS.toLocaleString()}).</span>
          </>
        ) : !parsed ? null : valid ? (
          <>
            <CheckCircle2 className="size-4 text-success" />
            <span className="text-sm font-semibold">Valid YAML</span>
            <span className="text-sm text-muted-foreground">
              {parsed.docs.length === 0
                ? 'no documents (empty or comments only)'
                : `${parsed.docs.length} document${parsed.docs.length === 1 ? '' : 's'}`}
            </span>
          </>
        ) : (
          <>
            <XCircle className="size-4 text-destructive" />
            <span className="text-sm font-semibold">Invalid YAML</span>
            <span className="text-sm text-muted-foreground">
              {errors.length} error{errors.length === 1 ? '' : 's'}
              {parsed.docs.length > 0 ? ` · ${parsed.docs.length} document${parsed.docs.length === 1 ? '' : 's'} found` : ''}
            </span>
          </>
        )}
        {parsed && !tooBig && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {warnCount > 0 && (
              <Badge variant="outline" className="border-warning/50 text-warning">
                <AlertTriangle /> {warnCount} warning{warnCount === 1 ? '' : 's'}
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="muted">
                <Info /> {infoCount} note{infoCount === 1 ? '' : 's'}
              </Badge>
            )}
            {stale && (
              <Badge variant="muted">
                <Loader2 className="animate-spin" /> checking…
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* formatting options */}
      <OptionsBar>
        <Field label="Indent">
          <Select value={String(opts.indent)} onValueChange={(v) => setOpt('indent', Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 spaces</SelectItem>
              <SelectItem value="3">3 spaces</SelectItem>
              <SelectItem value="4">4 spaces</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Lists">
          <Select value={opts.seqIndent} onValueChange={(v) => setOpt('seqIndent', v as FormatOptions['seqIndent'])}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="indented">Indented under key</SelectItem>
              <SelectItem value="compact">Not indented</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quotes">
          <Select value={opts.quote} onValueChange={(v) => setOpt('quote', v as FormatOptions['quote'])}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="preserve">Keep as written</SelectItem>
              <SelectItem value="minimal">Minimal (only if needed)</SelectItem>
              <SelectItem value="single">Single quotes</SelectItem>
              <SelectItem value="double">Double quotes</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Wrap at">
          <Select value={String(opts.width)} onValueChange={(v) => setOpt('width', Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Never</SelectItem>
              <SelectItem value="60">60</SelectItem>
              <SelectItem value="80">80</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="120">120</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Sort keys">
          <Switch checked={opts.sortKeys} onCheckedChange={(c) => setOpt('sortKeys', c)} aria-label="Sort keys A to Z" />
        </Field>
        <Field label="Keep comments">
          <Switch checked={opts.comments} onCheckedChange={(c) => setOpt('comments', c)} aria-label="Keep comments" />
        </Field>
        <Field label="Multi-line as |">
          <Switch checked={opts.blockMultiline} onCheckedChange={(c) => setOpt('blockMultiline', c)} aria-label="Write multi-line strings as block scalars" />
        </Field>
        {styleHasQuotes && (
          <Field label="Quote keys">
            <Switch checked={opts.quoteKeys} onCheckedChange={(c) => setOpt('quoteKeys', c)} aria-label="Apply quotes to keys" />
          </Field>
        )}
      </OptionsBar>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {/* ---------- input + issues ---------- */}
        <div className="flex min-w-0 flex-col gap-3">
          <Panel>
            <PanelHeader title="YAML input">
              <select
                aria-label="Load a sample"
                className="h-7 max-w-[13rem] rounded-md border bg-background px-1.5 text-xs"
                value=""
                onChange={(e) => {
                  const s = SAMPLES.find((x) => x.id === e.target.value);
                  if (s) {
                    setInput(s.text);
                    setLoadError(null);
                  }
                }}
              >
                <option value="">Load sample…</option>
                {SAMPLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" /> Open
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".yaml,.yml,.txt,text/*,application/x-yaml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadFile(f);
                  e.target.value = '';
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => setInput('')} disabled={input === ''}>
                Clear
              </Button>
            </PanelHeader>
            <LineEditor value={input} onChange={setInput} markers={markers} textareaRef={taRef} onDropText={(f) => void loadFile(f)} />
            <StatBar
              items={[
                `${lineCount.toLocaleString()} lines`,
                `${input.length.toLocaleString()} chars`,
                parsed && parsed.docs.length > 0 ? parsed.docs.map((d, i) => `doc ${i + 1}: ${describeRoot(d)}`).slice(0, 3).join(' · ') + (parsed.docs.length > 3 ? ` · +${parsed.docs.length - 3} more` : '') : null,
              ]}
            />
          </Panel>
          <ErrorBanner error={loadError} />

          {errors.length > 0 && (
            <Panel>
              <PanelHeader title={`Errors (${errors.length})`} />
              <ul className="max-h-[26rem] divide-y overflow-auto">
                {errors.map((e, i) => (
                  <li key={`${e.offset}-${i}`}>
                    <button
                      type="button"
                      onClick={() => jump(e.offset)}
                      className="block w-full px-3 py-2 text-left hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                    >
                      <div className="flex items-start gap-2">
                        <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="destructive" className="font-mono">
                              {e.line}:{e.col}
                            </Badge>
                            <span className="text-xs">{e.message}</span>
                          </div>
                          <pre className="mt-1.5 overflow-x-auto rounded border bg-muted/40 px-2 py-1 font-mono text-2xs leading-4 text-muted-foreground">
                            {sourceSnippet(parsed?.source ?? '', e.line, e.col)}
                          </pre>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel>
            <PanelHeader title={`Lint (${lint.length})`}>
              <Button variant="ghost" size="sm" onClick={() => setShowRules((s) => !s)} aria-expanded={showRules}>
                <SlidersHorizontal className="size-3.5" /> Rules {enabled.length}/{ALL_RULE_IDS.length}
              </Button>
            </PanelHeader>
            {showRules && (
              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-b bg-muted/20 p-3 sm:grid-cols-2">
                {LINT_RULES.map((r) => {
                  const n = lintCounts.get(r.id) ?? 0;
                  return (
                    <label key={r.id} className="flex cursor-pointer items-start gap-2 text-xs" title={r.description}>
                      <Checkbox checked={enabledSet.has(r.id)} onCheckedChange={(c) => toggleRule(r.id, c === true)} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{r.label}</span>
                        {n > 0 && <span className="ml-1.5 font-mono text-2xs text-muted-foreground">({n})</span>}
                        <span className="block text-2xs text-muted-foreground">{r.description}</span>
                      </span>
                    </label>
                  );
                })}
                <div className="flex gap-2 sm:col-span-2">
                  <Button variant="outline" size="sm" onClick={() => setEnabled(ALL_RULE_IDS)}>
                    All on
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEnabled([])}>
                    All off
                  </Button>
                </div>
              </div>
            )}
            {lint.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                {parsed === null
                  ? ''
                  : errors.length > 0
                    ? 'Syntax errors are shown above. Lint results appear below as far as the document could be read.'
                    : enabled.length === 0
                      ? 'All lint rules are switched off.'
                      : 'No lint warnings. The file follows the checks above.'}
              </p>
            ) : (
              <ul className="max-h-[26rem] divide-y overflow-auto">
                {lint.map((l, i) => (
                  <li key={`${l.rule}-${l.offset}-${i}`}>
                    <button
                      type="button"
                      onClick={() => jump(l.offset)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                    >
                      {l.level === 'warning' ? (
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      ) : (
                        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="muted" className="font-mono">
                            {l.line}:{l.col}
                          </Badge>
                          <span className="font-mono text-2xs text-muted-foreground">{l.rule}</span>
                        </span>
                        <span className="mt-0.5 block text-xs">{l.message}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ---------- output ---------- */}
        <Panel className="min-w-0">
          <PanelHeader>
            <Tabs value={tab} onValueChange={(v) => setTab(v as OutTab)} className="mr-auto">
              <TabsList className="h-7">
                <TabsTrigger value="formatted" className="h-6">
                  Formatted YAML
                </TabsTrigger>
                <TabsTrigger value="json" className="h-6">
                  JSON
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {tab === 'json' && (
              <select
                aria-label="JSON indentation"
                className="h-7 rounded-md border bg-background px-1.5 text-xs"
                value={jsonIndent}
                onChange={(e) => setJsonIndent(e.target.value)}
              >
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
                <option value="tab">Tab</option>
                <option value="min">Minified</option>
              </select>
            )}
            {tab === 'json' ? (
              <>
                <CopyButton value={() => json?.text ?? ''} disabled={!json || json.error !== null} />
                <DownloadButton data={() => json?.text ?? ''} filename="parsed.json" mime="application/json" disabled={!json || json.error !== null} />
              </>
            ) : (
              <>
                <CopyButton value={() => formatted?.text ?? ''} disabled={!formatted} />
                <DownloadButton data={() => formatted?.text ?? ''} filename="formatted.yaml" mime="text/yaml" disabled={!formatted} />
              </>
            )}
          </PanelHeader>

          {tab === 'formatted' ? (
            formatted ? (
              <>
                <Textarea
                  readOnly
                  value={formatted.text}
                  wrap="off"
                  spellCheck={false}
                  aria-label="Formatted YAML"
                  className="field-sizing-fixed h-full flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <div className="flex flex-col gap-1 border-t px-3 py-2 text-2xs">
                  {formatted.verified.ok ? (
                    <span className="flex items-center gap-1.5 text-success">
                      <CheckCircle2 className="size-3.5" /> Output re-parses to exactly the same data as the input.
                    </span>
                  ) : (
                    <span className="flex items-start gap-1.5 text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {formatted.verified.message}
                    </span>
                  )}
                  {opts.comments && formatted.totalComments > formatted.emittedComments && (
                    <span className="flex items-start gap-1.5 text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {formatted.totalComments - formatted.emittedComments} comment
                      {formatted.totalComments - formatted.emittedComments === 1 ? '' : 's'} could not be kept (comments inside [ ] or {'{ }'} flow collections are dropped).
                    </span>
                  )}
                  {!opts.comments && formatted.totalComments > 0 && (
                    <span className="flex items-start gap-1.5 text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" /> {formatted.totalComments} comment{formatted.totalComments === 1 ? '' : 's'} removed (comments are switched off).
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-[28rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
                {tooBig ? 'Input is too large.' : errors.length > 0 ? `Fix the ${errors.length} error${errors.length === 1 ? '' : 's'} to see the formatted YAML.` : 'Nothing to format yet.'}
              </div>
            )
          ) : json ? (
            json.error ? (
              <div className="p-3">
                <ErrorBanner error={json.error} />
              </div>
            ) : (
              <>
                <Textarea
                  readOnly
                  value={json.text}
                  wrap="off"
                  spellCheck={false}
                  aria-label="Parsed JSON"
                  className="field-sizing-fixed h-full flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <div className="flex flex-col gap-1.5 border-t px-3 py-2">
                  <label className="flex items-center gap-2 text-2xs">
                    <Switch checked={merge} onCheckedChange={setMerge} aria-label="Resolve merge keys" />
                    Resolve merge keys (&lt;&lt;: *alias)
                  </label>
                  {conv && conv.values.length > 1 && (
                    <span className="text-2xs text-muted-foreground">{conv.values.length} documents are shown as a JSON array.</span>
                  )}
                  {json.nonFinite > 0 && (
                    <span className="text-2xs text-warning">
                      {json.nonFinite} non-finite number{json.nonFinite === 1 ? '' : 's'} (.inf / .nan) became null; JSON cannot represent them.
                    </span>
                  )}
                </div>
              </>
            )
          ) : (
            <div className="flex h-[28rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {tooBig ? 'Input is too large.' : errors.length > 0 ? `Fix the ${errors.length} error${errors.length === 1 ? '' : 's'} to see the parsed JSON.` : 'Nothing to convert yet.'}
            </div>
          )}
          <StatBar
            items={[
              tab === 'formatted' && formatted ? `${formatted.text.split('\n').length - 1} lines` : null,
              tab === 'json' && json && !json.error ? `${json.text.length.toLocaleString()} chars` : null,
              'YAML 1.2 core schema',
            ]}
          />
        </Panel>
      </div>

      <p className="text-2xs text-muted-foreground">
        Parsing follows the YAML 1.2 core schema: <code className="font-mono">yes</code>, <code className="font-mono">no</code>, <code className="font-mono">on</code> and{' '}
        <code className="font-mono">off</code> are plain strings, as are dates; the lint rules warn where older YAML 1.1 parsers (PyYAML, Ruby, Go yaml.v2) would disagree. Formatting keeps
        anchors, aliases, tags and comments, but comments inside <code className="font-mono">[ ]</code>/<code className="font-mono">{'{ }'}</code> collections are dropped. Everything runs in
        your browser.
      </p>
    </div>
  );
}
