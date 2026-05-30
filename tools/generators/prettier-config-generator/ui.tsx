'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type OutFmt = 'prettierrc' | 'json' | 'pkg' | 'js';
type TrailingComma = 'none' | 'es5' | 'all';
type ArrowParens = 'always' | 'avoid';
type Eol = 'lf' | 'crlf' | 'cr' | 'auto';
type ProseWrap = 'preserve' | 'always' | 'never';
type QuoteProps = 'as-needed' | 'consistent' | 'preserve';
type HtmlWS = 'css' | 'strict' | 'ignore';

const IGNORE_PRESETS: { id: string; label: string; lines: string[] }[] = [
  { id: 'build', label: 'Build output', lines: ['dist', 'build', 'out', 'coverage'] },
  { id: 'deps', label: 'Dependencies', lines: ['node_modules', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'] },
  { id: 'misc', label: 'Misc', lines: ['*.min.js', '*.min.css', '.next', '.cache'] },
];

export default function PrettierConfigGeneratorTool() {
  // Defaults mirror Prettier's own defaults.
  const [printWidth, setPrintWidth] = useState('80');
  const [tabWidth, setTabWidth] = useState('2');
  const [useTabs, setUseTabs] = useState(false);
  const [semi, setSemi] = useState(true);
  const [singleQuote, setSingleQuote] = useState(false);
  const [quoteProps, setQuoteProps] = useState<QuoteProps>('as-needed');
  const [jsxSingleQuote, setJsxSingleQuote] = useState(false);
  const [trailingComma, setTrailingComma] = useState<TrailingComma>('all');
  const [bracketSpacing, setBracketSpacing] = useState(true);
  const [bracketSameLine, setBracketSameLine] = useState(false);
  const [arrowParens, setArrowParens] = useState<ArrowParens>('always');
  const [endOfLine, setEndOfLine] = useState<Eol>('lf');
  const [proseWrap, setProseWrap] = useState<ProseWrap>('preserve');
  const [htmlWhitespace, setHtmlWhitespace] = useState<HtmlWS>('css');

  const [emitAll, setEmitAll] = useState(false);
  const [outFmt, setOutFmt] = useState<OutFmt>('prettierrc');
  const [ignore, setIgnore] = useState<Record<string, boolean>>({ build: true, deps: true });

  const config = useMemo(() => {
    const pw = Number(printWidth);
    const tw = Number(tabWidth);
    const obj: Record<string, unknown> = {};
    const put = (key: string, value: unknown, isDefault: boolean) => {
      if (emitAll || !isDefault) obj[key] = value;
    };

    put('printWidth', Number.isFinite(pw) && pw > 0 ? Math.floor(pw) : 80, Math.floor(pw) === 80);
    put('tabWidth', Number.isFinite(tw) && tw > 0 ? Math.floor(tw) : 2, Math.floor(tw) === 2);
    put('useTabs', useTabs, useTabs === false);
    put('semi', semi, semi === true);
    put('singleQuote', singleQuote, singleQuote === false);
    put('quoteProps', quoteProps, quoteProps === 'as-needed');
    put('jsxSingleQuote', jsxSingleQuote, jsxSingleQuote === false);
    put('trailingComma', trailingComma, trailingComma === 'all');
    put('bracketSpacing', bracketSpacing, bracketSpacing === true);
    put('bracketSameLine', bracketSameLine, bracketSameLine === false);
    put('arrowParens', arrowParens, arrowParens === 'always');
    put('endOfLine', endOfLine, endOfLine === 'lf');
    put('proseWrap', proseWrap, proseWrap === 'preserve');
    put('htmlWhitespaceSensitivity', htmlWhitespace, htmlWhitespace === 'css');

    return obj;
  }, [
    printWidth,
    tabWidth,
    useTabs,
    semi,
    singleQuote,
    quoteProps,
    jsxSingleQuote,
    trailingComma,
    bracketSpacing,
    bracketSameLine,
    arrowParens,
    endOfLine,
    proseWrap,
    htmlWhitespace,
    emitAll,
  ]);

  const output = useMemo(() => {
    const json = JSON.stringify(config, null, 2);
    switch (outFmt) {
      case 'prettierrc':
      case 'json':
        return json + '\n';
      case 'pkg':
        return JSON.stringify({ prettier: config }, null, 2) + '\n';
      case 'js':
        return `/** @type {import("prettier").Config} */\nconst config = ${json};\n\nmodule.exports = config;\n`;
      default:
        return json + '\n';
    }
  }, [config, outFmt]);

  const filename =
    outFmt === 'json'
      ? '.prettierrc.json'
      : outFmt === 'pkg'
        ? 'package.json'
        : outFmt === 'js'
          ? 'prettier.config.js'
          : '.prettierrc';

  const ignoreText = useMemo(() => {
    const lines: string[] = [];
    for (const p of IGNORE_PRESETS) {
      if (!ignore[p.id]) continue;
      lines.push(`# ${p.label}`);
      for (const l of p.lines) lines.push(l);
      lines.push('');
    }
    return lines.join('\n').trimEnd() + '\n';
  }, [ignore]);

  const anyIgnore = useMemo(
    () => IGNORE_PRESETS.some((p) => ignore[p.id]),
    [ignore]
  );

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Print width">
          <Input
            value={printWidth}
            onChange={(e) => setPrintWidth(e.target.value)}
            className="w-20 font-mono"
            inputMode="numeric"
          />
        </Field>
        <Field label="Tab width">
          <Input
            value={tabWidth}
            onChange={(e) => setTabWidth(e.target.value)}
            className="w-20 font-mono"
            inputMode="numeric"
            disabled={useTabs}
          />
        </Field>
        <Field label="Trailing comma">
          <Select value={trailingComma} onValueChange={(v) => setTrailingComma(v as TrailingComma)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">none</SelectItem>
              <SelectItem value="es5">es5</SelectItem>
              <SelectItem value="all">all</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quote props">
          <Select value={quoteProps} onValueChange={(v) => setQuoteProps(v as QuoteProps)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="as-needed">as-needed</SelectItem>
              <SelectItem value="consistent">consistent</SelectItem>
              <SelectItem value="preserve">preserve</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Arrow parens">
          <Select value={arrowParens} onValueChange={(v) => setArrowParens(v as ArrowParens)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">always</SelectItem>
              <SelectItem value="avoid">avoid</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="End of line">
          <Select value={endOfLine} onValueChange={(v) => setEndOfLine(v as Eol)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lf">lf</SelectItem>
              <SelectItem value="crlf">crlf</SelectItem>
              <SelectItem value="cr">cr</SelectItem>
              <SelectItem value="auto">auto</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Prose wrap">
          <Select value={proseWrap} onValueChange={(v) => setProseWrap(v as ProseWrap)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="preserve">preserve</SelectItem>
              <SelectItem value="always">always</SelectItem>
              <SelectItem value="never">never</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="HTML whitespace">
          <Select value={htmlWhitespace} onValueChange={(v) => setHtmlWhitespace(v as HtmlWS)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="css">css</SelectItem>
              <SelectItem value="strict">strict</SelectItem>
              <SelectItem value="ignore">ignore</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Output">
          <Select value={outFmt} onValueChange={(v) => setOutFmt(v as OutFmt)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prettierrc">.prettierrc (JSON)</SelectItem>
              <SelectItem value="json">.prettierrc.json</SelectItem>
              <SelectItem value="pkg">package.json field</SelectItem>
              <SelectItem value="js">prettier.config.js</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <OptionsBar>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={semi} onCheckedChange={setSemi} id="semi" />
          <Label htmlFor="semi" className="text-xs text-muted-foreground">semi</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={singleQuote} onCheckedChange={setSingleQuote} id="sq" />
          <Label htmlFor="sq" className="text-xs text-muted-foreground">singleQuote</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={jsxSingleQuote} onCheckedChange={setJsxSingleQuote} id="jsq" />
          <Label htmlFor="jsq" className="text-xs text-muted-foreground">jsxSingleQuote</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={useTabs} onCheckedChange={setUseTabs} id="tabs" />
          <Label htmlFor="tabs" className="text-xs text-muted-foreground">useTabs</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={bracketSpacing} onCheckedChange={setBracketSpacing} id="bs" />
          <Label htmlFor="bs" className="text-xs text-muted-foreground">bracketSpacing</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={bracketSameLine} onCheckedChange={setBracketSameLine} id="bsl" />
          <Label htmlFor="bsl" className="text-xs text-muted-foreground">bracketSameLine</Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={emitAll} onCheckedChange={setEmitAll} id="all" />
          <Label htmlFor="all" className="text-xs text-muted-foreground">Emit all keys (not just non-defaults)</Label>
        </label>
      </OptionsBar>

      <Panel>
        <PanelHeader title={filename}>
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename={filename} />
        </PanelHeader>
        <pre className="overflow-auto p-3 font-mono text-xs">{output}</pre>
      </Panel>

      <Panel>
        <PanelHeader title=".prettierignore (optional presets)" />
        <div className="flex flex-wrap gap-x-5 gap-y-2 p-3">
          {IGNORE_PRESETS.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Switch
                checked={ignore[p.id] === true}
                onCheckedChange={(c) => setIgnore((prev) => ({ ...prev, [p.id]: c === true }))}
                id={`ig-${p.id}`}
              />
              <Label htmlFor={`ig-${p.id}`} className="text-xs text-muted-foreground">
                {p.label}
              </Label>
            </label>
          ))}
        </div>
        {anyIgnore && (
          <>
            <PanelHeader title=".prettierignore">
              <CopyButton value={() => ignoreText} />
              <DownloadButton data={() => ignoreText} filename=".prettierignore" />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs">{ignoreText}</pre>
          </>
        )}
      </Panel>
    </div>
  );
}
