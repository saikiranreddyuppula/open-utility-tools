'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ClipboardPaste, Eraser, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';

import { beautify, minify, byteLength, JsSyntaxError } from './logic';

type Mode = 'beautify' | 'minify';

const MAX_CHARS = 3_000_000;

const INDENT_LABEL: Record<'2' | '4' | 'tab', string> = { '2': '2 spaces', '4': '4 spaces', tab: 'Tab' };

const SAMPLE = `/*! DemoLib v1.2.0 | MIT License */
'use strict';

// Utilities for formatting prices and slugs
const CURRENCY = {USD:'$', EUR:'€', GBP:'£'};

function formatPrice(amount,currency='USD'){
  if(typeof amount!=='number'||Number.isNaN(amount))return '—' // not a number
  const symbol=CURRENCY[currency]??currency+' '
  return \`\${symbol}\${amount.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}\`
}

const slugify=(text)=>text.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')

class Cart{
  #items=new Map()
  add(sku,qty=1,price=0){
    const line=this.#items.get(sku)??{qty:0,price}
    line.qty+=qty;this.#items.set(sku,line)
    return this
  }
  get total(){
    let sum=0;for(const {qty,price} of this.#items.values())sum+=qty*price
    return sum
  }
}

async function load(url){
  try{
    const res=await fetch(url);if(!res.ok)throw new Error(\`HTTP \${res.status}\`)
    return (await res.json()).items.map(i=>({...i,slug:slugify(i.name)}))
  }catch(err){console.error(err);return []}finally{console.log('done')}
}

const cart=new Cart().add('a-1',2,9.99).add('b-2',1,24.5)
console.log(formatPrice(cart.total,'EUR'))
`;

interface Result {
  output: string;
  error: string | null;
  /** Source line + caret pointing at the problem. */
  frame: string | null;
  ms: number;
}

function process(src: string, mode: Mode, opts: {
  indent: '2' | '4' | 'tab';
  braceStyle: 'collapse' | 'expand';
  maxBlank: number;
  spaceInParens: boolean;
  keepComments: boolean;
  keepLicense: boolean;
}): Result {
  if (!src.trim()) return { output: '', error: null, frame: null, ms: 0 };
  if (src.length > MAX_CHARS) {
    return {
      output: '',
      error: `Input is too large (${src.length.toLocaleString()} characters). The limit is ${MAX_CHARS.toLocaleString()}.`,
      frame: null,
      ms: 0,
    };
  }
  const t0 = performance.now();
  try {
    const output =
      mode === 'minify'
        ? minify(src, { keepLicense: opts.keepLicense })
        : beautify(src, {
            indent: opts.indent === 'tab' ? 'tab' : opts.indent === '4' ? 4 : 2,
            braceStyle: opts.braceStyle,
            maxBlankLines: opts.maxBlank,
            spaceInParens: opts.spaceInParens,
            keepComments: opts.keepComments,
          });
    return { output, error: null, frame: null, ms: performance.now() - t0 };
  } catch (e) {
    if (e instanceof JsSyntaxError) {
      const line = src.split(/\r\n|[\n\r\u2028\u2029]/)[e.line - 1] ?? '';
      const start = Math.max(0, e.column - 1 - 60);
      const shown = line.slice(start, start + 140);
      const caret = ' '.repeat(Math.max(0, e.column - 1 - start)) + '^';
      return { output: '', error: e.message, frame: `${shown}\n${caret}`, ms: 0 };
    }
    return { output: '', error: e instanceof Error ? e.message : String(e), frame: null, ms: 0 };
  }
}

export default function JavaScriptBeautifierMinifier() {
  const [input, setInput] = useState(SAMPLE);
  const [fileName, setFileName] = useState('script');
  const [mode, setMode] = useState<Mode>('beautify');
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2');
  const [braceStyle, setBraceStyle] = useState<'collapse' | 'expand'>('collapse');
  const [maxBlank, setMaxBlank] = useState(1);
  const [spaceInParens, setSpaceInParens] = useState(false);
  const [keepComments, setKeepComments] = useState(true);
  const [keepLicense, setKeepLicense] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const deferred = useDeferredValue(input);
  const stale = deferred !== input;

  const result = useMemo(
    () => process(deferred, mode, { indent, braceStyle, maxBlank, spaceInParens, keepComments, keepLicense }),
    [deferred, mode, indent, braceStyle, maxBlank, spaceInParens, keepComments, keepLicense]
  );

  const before = useMemo(() => byteLength(deferred), [deferred]);
  const after = useMemo(() => byteLength(result.output), [result.output]);
  const saved = before > 0 && after > 0 ? ((before - after) / before) * 100 : 0;
  const outLines = result.output ? result.output.split('\n').length - (result.output.endsWith('\n') ? 1 : 0) : 0;

  const downloadName =
    mode === 'minify' ? `${fileName}.min.js` : `${fileName}.beautified.js`;

  const onUpload = async (file: File) => {
    setUploadError(null);
    if (file.size > MAX_CHARS * 3) {
      setUploadError(`File is too large (${formatBytes(file.size)}).`);
      return;
    }
    try {
      const text = await file.text();
      setInput(text);
      setFileName(file.name.replace(/\.(m|c)?jsx?$/i, '').replace(/\.min$/i, '') || 'script');
    } catch {
      setUploadError('Could not read that file.');
    }
  };

  const areaClass =
    'h-[30rem] resize-y rounded-none border-0 bg-transparent font-mono text-[13px] leading-5 shadow-none field-sizing-fixed focus-visible:ring-0 dark:bg-transparent';
  const areaStyle = { whiteSpace: 'pre' as const, overflow: 'auto' as const };

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="beautify">Beautify</TabsTrigger>
              <TabsTrigger value="minify">Minify</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {mode === 'beautify' ? (
          <>
            <Field label="Indent">
              <Select value={indent} onValueChange={(v) => setIndent(v as '2' | '4' | 'tab')}>
                <SelectTrigger className="w-28" aria-label="Indent">
                  <SelectValue>{INDENT_LABEL[indent]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Braces">
              <Select value={braceStyle} onValueChange={(v) => setBraceStyle(v as 'collapse' | 'expand')}>
                <SelectTrigger className="w-40" aria-label="Brace style">
                  <SelectValue>{braceStyle === 'expand' ? 'Own line' : 'Same line'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collapse">Same line</SelectItem>
                  <SelectItem value="expand">Own line</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Keep blank lines">
              <Select value={String(maxBlank)} onValueChange={(v) => setMaxBlank(Number(v))}>
                <SelectTrigger className="w-28" aria-label="Max preserved blank lines">
                  <SelectValue>{maxBlank === 0 ? 'None' : `Up to ${maxBlank}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="1">Up to 1</SelectItem>
                  <SelectItem value="2">Up to 2</SelectItem>
                  <SelectItem value="3">Up to 3</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Space in ( )">
              <Switch checked={spaceInParens} onCheckedChange={setSpaceInParens} aria-label="Space inside parentheses" />
            </Field>
            <Field label="Keep comments">
              <Switch checked={keepComments} onCheckedChange={setKeepComments} aria-label="Keep comments" />
            </Field>
          </>
        ) : (
          <Field label="Keep /*! license */">
            <Switch checked={keepLicense} onCheckedChange={setKeepLicense} aria-label="Keep license comments" />
          </Field>
        )}
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="JavaScript">
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); setFileName('script'); }} title="Load sample">
              Sample
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Paste from clipboard"
              onClick={async () => {
                try {
                  setInput(await navigator.clipboard.readText());
                } catch {
                  /* clipboard blocked */
                }
              }}
            >
              <ClipboardPaste className="size-3.5" />
              Paste
            </Button>
            <Button variant="ghost" size="sm" title="Open a .js file" onClick={() => uploadRef.current?.click()}>
              <Upload className="size-3.5" />
              Upload
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept=".js,.mjs,.cjs,.jsx,text/javascript,application/javascript,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = '';
              }}
            />
            <Button variant="ghost" size="icon-sm" onClick={() => setInput('')} disabled={!input} title="Clear input">
              <Eraser className="size-3.5" />
            </Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste JavaScript here…"
            spellCheck={false}
            wrap="off"
            aria-label="JavaScript input"
            className={areaClass}
            style={areaStyle}
          />
          <StatBar items={[`${input.length.toLocaleString()} chars`, `${byteLength(input).toLocaleString()} bytes`]} />
        </Panel>

        <Panel>
          <PanelHeader title={mode === 'minify' ? 'Minified' : 'Beautified'}>
            <Button
              variant="ghost"
              size="sm"
              disabled={!result.output}
              title="Move the result back into the input"
              onClick={() => setInput(result.output)}
            >
              <ArrowLeftRight className="size-3.5" />
              Use as input
            </Button>
            <CopyButton value={() => result.output} disabled={!result.output} />
            <DownloadButton
              data={() => result.output}
              filename={downloadName}
              mime="text/javascript"
              disabled={!result.output}
            />
          </PanelHeader>
          <div className="relative flex-1">
            {result.error ? (
              <div className="space-y-2 p-3" data-testid="js-error">
                <ErrorBanner error={result.error} />
                {result.frame && (
                  <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-xs text-muted-foreground">
                    {result.frame}
                  </pre>
                )}
              </div>
            ) : (
              <Textarea
                value={result.output}
                readOnly
                placeholder="Result appears here…"
                spellCheck={false}
                wrap="off"
                aria-label="JavaScript output"
                className={cn(areaClass, stale && 'opacity-60')}
                style={areaStyle}
              />
            )}
          </div>
          <StatBar
            items={[
              result.output && `${before.toLocaleString()} B → ${after.toLocaleString()} B`,
              result.output &&
                (saved >= 0 ? `${saved.toFixed(1)}% smaller` : `${Math.abs(saved).toFixed(1)}% larger`),
              result.output && `${outLines.toLocaleString()} lines`,
              result.output && result.ms > 0 && `${result.ms < 1 ? '<1' : Math.round(result.ms)} ms`,
            ]}
          />
        </Panel>
      </div>

      <ErrorBanner error={uploadError} />
      <p className="text-xs text-muted-foreground">
        {mode === 'minify'
          ? 'Whitespace & comment minifier: strips comments, collapses whitespace and drops redundant semicolons while keeping the newlines that automatic semicolon insertion needs. It does not rename (mangle) identifiers or rewrite your code, so output is larger than Terser/esbuild but behaves identically.'
          : 'Token-based formatter: it only changes whitespace, so the code behaves identically. Objects written over several lines stay expanded; arrays and argument lists that fit within 80 columns stay on one line. Plain JavaScript only (no JSX or TypeScript).'}{' '}
        Everything runs locally in your browser.
      </p>
    </div>
  );
}
