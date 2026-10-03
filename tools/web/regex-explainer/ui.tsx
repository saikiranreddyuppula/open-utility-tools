'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  FLAG_INFO,
  analyze,
  buildSegments,
  nativeCheck,
  parseRegexInput,
  runMatches,
  treeToText,
  type ExplainNode,
  type MatchRequest,
  type MatchRun,
  type TokenKind,
} from './logic';

interface Example {
  id: string;
  label: string;
  pattern: string;
  flags: string;
  text: string;
}

const EXAMPLES: Example[] = [
  {
    id: 'date',
    label: 'ISO date (named groups)',
    pattern: '(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])',
    flags: 'g',
    text: 'Released 2024-03-15, patched 2024-04-02 (but 2024-13-45 is not a date).',
  },
  {
    id: 'email',
    label: 'Email address',
    pattern: '^[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+$',
    flags: 'gm',
    text: 'alice@example.com\nbob.smith+tag@mail.co.uk\nnot-an-email@\n@missing.com',
  },
  {
    id: 'url',
    label: 'URL',
    pattern: '\\bhttps?:\\/\\/(?:www\\.)?([-\\w.]+)(?::(\\d+))?(\\/[^\\s?#]*)?(?:\\?([^\\s#]*))?(?:#(\\S*))?',
    flags: 'gi',
    text: 'See https://www.example.com:8080/docs/intro?lang=en#top and http://localhost/health.',
  },
  {
    id: 'ipv4',
    label: 'IPv4 address',
    pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)\\b',
    flags: 'g',
    text: 'Hosts: 192.168.1.10, 10.0.0.256, 8.8.8.8 and 300.1.1.1',
  },
  {
    id: 'lookbehind',
    label: 'Lookbehind / lookahead',
    pattern: '(?<=\\$)\\d+(?:\\.\\d{2})?(?!\\d)|(?<![\\w.])\\d{3}(?=-)',
    flags: 'g',
    text: 'Total $42.50, tax $3, ref 555-1234, id a555-9',
  },
  {
    id: 'backref',
    label: 'Backreference (repeated word)',
    pattern: '\\b(?<word>\\w+)\\s+\\k<word>\\b',
    flags: 'gi',
    text: 'This is is a test of the the regex engine.',
  },
  {
    id: 'unicode',
    label: 'Unicode property escapes',
    pattern: '\\p{Lu}\\p{Ll}+|\\p{Script=Greek}+|\\p{Emoji_Presentation}',
    flags: 'gu',
    text: 'Hello Привет Ελληνικά 😀 world',
  },
  {
    id: 'vflag',
    label: 'v flag set operations',
    pattern: '[\\p{L}--[a-z]]+',
    flags: 'gv',
    text: 'abcDEF ghiJKL Ünï',
  },
  {
    id: 'nested',
    label: 'Nested quantifiers (ReDoS)',
    pattern: '^(\\w+\\s?)*$',
    flags: '',
    text: 'hello world foo',
  },
];

const KIND_STYLE: Record<TokenKind, { text: string; label: string }> = {
  literal: { text: 'text-foreground', label: 'literal' },
  escape: { text: 'text-amber-600 dark:text-amber-400', label: 'escape' },
  class: { text: 'text-emerald-600 dark:text-emerald-400', label: 'class / set' },
  group: { text: 'text-sky-600 dark:text-sky-400', label: 'group' },
  lookaround: { text: 'text-violet-600 dark:text-violet-400', label: 'lookaround' },
  quantifier: { text: 'text-rose-600 dark:text-rose-400', label: 'quantifier' },
  anchor: { text: 'text-fuchsia-600 dark:text-fuchsia-400', label: 'anchor' },
  alternation: { text: 'text-orange-600 dark:text-orange-400', label: 'alternation' },
  backref: { text: 'text-cyan-600 dark:text-cyan-400', label: 'backreference' },
  dot: { text: 'text-teal-600 dark:text-teal-400', label: 'any char' },
};

const FLAG_ORDER = ['d', 'g', 'i', 'm', 's', 'u', 'v', 'y'];
const MAX_PATTERN = 20000;
const MAX_TEST_CHARS = 200000;
const WORKER_TIMEOUT_MS = 2500;

interface Hover {
  start: number;
  end: number;
  id: number | null;
}

function flattenNodes(n: ExplainNode, into: Map<number, ExplainNode>): void {
  into.set(n.id, n);
  n.children.forEach((c) => flattenNodes(c, into));
}

function TreeRow({
  node, depth, hover, setHover,
}: {
  node: ExplainNode;
  depth: number;
  hover: Hover | null;
  setHover: (h: Hover | null) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasKids = node.children.length > 0;
  const active = hover?.id === node.id;
  const style = KIND_STYLE[node.kind];
  return (
    <div>
      <div
        className={cn(
          'group flex items-start gap-1.5 rounded-md px-1.5 py-1 transition-colors',
          active ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-muted/60'
        )}
        onMouseEnter={() => setHover({ start: node.start, end: node.end, id: node.id })}
        onMouseLeave={() => setHover(null)}
        data-testid="tree-row"
      >
        {hasKids ? (
          <button
            type="button"
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        <code
          className={cn(
            'max-w-[16rem] shrink-0 truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs',
            style.text
          )}
          title={node.code}
        >
          {node.code.length > 0 ? node.code : '∅'}
        </code>
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <span>{node.title}</span>
          {node.quantifier && (
            <span className="ml-1.5 inline-block rounded bg-rose-500/10 px-1.5 py-px text-xs font-medium text-rose-600 dark:text-rose-400">
              {node.quantifier}
            </span>
          )}
        </div>
      </div>
      {hasKids && open && (
        <div className="ml-[0.9rem] border-l pl-2.5">
          {node.children.map((c) => (
            <TreeRow key={c.id} node={c} depth={depth + 1} hover={hover} setHover={setHover} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegexExplainerTool() {
  const first = EXAMPLES[0] as Example;
  const [rawPattern, setRawPattern] = useState(first.pattern);
  const [flagsState, setFlagsState] = useState(first.flags);
  const [testText, setTestText] = useState(first.text);
  const [findAll, setFindAll] = useState(true);
  const [hover, setHover] = useState<Hover | null>(null);

  const parsedInput = useMemo(() => parseRegexInput(rawPattern), [rawPattern]);
  const pattern = parsedInput.pattern;
  const flags = parsedInput.flags ?? flagsState;
  const tooLong = pattern.length > MAX_PATTERN;

  const result = useMemo(() => (tooLong ? null : analyze(pattern, flags)), [pattern, flags, tooLong]);
  const native = useMemo(() => (tooLong ? null : nativeCheck(pattern, flags)), [pattern, flags, tooLong]);

  const nodes = useMemo(() => {
    const m = new Map<number, ExplainNode>();
    if (result?.ok) flattenNodes(result.tree, m);
    return m;
  }, [result]);

  const toggleFlag = (f: string) => {
    if (parsedInput.literal) return;
    setFlagsState((cur) => {
      if (cur.includes(f)) return cur.replace(f, '');
      let next = cur + f;
      if (f === 'u') next = next.replace('v', '');
      if (f === 'v') next = next.replace('u', '');
      return FLAG_ORDER.filter((x) => next.includes(x)).join('') + next.split('').filter((x) => !FLAG_ORDER.includes(x)).join('');
    });
  };

  const loadExample = (id: string) => {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setRawPattern(ex.pattern);
    setFlagsState(ex.flags);
    setTestText(ex.text);
    setHover(null);
  };

  // --- tester (runs in a worker so catastrophic patterns cannot freeze the page) ---
  const [run, setRun] = useState<MatchRun | null>(null);
  const [testState, setTestState] = useState<'idle' | 'running' | 'timeout'>('idle');
  const workerRef = useRef<Worker | null>(null);
  const urlRef = useRef<string | null>(null);
  const reqId = useRef(0);

  const killWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      killWorker();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [killWorker]);

  const testable = !tooLong && native === null && testText.length <= MAX_TEST_CHARS;

  useEffect(() => {
    if (!testable) {
      setRun(null);
      setTestState('idle');
      return;
    }
    const id = ++reqId.current;
    const req: MatchRequest = { pattern, flags, text: testText, max: 500, all: findAll };
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const debounce = setTimeout(() => {
      setTestState('running');
      let worker = workerRef.current;
      if (!worker) {
        try {
          const src = `var run=${runMatches.toString()};self.onmessage=function(e){self.postMessage({id:e.data.id,res:run(e.data.req)})};`;
          const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          worker = new Worker(url);
          workerRef.current = worker;
        } catch {
          worker = null;
        }
      }
      if (!worker) {
        // no worker support: run inline, bounded by the input caps
        setRun(runMatches(req));
        setTestState('idle');
        return;
      }
      const w = worker;
      w.onmessage = (e: MessageEvent<{ id: number; res: MatchRun }>) => {
        if (e.data.id !== reqId.current) return;
        if (timeout) clearTimeout(timeout);
        setRun(e.data.res);
        setTestState('idle');
      };
      w.onerror = () => {
        if (timeout) clearTimeout(timeout);
        killWorker();
        setRun(null);
        setTestState('idle');
      };
      timeout = setTimeout(() => {
        killWorker();
        setRun(null);
        setTestState('timeout');
      }, WORKER_TIMEOUT_MS);
      w.postMessage({ id, req });
    }, 200);
    return () => {
      clearTimeout(debounce);
      if (timeout) clearTimeout(timeout);
    };
  }, [pattern, flags, testText, findAll, testable, killWorker]);

  const segments = useMemo(() => (run ? buildSegments(testText, run.matches) : []), [run, testText]);

  // --- rendering helpers ---
  const inHover = (s: number, e: number) => hover !== null && s >= hover.start && e <= hover.end && hover.end > hover.start;

  const errorView = (() => {
    if (!result || result.ok) return null;
    const pos = Math.min(result.position, pattern.length);
    return (
      <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs" role="alert">
        <div className="flex items-start gap-2 font-mono text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-words">
            Syntax error{pattern.length > 0 ? ` at position ${pos}` : ''}: {result.error}
          </span>
        </div>
        {pattern.length > 0 && (
          <pre className="overflow-x-auto rounded bg-background/60 p-2 font-mono text-sm leading-tight">
            {pattern.slice(0, pos)}
            <span className="rounded-sm bg-destructive/30 text-destructive underline decoration-wavy">
              {pattern.slice(pos, pos + 1) || ' '}
            </span>
            {pattern.slice(pos + 1)}
          </pre>
        )}
        {native !== null ? (
          <p className="font-mono text-muted-foreground">Browser: {native}</p>
        ) : (
          <p className="text-muted-foreground">
            Your browser accepts this pattern, so this explainer&apos;s parser is stricter than it should be here. The tester below still uses the real RegExp.
          </p>
        )}
      </div>
    );
  })();

  const groupsList = result?.ok ? result.groups : [];
  const warnings = result?.ok ? result.warnings : [];
  const flagList = result?.flags ?? [];

  const literalText = `/${pattern}/${flags}`;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Regular expression">
          <Select value="" onValueChange={loadExample}>
            <SelectTrigger className="h-7 w-52 text-xs" aria-label="Load example">
              <SelectValue placeholder="Load an example…" />
            </SelectTrigger>
            <SelectContent>
              {EXAMPLES.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CopyButton value={literalText} label="Copy /re/" disabled={!pattern} />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[260px] flex-1 items-center gap-1 rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring/40">
              <span className="select-none font-mono text-lg text-muted-foreground">/</span>
              <Input
                value={rawPattern}
                onChange={(e) => setRawPattern(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                placeholder="pattern  — or paste /pattern/flags"
                aria-label="Regex pattern"
                className="h-10 border-0 bg-transparent px-1 font-mono text-base shadow-none focus-visible:ring-0"
              />
              <span className="select-none font-mono text-lg text-muted-foreground">/</span>
              <Input
                value={flags}
                onChange={(e) => setFlagsState(e.target.value)}
                disabled={parsedInput.literal}
                spellCheck={false}
                autoComplete="off"
                aria-label="Flags"
                placeholder="flags"
                className="h-10 w-20 border-0 bg-transparent px-1 font-mono text-base shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {FLAG_ORDER.map((f) => {
              const on = flags.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFlag(f)}
                  disabled={parsedInput.literal}
                  title={`${FLAG_INFO[f]?.name}: ${FLAG_INFO[f]?.description}`}
                  className={cn(
                    'h-7 min-w-9 rounded-md border px-2 font-mono text-xs transition-colors disabled:cursor-not-allowed',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent'
                  )}
                  aria-pressed={on}
                >
                  {f}
                </button>
              );
            })}
            <span className="ml-1 text-2xs text-muted-foreground">
              {parsedInput.literal ? 'Flags read from the /pattern/flags literal.' : 'Toggle flags, or paste a full /pattern/flags literal above.'}
            </span>
          </div>
          {tooLong && <ErrorBanner error={`Pattern is too long to explain (limit ${MAX_PATTERN.toLocaleString()} characters).`} />}
          {errorView}
          {native !== null && result?.ok && (
            <ErrorBanner error={`Your browser rejected this pattern: ${native}. The explanation below may not match runtime behaviour.`} />
          )}
        </div>
        {result?.ok && pattern.length > 0 && (
          <div className="border-t p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {(Object.keys(KIND_STYLE) as TokenKind[]).map((k) => (
                <span key={k} className={cn('flex items-center gap-1 text-2xs', KIND_STYLE[k].text)}>
                  <span className="size-2 rounded-full bg-current" />
                  {KIND_STYLE[k].label}
                </span>
              ))}
            </div>
            <div
              className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-base leading-relaxed"
              data-testid="pattern-tokens"
            >
              {result.tokens.map((t, i) => (
                <span
                  key={i}
                  className={cn(
                    'rounded-sm transition-colors',
                    KIND_STYLE[t.kind].text,
                    inHover(t.start, t.end) && 'bg-primary/20 ring-1 ring-primary/40'
                  )}
                  onMouseEnter={() => {
                    const n = nodes.get(t.nodeId);
                    setHover(n && t.nodeId !== 0 ? { start: n.start, end: n.end, id: n.id } : { start: t.start, end: t.end, id: null });
                  }}
                  onMouseLeave={() => setHover(null)}
                >
                  {pattern.slice(t.start, t.end)}
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {result?.ok && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Panel className="lg:col-span-3">
            <PanelHeader title="Explanation">
              <CopyButton value={() => treeToText(result.tree)} label="Copy text" />
            </PanelHeader>
            <div className="max-h-[560px] overflow-auto p-2">
              {pattern.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">{result.tree.title}</p>
              ) : (
                result.tree.children.map((c) => <TreeRow key={c.id} node={c} depth={0} hover={hover} setHover={setHover} />)
              )}
            </div>
            <StatBar items={[`${result.nodeCount - 1} elements`, `${result.groups.length} capture group${result.groups.length === 1 ? '' : 's'}`, `${pattern.length} chars`]} />
          </Panel>

          <div className="space-y-4 lg:col-span-2">
            <Panel>
              <PanelHeader title="Capture groups" />
              {groupsList.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No capturing groups.</p>
              ) : (
                <div className="divide-y">
                  {groupsList.map((g) => (
                    <div
                      key={g.index}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/50"
                      onMouseEnter={() => setHover({ start: g.start, end: g.end, id: null })}
                      onMouseLeave={() => setHover(null)}
                    >
                      <Badge variant="muted" className="font-mono">{g.index}</Badge>
                      {g.name ? <Badge variant="outline" className="font-mono">{g.name}</Badge> : <span className="text-muted-foreground">unnamed</span>}
                      <code className="min-w-0 flex-1 truncate font-mono text-muted-foreground" title={g.source}>
                        {g.source}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Flags" />
              {flagList.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No flags set.</p>
              ) : (
                <div className="divide-y">
                  {flagList.map((f) => (
                    <div key={f.flag} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                      <Badge variant="default" className="mt-0.5 font-mono">{f.flag}</Badge>
                      <div>
                        <span className="font-medium">{f.name}</span>
                        <span className="text-muted-foreground"> — {f.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Warnings (heuristic)" />
              {warnings.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  No issues spotted. These checks are heuristics: they can miss problems and occasionally flag safe patterns.
                </p>
              ) : (
                <div className="divide-y">
                  {warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex gap-2 px-3 py-2 text-xs hover:bg-muted/50"
                      onMouseEnter={() => setHover({ start: w.start, end: w.end, id: null })}
                      onMouseLeave={() => setHover(null)}
                      data-testid="warning"
                    >
                      {w.severity === 'warn' ? (
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                      ) : (
                        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="space-y-0.5">
                        <p className="font-medium">{w.title}</p>
                        <p className="text-muted-foreground">{w.message}</p>
                      </div>
                    </div>
                  ))}
                  <p className="px-3 py-1.5 text-2xs text-muted-foreground">
                    Heuristic checks: they can miss problems and occasionally flag safe patterns.
                  </p>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      <Panel>
        <PanelHeader title="Try it">
          <div className="flex items-center gap-2 px-1">
            <Checkbox id="re-all" checked={findAll} onCheckedChange={(c) => setFindAll(c === true)} />
            <Label htmlFor="re-all" className="text-xs">Find all matches</Label>
          </div>
        </PanelHeader>
        <Textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          spellCheck={false}
          rows={5}
          placeholder="Type or paste text to test the pattern against…"
          aria-label="Test string"
          className="min-h-28 resize-y rounded-none border-0 border-b font-mono text-sm shadow-none focus-visible:ring-0"
        />
        <div className="space-y-3 p-3">
          {testText.length > MAX_TEST_CHARS && (
            <ErrorBanner error={`Test string too long (limit ${MAX_TEST_CHARS.toLocaleString()} characters).`} />
          )}
          {native !== null && !tooLong && <p className="text-xs text-muted-foreground">Fix the syntax error to run the tester.</p>}
          {testState === 'timeout' && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
              <span>
                The match was stopped after {WORKER_TIMEOUT_MS / 1000}s. This pattern is probably backtracking catastrophically on this input (see the warnings above).
              </span>
            </div>
          )}
          {run && run.error === null && (
            <>
              <div
                className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-sm"
                data-testid="highlighted-text"
              >
                {testText.length === 0 ? (
                  <span className="text-muted-foreground">(empty)</span>
                ) : (
                  segments.map((s, i) =>
                    s.match === null ? (
                      <span key={i}>{s.text}</span>
                    ) : (
                      <mark
                        key={i}
                        className={cn(
                          'rounded-sm px-px text-foreground',
                          s.match % 2 === 0 ? 'bg-primary/30' : 'bg-success/30'
                        )}
                      >
                        {s.text}
                      </mark>
                    )
                  )
                )}
              </div>
              {run.matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches.</p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-md border" data-testid="matches">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-muted/80 text-left text-2xs uppercase tracking-wide text-muted-foreground backdrop-blur">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">#</th>
                        <th className="px-2 py-1.5 font-medium">Index</th>
                        <th className="px-2 py-1.5 font-medium">Match</th>
                        <th className="px-2 py-1.5 font-medium">Groups</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {run.matches.map((m, i) => (
                        <tr key={i} className="align-top">
                          <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                          <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                            {m.index}–{m.end}
                          </td>
                          <td className="px-2 py-1 break-all">{m.text === '' ? <span className="text-muted-foreground">(empty)</span> : m.text}</td>
                          <td className="px-2 py-1">
                            {m.groups.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="space-y-0.5">
                                {m.groups.map((g, gi) => (
                                  <div key={gi} className="break-all">
                                    <span className="text-muted-foreground">
                                      {gi + 1}
                                      {g.name ? ` (${g.name})` : ''}:
                                    </span>{' '}
                                    {g.value === null ? <span className="text-muted-foreground">undefined</span> : g.value === '' ? <span className="text-muted-foreground">(empty)</span> : g.value}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
        <StatBar
          items={[
            testState === 'running' ? 'running…' : null,
            run && run.error === null ? `${run.matches.length}${run.truncated ? '+' : ''} match${run.matches.length === 1 ? '' : 'es'}` : null,
            run && run.error === null && run.ms > 0 ? `${run.ms} ms` : null,
            run?.truncated ? 'showing the first 500 matches' : null,
          ]}
        />
      </Panel>

      <OptionsBar className="text-2xs text-muted-foreground">
        <Field label="About">
          <span className="max-w-3xl text-xs normal-case tracking-normal">
            Parses the full ES2024 syntax (plus the ES2025 inline modifiers and duplicate named groups) including legacy Annex B rules for non-Unicode patterns and v-flag set notation. The explanation comes from this tool&apos;s own parser; the tester uses your browser&apos;s real RegExp engine. Warnings are heuristics.
          </span>
        </Field>
      </OptionsBar>
    </div>
  );
}
