'use client';

import { useCallback, useDeferredValue, useMemo, useRef, useState, type RefObject } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Loader2, Upload, XCircle } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  flattenErrors,
  locatePointer,
  offsetToLineCol,
  parseJson,
  scanJson,
  validate,
  type DraftChoice,
  type JsonIndexEntry,
  type JsonSyntaxError,
  type ValidationError,
} from './logic';

const MAX_CHARS = 6_000_000;
const SHOWN_ERRORS = 150;

/* ------------------------------ samples ------------------------------ */

interface Sample {
  id: string;
  label: string;
  schema: unknown;
  instance: unknown;
}

const D2020 = 'https://json-schema.org/draft/2020-12/schema';

const USER_SCHEMA = {
  $schema: D2020,
  title: 'User',
  type: 'object',
  required: ['id', 'name', 'email', 'role'],
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 2, maxLength: 40 },
    email: { type: 'string', format: 'email' },
    role: { enum: ['admin', 'editor', 'viewer'] },
    age: { type: 'integer', minimum: 0, maximum: 150 },
    website: { type: 'string', format: 'uri' },
    tags: { type: 'array', items: { type: 'string' }, uniqueItems: true, maxItems: 5 },
    address: { $ref: '#/$defs/address' },
  },
  additionalProperties: false,
  $defs: {
    address: {
      type: 'object',
      required: ['street', 'zip'],
      properties: {
        street: { type: 'string' },
        zip: { type: 'string', pattern: '^[0-9]{5}$' },
        country: { type: 'string', default: 'US' },
      },
    },
  },
};

const SAMPLES: Sample[] = [
  {
    id: 'user-invalid',
    label: 'User profile with 8 mistakes',
    schema: USER_SCHEMA,
    instance: {
      id: 0,
      name: 'A',
      email: 'ada@',
      role: 'owner',
      age: 200,
      tags: ['math', 'code', 'math'],
      address: { street: '1 Main St', zip: '1234' },
      nickname: 'ada',
    },
  },
  {
    id: 'user-valid',
    label: 'User profile (valid)',
    schema: USER_SCHEMA,
    instance: {
      id: 7,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'admin',
      age: 36,
      website: 'https://example.com/ada',
      tags: ['math', 'code'],
      address: { street: '1 Main St', zip: '12345', country: 'GB' },
    },
  },
  {
    id: 'order',
    label: 'Order: oneOf and if / then / else',
    schema: {
      $schema: D2020,
      type: 'object',
      required: ['payment', 'shipping'],
      properties: {
        payment: {
          oneOf: [
            {
              properties: { method: { const: 'card' }, number: { type: 'string', pattern: '^[0-9]{16}$' } },
              required: ['method', 'number'],
            },
            { properties: { method: { const: 'iban' }, iban: { type: 'string' } }, required: ['method', 'iban'] },
          ],
        },
        shipping: {
          type: 'object',
          required: ['country'],
          properties: { country: { type: 'string' }, postcode: { type: 'string' } },
          if: { properties: { country: { const: 'US' } }, required: ['country'] },
          then: { required: ['postcode'], properties: { postcode: { pattern: '^[0-9]{5}(-[0-9]{4})?$' } } },
          else: { required: ['postcode'] },
        },
      },
    },
    instance: { payment: { method: 'card', number: '1234' }, shipping: { country: 'US' } },
  },
  {
    id: 'tuple',
    label: 'Tuple with prefixItems (2020-12)',
    schema: {
      $schema: D2020,
      type: 'array',
      prefixItems: [{ type: 'number' }, { type: 'string' }, { enum: ['Street', 'Avenue', 'Boulevard'] }],
      items: false,
      minItems: 3,
    },
    instance: [1600, 'Pennsylvania', 'Avenue', 'NW'],
  },
  {
    id: 'unevaluated',
    label: 'unevaluatedProperties with allOf',
    schema: {
      $schema: D2020,
      $defs: { person: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
      allOf: [{ $ref: '#/$defs/person' }, { properties: { employeeId: { type: 'integer' } } }],
      unevaluatedProperties: false,
    },
    instance: { name: 'Ada', employeeId: 7, salary: 100000 },
  },
  {
    id: 'draft7',
    label: 'Draft-07: dependencies and definitions',
    schema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        name: { type: 'string' },
        credit_card: { type: 'number' },
        billing_address: { $ref: '#/definitions/address' },
        items: { type: 'array', items: [{ type: 'string' }, { type: 'integer' }], additionalItems: false },
      },
      dependencies: { credit_card: ['billing_address'] },
      definitions: { address: { type: 'string', minLength: 5 } },
    },
    instance: { name: 'Ada', credit_card: 5555555555555555, items: ['x', 1, 'extra'] },
  },
];

const pretty = (v: unknown): string => JSON.stringify(v, null, 2);

/* ----------------------------- line editor ----------------------------- */

function JsonEditor({
  value,
  onChange,
  marks,
  active,
  textareaRef,
  onFile,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  marks: { line: number; level: 'error' | 'syntax' }[];
  active: number | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onFile: (f: File) => void;
  label: string;
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
  const marked = useMemo(() => {
    const m = new Map<number, 'error' | 'syntax'>();
    for (const k of marks) if (m.get(k.line) !== 'syntax') m.set(k.line, k.level);
    return [...m.entries()].slice(0, 300);
  }, [marks]);
  const gutterW = `${Math.max(2, String(lineCount).length) + 1.6}ch`;
  const rowTop = (line: number) => `calc(0.5rem + ${(line - 1) * 1.25}rem - ${scrollTop}px)`;

  return (
    <div
      className="relative flex h-[28rem] overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const f = e.dataTransfer.files[0];
        if (f) {
          e.preventDefault();
          onFile(f);
        }
      }}
    >
      {active !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-5 bg-primary/15"
          style={{ top: rowTop(active) }}
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none relative shrink-0 select-none overflow-hidden border-r bg-muted/40 text-right font-mono text-xs leading-5 text-muted-foreground"
        style={{ width: gutterW }}
      >
        <div style={{ transform: `translateY(${-scrollTop}px)` }} className="relative px-1.5 pt-2">
          <pre className="m-0 font-mono">{numbers}</pre>
          {marked.map(([line, level]) => (
            <span
              key={line}
              className={cn('absolute left-0 w-1 rounded-r-sm', level === 'syntax' ? 'bg-destructive' : 'bg-warning')}
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
        aria-label={label}
        className="field-sizing-fixed relative h-full flex-1 resize-none rounded-none border-0 bg-transparent px-3 py-2 font-mono text-xs leading-5 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function withoutBom(t: string): string {
  return t.charCodeAt(0) === 0xfeff ? ' ' + t.slice(1) : t;
}

function selectLine(ta: HTMLTextAreaElement | null, offset: number): number {
  if (!ta) return 1;
  const text = ta.value;
  const { line } = offsetToLineCol(text, offset);
  let ls = text.lastIndexOf('\n', offset - 1) + 1;
  if (offset === 0) ls = 0;
  let le = text.indexOf('\n', offset);
  if (le === -1) le = text.length;
  ta.focus();
  ta.setSelectionRange(ls, le);
  const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
  ta.scrollTop = Math.max(0, (line - 4) * lh);
  return line;
}

interface ParsedSide {
  parsed: ReturnType<typeof parseJson> | null;
  tooBig: boolean;
}

function useParsed(text: string): ParsedSide {
  return useMemo(() => {
    if (text.length > MAX_CHARS) return { parsed: null, tooBig: true };
    return { parsed: parseJson(text), tooBig: false };
  }, [text]);
}

function pointerToPath(p: string): string {
  return p === '' ? '(root)' : p;
}

/* ------------------------------ component ------------------------------ */

export default function JsonSchemaValidatorTool() {
  const first = SAMPLES[0] as Sample;
  const [schemaText, setSchemaText] = useState(() => pretty(first.schema));
  const [instText, setInstText] = useState(() => pretty(first.instance));
  const [draft, setDraft] = useState<DraftChoice>('auto');
  const [formats, setFormats] = useState(true);
  const [allErrors, setAllErrors] = useState(true);
  const [activeInst, setActiveInst] = useState<number | null>(null);
  const [activeSchema, setActiveSchema] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const schemaRef = useRef<HTMLTextAreaElement | null>(null);
  const instRef = useRef<HTMLTextAreaElement | null>(null);
  const schemaFile = useRef<HTMLInputElement | null>(null);
  const instFile = useRef<HTMLInputElement | null>(null);

  const dSchema = useDeferredValue(schemaText);
  const dInst = useDeferredValue(instText);
  const stale = dSchema !== schemaText || dInst !== instText;

  const schemaSide = useParsed(dSchema);
  const instSide = useParsed(dInst);

  const result = useMemo(() => {
    const s = schemaSide.parsed;
    const i = instSide.parsed;
    if (!s || !i || !s.ok || !i.ok) return null;
    try {
      return validate(s.value, i.value, { draft, formats, allErrors, maxErrors: 500 });
    } catch (e) {
      return { crash: e instanceof Error ? e.message : String(e) };
    }
  }, [schemaSide, instSide, draft, formats, allErrors]);

  const validation = result && !('crash' in result) ? result : null;
  const crash = result && 'crash' in result ? result.crash : null;

  const instIndex = useMemo(() => {
    if (!validation || validation.errors.length === 0) return null;
    const r = scanJson(withoutBom(dInst), true);
    return r.ok ? r.index : null;
  }, [validation, dInst]);

  const schemaIndex = useMemo(() => {
    if (!validation) return null;
    const r = scanJson(withoutBom(dSchema), true);
    return r.ok ? r.index : null;
  }, [validation, dSchema]);

  const lineOf = useCallback(
    (e: ValidationError): number | null => {
      const entry: JsonIndexEntry | null = locatePointer(instIndex, e.instancePath);
      if (!entry) return null;
      return offsetToLineCol(dInst, entry.keyStart ?? entry.start).line;
    },
    [instIndex, dInst]
  );

  const flat = useMemo(() => (validation ? flattenErrors(validation.errors) : []), [validation]);
  const shownTop = showAll ? validation?.errors ?? [] : (validation?.errors ?? []).slice(0, SHOWN_ERRORS);

  const marks = useMemo(() => {
    const out: { line: number; level: 'error' | 'syntax' }[] = [];
    if (instSide.parsed && !instSide.parsed.ok) out.push({ line: instSide.parsed.error.line, level: 'syntax' });
    else if (validation) {
      for (const e of validation.errors.slice(0, 300)) {
        const entry = locatePointer(instIndex, e.instancePath);
        if (entry) out.push({ line: offsetToLineCol(dInst, entry.keyStart ?? entry.start).line, level: 'error' });
      }
    }
    return out;
  }, [instSide, validation, instIndex, dInst]);
  const schemaMarks = useMemo(() => {
    const out: { line: number; level: 'error' | 'syntax' }[] = [];
    if (schemaSide.parsed && !schemaSide.parsed.ok) out.push({ line: schemaSide.parsed.error.line, level: 'syntax' });
    return out;
  }, [schemaSide]);

  const jumpToInstance = (e: ValidationError) => {
    const entry = locatePointer(instIndex, e.instancePath);
    if (!entry) return;
    const line = selectLine(instRef.current, entry.keyStart ?? entry.start);
    setActiveInst(line);
  };
  const jumpToSchema = (e: ValidationError) => {
    const pointer = e.schemaPath.startsWith('#') ? e.schemaPath.slice(1) : e.schemaPath;
    const entry = locatePointer(schemaIndex, pointer);
    if (!entry) return;
    const line = selectLine(schemaRef.current, entry.keyStart ?? entry.start);
    setActiveSchema(line);
  };
  const jumpToSyntax = (side: 'schema' | 'instance', err: JsonSyntaxError) => {
    const ta = side === 'schema' ? schemaRef.current : instRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(err.offset, Math.min(ta.value.length, err.offset + 1));
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (err.line - 4) * lh);
  };

  const loadFile = useCallback(async (file: File, which: 'schema' | 'instance') => {
    setLoadError(null);
    if (file.size > MAX_CHARS * 2) {
      setLoadError(`"${file.name}" is ${(file.size / 1e6).toFixed(1)} MB; the editors handle up to about ${(MAX_CHARS / 1e6).toFixed(0)} MB of JSON.`);
      return;
    }
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      if (which === 'schema') setSchemaText(text);
      else setInstText(text);
      setActiveInst(null);
      setActiveSchema(null);
    } catch {
      setLoadError(`Could not read "${file.name}".`);
    }
  }, []);

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (!s) return;
    setSchemaText(pretty(s.schema));
    setInstText(pretty(s.instance));
    setActiveInst(null);
    setActiveSchema(null);
    setLoadError(null);
  };

  const errorCount = validation?.errors.length ?? 0;
  const schemaErrors = validation?.problems.filter((p) => p.level === 'error') ?? [];
  const okAll = validation !== null && validation.valid;
  const draftInfo = validation?.draft;

  const exportText = () =>
    JSON.stringify(
      {
        valid: validation?.valid ?? false,
        draft: draftInfo?.draft,
        errors: validation?.errors ?? [],
        schemaProblems: validation?.problems ?? [],
      },
      null,
      2
    );

  const syntaxBox = (side: 'schema' | 'instance', parsed: ParsedSide) => {
    if (parsed.tooBig) {
      return (
        <div className="flex items-start gap-2 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          The {side} is larger than {(MAX_CHARS / 1e6).toFixed(0)} MB.
        </div>
      );
    }
    if (parsed.parsed && !parsed.parsed.ok) {
      const err = parsed.parsed.error;
      return (
        <button
          type="button"
          onClick={() => jumpToSyntax(side, err)}
          className="flex w-full items-start gap-2 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/15"
        >
          <XCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            <span className="font-mono font-semibold">
              Line {err.line}, column {err.col}:
            </span>{' '}
            {err.message}
          </span>
        </button>
      );
    }
    return null;
  };

  const renderError = (e: ValidationError, depth: number, key: string): React.ReactNode => {
    const line = depth === 0 ? lineOf(e) : null;
    return (
      <li key={key} className={cn(depth > 0 && 'border-l-2 border-border pl-3')}>
        <div className={cn('flex items-start gap-2 py-2', depth === 0 ? 'px-3' : 'pr-3')}>
          <XCircle className={cn('mt-0.5 size-3.5 shrink-0', depth === 0 ? 'text-destructive' : 'text-muted-foreground')} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge variant={depth === 0 ? 'destructive' : 'muted'} className="font-mono">
                {e.keyword}
              </Badge>
              <button
                type="button"
                className="max-w-full truncate rounded font-mono text-xs font-medium text-foreground underline-offset-2 hover:underline disabled:no-underline"
                disabled={depth > 0 || !instIndex}
                onClick={() => jumpToInstance(e)}
                title={depth === 0 ? 'Highlight in the JSON instance' : undefined}
              >
                {pointerToPath(e.instancePath)}
              </button>
              {line !== null && <span className="font-mono text-2xs text-muted-foreground">line {line}</span>}
            </div>
            <p className="mt-0.5 text-xs">{e.message}</p>
            <button
              type="button"
              onClick={() => jumpToSchema(e)}
              disabled={!schemaIndex}
              className="mt-0.5 max-w-full truncate text-left font-mono text-2xs text-muted-foreground underline-offset-2 hover:underline disabled:no-underline"
              title="Highlight the keyword in the schema"
            >
              schema {e.schemaPath}
            </button>
          </div>
        </div>
        {e.causes && e.causes.length > 0 && (
          <details className="group pb-1 pl-8 pr-3">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-2xs text-muted-foreground hover:text-foreground">
              <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
              {e.causes.length} detail{e.causes.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-1">{e.causes.map((c, i) => renderError(c, depth + 1, `${key}.${i}`))}</ul>
          </details>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Draft">
          <Select value={draft} onValueChange={(v) => setDraft(v as DraftChoice)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (from $schema)</SelectItem>
              <SelectItem value="draft-07">Draft-07</SelectItem>
              <SelectItem value="2019-09">2019-09</SelectItem>
              <SelectItem value="2020-12">2020-12</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Check formats">
          <Switch checked={formats} onCheckedChange={setFormats} aria-label="Treat format as an assertion" />
        </Field>
        <Field label="Report">
          <Select value={allErrors ? 'all' : 'first'} onValueChange={(v) => setAllErrors(v === 'all')}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All errors</SelectItem>
              <SelectItem value="first">First error only</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Samples" className="ml-auto">
          <select
            aria-label="Load a sample"
            className="h-8 rounded-md border bg-background px-2 text-xs"
            value=""
            onChange={(e) => loadSample(e.target.value)}
          >
            <option value="">Load sample…</option>
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="min-w-0">
          <PanelHeader title="JSON Schema">
            <Button variant="ghost" size="sm" onClick={() => schemaFile.current?.click()}>
              <Upload className="size-3.5" /> Open
            </Button>
            <input
              ref={schemaFile}
              type="file"
              accept=".json,.schema,application/json,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f, 'schema');
                e.target.value = '';
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const p = parseJson(schemaText);
                if (p.ok) setSchemaText(pretty(p.value));
              }}
              disabled={!(schemaSide.parsed && schemaSide.parsed.ok)}
            >
              Format
            </Button>
          </PanelHeader>
          <JsonEditor
            value={schemaText}
            onChange={(v) => {
              setSchemaText(v);
              setActiveSchema(null);
            }}
            marks={schemaMarks}
            active={activeSchema}
            textareaRef={schemaRef}
            onFile={(f) => void loadFile(f, 'schema')}
            label="JSON Schema"
          />
          {syntaxBox('schema', schemaSide)}
        </Panel>

        <Panel className="min-w-0">
          <PanelHeader title="JSON instance">
            <Button variant="ghost" size="sm" onClick={() => instFile.current?.click()}>
              <Upload className="size-3.5" /> Open
            </Button>
            <input
              ref={instFile}
              type="file"
              accept=".json,application/json,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f, 'instance');
                e.target.value = '';
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const p = parseJson(instText);
                if (p.ok) setInstText(pretty(p.value));
              }}
              disabled={!(instSide.parsed && instSide.parsed.ok)}
            >
              Format
            </Button>
          </PanelHeader>
          <JsonEditor
            value={instText}
            onChange={(v) => {
              setInstText(v);
              setActiveInst(null);
            }}
            marks={marks}
            active={activeInst}
            textareaRef={instRef}
            onFile={(f) => void loadFile(f, 'instance')}
            label="JSON instance"
          />
          {syntaxBox('instance', instSide)}
        </Panel>
      </div>
      {loadError && (
        <p role="alert" className="text-xs text-destructive">
          {loadError}
        </p>
      )}

      {/* ---------------- result ---------------- */}
      <Panel>
        <PanelHeader title="Result">
          {validation && (
            <>
              <CopyButton value={exportText} label="Copy report" />
              <DownloadButton data={exportText} filename="validation-report.json" mime="application/json" />
            </>
          )}
        </PanelHeader>

        <div
          role="status"
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-3 py-2.5',
            !validation || stale ? 'bg-muted/30' : okAll ? 'bg-success/10' : 'bg-destructive/10'
          )}
        >
          {crash ? (
            <>
              <XCircle className="size-4 text-destructive" />
              <span className="text-sm font-semibold">The validator stopped: {crash}</span>
            </>
          ) : !validation ? (
            <span className="text-sm text-muted-foreground">
              {schemaSide.tooBig || instSide.tooBig
                ? 'An input is too large.'
                : 'Fix the JSON syntax errors above to validate.'}
            </span>
          ) : okAll ? (
            <>
              <CheckCircle2 className="size-4 text-success" />
              <span className="text-sm font-semibold">Valid</span>
              <span className="text-sm text-muted-foreground">the instance satisfies the schema</span>
            </>
          ) : (
            <>
              <XCircle className="size-4 text-destructive" />
              <span className="text-sm font-semibold">
                {errorCount > 0 ? `Invalid: ${errorCount}${validation.truncated ? '+' : ''} error${errorCount === 1 ? '' : 's'}` : 'The schema has problems'}
              </span>
              {!allErrors && errorCount > 0 && <span className="text-sm text-muted-foreground">(stopped at the first error)</span>}
            </>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {stale && (
              <Badge variant="muted">
                <Loader2 className="animate-spin" /> checking…
              </Badge>
            )}
            {draftInfo && (
              <Badge variant="outline" title={draftInfo.note}>
                {draftInfo.draft} · {draftInfo.source === 'option' ? 'selected' : draftInfo.source === '$schema' ? 'from $schema' : draftInfo.source === 'inferred' ? 'inferred' : 'default'}
              </Badge>
            )}
            <Badge variant="muted">formats {formats ? 'checked' : 'ignored'}</Badge>
          </div>
        </div>

        {schemaErrors.length > 0 && (
          <ul className="divide-y border-b bg-destructive/5">
            {schemaErrors.map((p, i) => (
              <li key={i} className="flex items-start gap-2 px-3 py-2 text-xs">
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                <span>
                  <span className="mr-2 font-mono text-2xs text-muted-foreground">{p.path}</span>
                  {p.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        {validation && validation.errors.length > 0 && (
          <ul className="max-h-[34rem] divide-y overflow-auto">
            {shownTop.map((e, i) => renderError(e, 0, `e${i}`))}
          </ul>
        )}
        {validation && validation.errors.length > SHOWN_ERRORS && !showAll && (
          <div className="border-t px-3 py-2">
            <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
              Show all {validation.errors.length} errors
            </Button>
          </div>
        )}
        {validation && validation.truncated && (
          <p className="border-t px-3 py-2 text-2xs text-warning">Stopped after 500 errors.</p>
        )}

        {validation && validation.problems.filter((p) => p.level !== 'error').length > 0 && (
          <details className="border-t" open={validation.problems.some((p) => p.level === 'warning')}>
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-accent/30">
              <Info className="size-3.5 text-muted-foreground" /> Schema notes ({validation.problems.filter((p) => p.level !== 'error').length})
            </summary>
            <ul className="divide-y border-t">
              {validation.problems
                .filter((p) => p.level !== 'error')
                .map((p, i) => (
                  <li key={i} className="flex items-start gap-2 px-3 py-1.5 text-xs">
                    {p.level === 'warning' ? (
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    ) : (
                      <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      <span className="mr-2 font-mono text-2xs text-muted-foreground">{p.path}</span>
                      {p.message}
                    </span>
                  </li>
                ))}
            </ul>
          </details>
        )}

        <StatBar
          items={[
            validation ? `${flat.length} reported (${errorCount} top-level)` : null,
            instSide.parsed && instSide.parsed.ok ? `${dInst.length.toLocaleString()} chars in the instance` : null,
            'numbers are IEEE doubles',
          ]}
        />
      </Panel>

      <p className="text-2xs text-muted-foreground">
        Supports Draft-07, 2019-09 and 2020-12 including <code className="font-mono">$ref</code> / <code className="font-mono">$id</code> / <code className="font-mono">$anchor</code> /{' '}
        <code className="font-mono">$dynamicRef</code> inside the schema, <code className="font-mono">unevaluatedProperties</code> and <code className="font-mono">unevaluatedItems</code>, and
        the formats date-time, date, time, duration, email, hostname, ipv4, ipv6, uri, uri-reference, uuid, regex and json-pointer. Remote <code className="font-mono">$ref</code>s are not
        fetched (everything stays in your browser) and the pattern keywords use JavaScript regular expressions. Click an error to jump to the line in the instance.
      </p>
    </div>
  );
}
