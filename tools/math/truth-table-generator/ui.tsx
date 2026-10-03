'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  MAX_VARS,
  WARN_VARS,
  buildTruthTable,
  canonicalPos,
  canonicalSop,
  checkEquivalence,
  classify,
  clauseText,
  collectVariables,
  implicantMinterms,
  implicantPieces,
  indicesOf,
  kmapLayout,
  maxtermNotation,
  minimalForms,
  mintermNotation,
  parseExpr,
  parseNumberList,
  parseVariableList,
  posText,
  productText,
  rowBits,
  sopText,
  sortVariables,
  tableFromMinterms,
  tableToCsv,
  tableToLatex,
  tableToMarkdown,
  toFullyParenthesised,
  type Expr,
  type FormStyle,
  type Implicant,
  type KmapLayout,
  type Minimal,
  type MinimizeResult,
  type TruthTable,
  type ValueStyle,
} from './logic';

type InputMode = 'expr' | 'minterms';
const SYNC_MIN_VARS = 8;
type VarOrder = 'alpha' | 'appearance';

const EXAMPLES: { label: string; expr: string; implicit?: boolean }[] = [
  { label: 'Consensus theorem', expr: '(A & B) | (!A & C) | (B & C)' },
  { label: 'Majority of three (AB + BC + AC)', expr: 'AB + BC + AC', implicit: true },
  { label: 'Multiplexer (S ? B : A)', expr: '(S & B) | (!S & A)' },
  { label: 'Full adder carry', expr: '(A & B) | (C & (A ^ B))' },
  { label: 'Full adder sum', expr: 'A ^ B ^ C' },
  { label: 'Modus ponens (tautology)', expr: '((P -> Q) & P) -> Q' },
  { label: "De Morgan's law", expr: '!(A & B) <-> (!A | !B)' },
  { label: 'XOR built from NAND', expr: '(A NAND (A NAND B)) NAND (B NAND (A NAND B))' },
  { label: 'Contradiction', expr: 'A & !A' },
  { label: 'Word variables', expr: '(rain AND wet) -> (cold OR windy)' },
];

const GROUP_COLORS = ['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ------------------------------------------------------------------ model

interface Model {
  table: TruthTable;
  vars: string[];
  expr: Expr | null;
  full: string | null;
  warnings: string[];
}

function orderVars(found: string[], mode: VarOrder, custom: string): { vars: string[]; warning: string | null } {
  const base = mode === 'alpha' ? sortVariables(found) : found.slice();
  if (custom.trim() === '') return { vars: base, warning: null };
  try {
    const list = parseVariableList(custom);
    const missing = found.filter((v) => !list.includes(v));
    if (missing.length > 0) {
      return { vars: base, warning: `Custom order ignored: it must include ${missing.join(', ')}.` };
    }
    return { vars: list, warning: null };
  } catch (e) {
    return { vars: base, warning: `Custom order ignored: ${errMsg(e)}` };
  }
}

function buildModel(
  mode: InputMode,
  exprText: string,
  implicit: boolean,
  showSub: boolean,
  order: VarOrder,
  customOrder: string,
  varsText: string,
  mintermText: string,
  dcText: string
): Model {
  const warnings: string[] = [];
  if (mode === 'expr') {
    const expr = parseExpr(exprText, { implicitAnd: implicit });
    const found = collectVariables(expr);
    const { vars, warning } = orderVars(found, order, customOrder);
    if (warning) warnings.push(warning);
    if (vars.length > MAX_VARS) throw new Error(`This expression has ${vars.length} variables; the limit is ${MAX_VARS} (a table that large would have ${(2 ** vars.length).toLocaleString()} rows).`);
    if (vars.length > WARN_VARS) warnings.push(`${vars.length} variables means ${(2 ** vars.length).toLocaleString()} rows. The table is long, and above ${WARN_VARS} variables the minimal forms fall back to a greedy (not guaranteed minimal) cover when the exact search gets too large.`);
    const table = buildTruthTable(expr, vars, showSub);
    return { table, vars, expr, full: toFullyParenthesised(expr), warnings };
  }
  const vars = parseVariableList(varsText);
  if (vars.length === 0) throw new Error('List the variable names, for example A, B, C, D.');
  if (vars.length > MAX_VARS) throw new Error(`At most ${MAX_VARS} variables are supported.`);
  if (vars.length > WARN_VARS) warnings.push(`${vars.length} variables means ${(2 ** vars.length).toLocaleString()} rows.`);
  const ones = parseNumberList(mintermText, vars.length);
  const dcs = parseNumberList(dcText, vars.length);
  const both = ones.filter((m) => dcs.includes(m));
  if (both.length > 0) throw new Error(`Minterm ${both[0]} is listed as both a 1 and a don't-care.`);
  const table = tableFromMinterms(vars, ones, dcs);
  return { table, vars, expr: null, full: null, warnings };
}

// ------------------------------------------------------------------ K-map

function KmapSvg({
  layout,
  result,
  groups,
  vars,
  mode,
}: {
  layout: KmapLayout;
  result: Uint8Array;
  groups: Implicant[];
  vars: string[];
  mode: 'sop' | 'pos';
}) {
  const cell = 64;
  const left = 70;
  const top = 58;
  const rows = layout.rowCodes.length;
  const cols = layout.colCodes.length;
  const W = left + cols * cell + 12;
  const H = top + rows * cell + 12;
  const bits = (code: number, n: number) => code.toString(2).padStart(n, '0');
  const target = mode === 'sop' ? 1 : 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full" style={{ maxWidth: W * 1.4 }} role="img" aria-label="Karnaugh map">
      <text x={left - 8} y={top - 30} textAnchor="end" fontSize="11" className="fill-muted-foreground" fontFamily="ui-monospace, monospace">
        {layout.rowVars.join('')}\{layout.colVars.join('')}
      </text>
      <text x={left + (cols * cell) / 2} y={top - 30} textAnchor="middle" fontSize="12" fontWeight="600" className="fill-foreground" fontFamily="ui-monospace, monospace">
        {layout.colVars.join('')}
      </text>
      {layout.colCodes.map((code, c) => (
        <text key={`ch${c}`} x={left + c * cell + cell / 2} y={top - 10} textAnchor="middle" fontSize="12" className="fill-muted-foreground" fontFamily="ui-monospace, monospace">
          {bits(code, layout.colBits)}
        </text>
      ))}
      <text x={14} y={top + (rows * cell) / 2} textAnchor="middle" fontSize="12" fontWeight="600" className="fill-foreground" fontFamily="ui-monospace, monospace" transform={`rotate(-90 14 ${top + (rows * cell) / 2})`}>
        {layout.rowVars.join('')}
      </text>
      {layout.rowCodes.map((code, r) => (
        <text key={`rh${r}`} x={left - 10} y={top + r * cell + cell / 2 + 4} textAnchor="end" fontSize="12" className="fill-muted-foreground" fontFamily="ui-monospace, monospace">
          {bits(code, layout.rowBits)}
        </text>
      ))}
      {layout.cells.map((row, r) =>
        row.map((m, c) => {
          const v = result[m] ?? 0;
          return (
            <g key={`c${r}-${c}`}>
              <rect
                x={left + c * cell}
                y={top + r * cell}
                width={cell}
                height={cell}
                className={cn('stroke-border', v === 1 && 'fill-primary/10', v === 2 && 'fill-warning/15', v === 0 && 'fill-transparent')}
                strokeWidth={1}
              />
              <text
                x={left + c * cell + cell / 2}
                y={top + r * cell + cell / 2 + 7}
                textAnchor="middle"
                fontSize="20"
                fontWeight={v === target ? 700 : 400}
                className={v === 2 ? 'fill-warning' : v === target ? 'fill-foreground' : 'fill-muted-foreground'}
                fontFamily="ui-monospace, monospace"
              >
                {v === 2 ? 'X' : v}
              </text>
              <text x={left + c * cell + cell - 5} y={top + r * cell + 12} textAnchor="end" fontSize="9" className="fill-muted-foreground" fontFamily="ui-monospace, monospace">
                {m}
              </text>
            </g>
          );
        })
      )}
      {groups.map((g, gi) => {
        const color = GROUP_COLORS[gi % GROUP_COLORS.length] as string;
        const inset = 4 + (gi % 3) * 3;
        return (
          <g key={`g${gi}`}>
            {implicantPieces(g, layout).map((p, pi) => {
              const x0 = left + p.c * cell + (p.openLeft ? 0 : inset);
              const y0 = top + p.r * cell + (p.openTop ? 0 : inset);
              const x1 = left + (p.c + p.w) * cell - (p.openRight ? 0 : inset);
              const y1 = top + (p.r + p.h) * cell - (p.openBottom ? 0 : inset);
              const sides: string[] = [];
              if (!p.openTop) sides.push(`M${x0} ${y0} H${x1}`);
              if (!p.openBottom) sides.push(`M${x0} ${y1} H${x1}`);
              if (!p.openLeft) sides.push(`M${x0} ${y0} V${y1}`);
              if (!p.openRight) sides.push(`M${x1} ${y0} V${y1}`);
              return (
                <g key={pi}>
                  <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={color} fillOpacity={0.14} rx={p.openLeft || p.openRight || p.openTop || p.openBottom ? 0 : 10} />
                  <path d={sides.join(' ')} stroke={color} strokeWidth={2.5} strokeLinecap="round" fill="none" />
                </g>
              );
            })}
          </g>
        );
      })}
      <text x={W - 10} y={H - 1} textAnchor="end" fontSize="9" className="fill-muted-foreground">
        {vars.length} variables, Gray-code axes
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ small pieces

function FormRow({ label, text, extra }: { label: string; text: string; extra?: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <div className="w-36 shrink-0 pt-0.5 text-xs text-muted-foreground">{label}</div>
      <div className="min-w-0 flex-1">
        <div className="break-words font-mono text-sm">{text}</div>
        {extra && <div className="text-2xs text-muted-foreground">{extra}</div>}
      </div>
      <CopyButton value={text} size="icon-sm" />
    </div>
  );
}

function countLits(cover: Implicant[], n: number): number {
  return cover.reduce((s, i) => s + (n - i.mask.toString(2).split('1').length + 1), 0);
}

function Operators() {
  const rows: [string, string][] = [
    ['NOT', "!  ~  ¬  NOT   or postfix  A'"],
    ['AND', '&  &&  ∧  ·  *  .  AND   (or AB with implicit AND)'],
    ['OR', '|  ||  ∨  +  OR'],
    ['XOR', '^  ⊕  !=  XOR'],
    ['NAND / NOR / XNOR', 'NAND ⊼ ↑   |   NOR ⊽ ↓   |   XNOR ⊙'],
    ['IMPLIES', '->  =>  →  ⇒  IMPLIES   (right-associative)'],
    ['IFF', '<->  <=>  ↔  ==  ≡  IFF'],
    ['Constants', '0  1  true  false'],
  ];
  return (
    <details className="rounded-md border bg-muted/20 text-xs">
      <summary className="cursor-pointer px-3 py-2 font-medium">Operator notations and precedence</summary>
      <div className="space-y-1 border-t px-3 py-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-x-3">
            <span className="w-36 shrink-0 text-muted-foreground">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
        <div className="pt-1 text-muted-foreground">
          Precedence, high to low: NOT, AND (NAND), XOR (XNOR), OR (NOR), IMPLIES, IFF. Use parentheses ( ) [ ] to be explicit. Variable names are letters,
          digits and underscores, starting with a letter.
        </div>
      </div>
    </details>
  );
}

// ------------------------------------------------------------------ main

const MAX_RENDER_ROWS = 1024;

export default function TruthTableGeneratorTool() {
  const [mode, setMode] = useState<InputMode>('expr');
  const [exprText, setExprText] = useState('(A & B) | (!A & C) | (B & C)');
  const [implicit, setImplicit] = useState(false);
  const [valueStyle, setValueStyle] = useState<ValueStyle>('01');
  const [showSub, setShowSub] = useState(true);
  const [order, setOrder] = useState<VarOrder>('alpha');
  const [customOrder, setCustomOrder] = useState('');
  const [formStyle, setFormStyle] = useState<FormStyle>('prime');
  const [varsText, setVarsText] = useState('A, B, C, D');
  const [mintermText, setMintermText] = useState('4, 8, 10, 11, 12, 15');
  const [dcText, setDcText] = useState('9, 14');
  const [kmapMode, setKmapMode] = useState<'sop' | 'pos'>('sop');
  const [secondText, setSecondText] = useState('(A & B) | (!A & C)');

  const built = useMemo(() => {
    try {
      return { model: buildModel(mode, exprText, implicit, showSub, order, customOrder, varsText, mintermText, dcText), error: null as string | null };
    } catch (e) {
      return { model: null, error: errMsg(e) };
    }
  }, [mode, exprText, implicit, showSub, order, customOrder, varsText, mintermText, dcText]);

  const model = built.model;

  const modelVarCount = model ? model.vars.length : 0;
  const syncMin = useMemo(() => {
    if (!model || modelVarCount > SYNC_MIN_VARS) return null;
    try {
      return { min: minimalForms(model.table.result, modelVarCount), error: null as string | null };
    } catch (e) {
      return { min: null, error: errMsg(e) };
    }
  }, [model, modelVarCount]);

  // many variables: minimise after a short pause so typing stays responsive
  const [asyncMin, setAsyncMin] = useState<{ table: TruthTable; min: Minimal | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!model || modelVarCount <= SYNC_MIN_VARS) return;
    let cancelled = false;
    const t = setTimeout(() => {
      let res: { min: Minimal | null; error: string | null };
      try {
        res = { min: minimalForms(model.table.result, modelVarCount), error: null };
      } catch (e) {
        res = { min: null, error: errMsg(e) };
      }
      if (!cancelled) setAsyncMin({ table: model.table, ...res });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [model, modelVarCount]);

  const analysis = useMemo(() => {
    if (!model) return null;
    const { table } = model;
    const ones = indicesOf(table.result, 1);
    const zeros = indicesOf(table.result, 0);
    const dcs = indicesOf(table.result, 2);
    const minSource = modelVarCount <= SYNC_MIN_VARS ? syncMin : asyncMin && asyncMin.table === table ? asyncMin : null;
    return {
      ones,
      zeros,
      dcs,
      kind: dcs.length === 0 ? classify(table.result) : null,
      min: minSource ? minSource.min : null,
      minError: minSource ? minSource.error : null,
      minPending: minSource === null,
    };
  }, [model, modelVarCount, syncMin, asyncMin]);

  const second = useMemo(() => {
    if (mode !== 'expr' || !model || !model.expr) return null;
    if (secondText.trim() === '') return { error: null as string | null, result: null };
    try {
      const e2 = parseExpr(secondText, { implicitAnd: implicit });
      return { error: null as string | null, result: checkEquivalence(model.expr, e2), e2 };
    } catch (e) {
      return { error: `Second expression: ${errMsg(e)}`, result: null };
    }
  }, [mode, model, secondText, implicit]);

  const layout = useMemo(() => (model ? kmapLayout(model.vars) : null), [model]);

  const exportText = (kind: 'csv' | 'md' | 'tex'): string => {
    if (!model) return '';
    if (kind === 'csv') return tableToCsv(model.table, valueStyle);
    if (kind === 'md') return tableToMarkdown(model.table, valueStyle);
    return tableToLatex(model.table, valueStyle);
  };

  const loadExample = (idx: string) => {
    const ex = EXAMPLES[Number(idx)];
    if (!ex) return;
    setMode('expr');
    setExprText(ex.expr);
    setImplicit(ex.implicit === true);
    setCustomOrder('');
  };

  const cellText = (v: number): string => (v === 2 ? 'X' : valueStyle === '01' ? String(v) : v === 1 ? 'T' : 'F');

  const n = model ? model.vars.length : 0;
  const shownRows = model ? Math.min(model.table.rows, MAX_RENDER_ROWS) : 0;
  const best = analysis?.min;
  const eq = second?.result ?? null;

  const groups: Implicant[] = best ? (kmapMode === 'sop' ? best.sop.cover : best.pos.cover) : [];
  const groupMinResult: MinimizeResult | null = best ? (kmapMode === 'sop' ? best.sop : best.pos) : null;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Input">
          <Tabs value={mode} onValueChange={(v) => setMode(v as InputMode)}>
            <TabsList className="h-7">
              <TabsTrigger value="expr">Boolean expression</TabsTrigger>
              <TabsTrigger value="minterms">Minterms &amp; don&apos;t-cares</TabsTrigger>
            </TabsList>
          </Tabs>
        </PanelHeader>
        <div className="space-y-3 p-3">
          {mode === 'expr' ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Select value="" onValueChange={loadExample}>
                  <SelectTrigger className="w-64" aria-label="Load an example">
                    <SelectValue placeholder="Load an example..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAMPLES.map((ex, k) => (
                      <SelectItem key={ex.label} value={String(k)}>
                        {ex.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={exprText}
                onChange={(e) => setExprText(e.target.value)}
                spellCheck={false}
                aria-label="Boolean expression"
                placeholder="(A & B) | !C"
                className="min-h-[72px] font-mono text-base"
              />
              <Operators />
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Variables (first = most significant bit)" hint="2-4 variables also give a K-map">
                <Input value={varsText} onChange={(e) => setVarsText(e.target.value)} className="font-mono" aria-label="Variable names" spellCheck={false} />
              </Field>
              <Field label="Minterms (function = 1)" hint="e.g. 0, 1, 5-7 or Σm(...)">
                <Input value={mintermText} onChange={(e) => setMintermText(e.target.value)} className="font-mono" aria-label="Minterms" spellCheck={false} />
              </Field>
              <Field label="Don't-cares" hint="optional">
                <Input value={dcText} onChange={(e) => setDcText(e.target.value)} className="font-mono" aria-label="Don't-care minterms" spellCheck={false} />
              </Field>
            </div>
          )}
        </div>
      </Panel>

      <OptionsBar>
        {mode === 'expr' && (
          <>
            <Field label="Implicit AND (AB = A·B)">
              <div className="flex h-8 items-center">
                <Switch checked={implicit} onCheckedChange={setImplicit} aria-label="Implicit AND" />
              </div>
            </Field>
            <Field label="Intermediate columns">
              <div className="flex h-8 items-center">
                <Switch checked={showSub} onCheckedChange={setShowSub} aria-label="Show intermediate columns" />
              </div>
            </Field>
            <Field label="Variable order">
              <Tabs value={order} onValueChange={(v) => setOrder(v as VarOrder)}>
                <TabsList>
                  <TabsTrigger value="alpha">Alphabetical</TabsTrigger>
                  <TabsTrigger value="appearance">As written</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Custom order (optional)">
              <Input value={customOrder} onChange={(e) => setCustomOrder(e.target.value)} placeholder="e.g. D, C, B, A" className="w-40 font-mono" aria-label="Custom variable order" spellCheck={false} />
            </Field>
          </>
        )}
        <Field label="Show values as">
          <Tabs value={valueStyle} onValueChange={(v) => setValueStyle(v as ValueStyle)}>
            <TabsList>
              <TabsTrigger value="01">1 / 0</TabsTrigger>
              <TabsTrigger value="TF">T / F</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Write formulas as">
          <Tabs value={formStyle} onValueChange={(v) => setFormStyle(v as FormStyle)}>
            <TabsList>
              <TabsTrigger value="prime">A&apos;B + C</TabsTrigger>
              <TabsTrigger value="symbols">¬A ∧ B ∨ C</TabsTrigger>
              <TabsTrigger value="code">!A &amp; B | C</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <ErrorBanner error={built.error} />
      {model?.warnings.map((w, k) => (
        <div key={k} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          {w}
        </div>
      ))}

      {model && analysis && (
        <>
          {model.full && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">Parsed as</span>
              <span className="min-w-0 flex-1 break-words font-mono">{model.full}</span>
              <CopyButton value={model.full} size="icon-sm" />
            </div>
          )}

          <Panel>
            <PanelHeader title="Truth table" />
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full border-collapse text-center text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr className="text-xs">
                    <th className="px-2 py-1.5 font-medium text-muted-foreground">#</th>
                    {model.vars.map((v) => (
                      <th key={v} className="border-l px-3 py-1.5 font-mono font-semibold">
                        {v}
                      </th>
                    ))}
                    {model.table.columns.map((c, k) => (
                      <th
                        key={k}
                        className={cn('whitespace-nowrap border-l px-3 py-1.5 font-mono', c.isResult ? 'bg-primary/10 font-semibold' : 'font-normal text-muted-foreground')}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {Array.from({ length: shownRows }, (_, m) => {
                    const r = model.table.result[m] ?? 0;
                    return (
                      <tr key={m} className={cn('border-t', r === 1 && 'bg-success/10', r === 2 && 'bg-warning/10')}>
                        <td className="px-2 py-1 text-xs text-muted-foreground">{m}</td>
                        {rowBits(m, n).map((b, k) => (
                          <td key={k} className="border-l px-3 py-1">
                            {cellText(b)}
                          </td>
                        ))}
                        {model.table.columns.map((c, k) => {
                          const v = c.values[m] ?? 0;
                          return (
                            <td key={k} className={cn('border-l px-3 py-1', c.isResult && 'font-semibold', c.isResult && v === 1 && 'text-success')}>
                              {cellText(v)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">
              <span className="px-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Export</span>
              <CopyButton value={() => exportText('csv')} label="CSV" />
              <CopyButton value={() => exportText('md')} label="Markdown" />
              <CopyButton value={() => exportText('tex')} label="LaTeX" />
              <DownloadButton data={() => exportText('csv')} filename="truth-table.csv" mime="text/csv" label="CSV file" />
            </div>
            <StatBar className="h-auto min-h-7 py-1"
              items={[
                `${n} variable${n === 1 ? '' : 's'}`,
                `${model.table.rows} rows`,
                `${analysis.ones.length} true`,
                `${analysis.zeros.length} false`,
                analysis.dcs.length > 0 && `${analysis.dcs.length} don't-care`,
                model.table.rows > shownRows && `showing first ${shownRows} rows (exports contain all)`,
                'rows in binary order, first variable = MSB',
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Analysis">
              {analysis.kind && (
                <Badge variant={analysis.kind === 'contingency' ? 'secondary' : 'default'} className="mr-1">
                  {analysis.kind}
                </Badge>
              )}
            </PanelHeader>
            <div className="divide-y">
              {analysis.kind && (
                <FormRow
                  label="Classification"
                  text={analysis.kind}
                  extra={
                    analysis.kind === 'tautology'
                      ? 'True for every assignment.'
                      : analysis.kind === 'contradiction'
                        ? 'False for every assignment.'
                        : 'True for some assignments and false for others.'
                  }
                />
              )}
              <FormRow label="Minterms" text={mintermNotation(analysis.ones, analysis.dcs)} />
              <FormRow label="Maxterms" text={maxtermNotation(analysis.zeros, analysis.dcs)} />
              <FormRow label="Canonical SOP" text={analysis.ones.length === 0 ? '0' : canonicalSop(analysis.ones, model.vars, formStyle)} extra="sum of all minterms" />
              <FormRow label="Canonical POS" text={analysis.zeros.length === 0 ? '1' : canonicalPos(analysis.zeros, model.vars, formStyle)} extra="product of all maxterms" />
              {analysis.min && (
                <>
                  <FormRow
                    label="Minimal SOP"
                    text={sopText(analysis.min.sop.cover, model.vars, formStyle)}
                    extra={`${analysis.min.sop.cover.length} term${analysis.min.sop.cover.length === 1 ? '' : 's'}, ${countLits(analysis.min.sop.cover, n)} literal${countLits(analysis.min.sop.cover, n) === 1 ? '' : 's'}${analysis.min.sop.exact ? ' (exact: Quine-McCluskey + Petrick)' : ' (greedy cover)'}${analysis.dcs.length > 0 ? '; don\'t-cares used where helpful' : ''}`}
                  />
                  {analysis.min.sop.alternatives.slice(0, 4).map((alt, k) => (
                    <FormRow key={k} label={k === 0 ? 'Equal-cost alternatives' : ''} text={sopText(alt, model.vars, formStyle)} />
                  ))}
                  <FormRow
                    label="Minimal POS"
                    text={posText(analysis.min.pos.cover, model.vars, formStyle)}
                    extra={`${analysis.min.pos.cover.length} sum${analysis.min.pos.cover.length === 1 ? '' : 's'}, ${countLits(analysis.min.pos.cover, n)} literal${countLits(analysis.min.pos.cover, n) === 1 ? '' : 's'}${analysis.min.pos.exact ? ' (exact)' : ' (greedy cover)'}`}
                  />
                  {analysis.min.pos.alternatives.slice(0, 4).map((alt, k) => (
                    <FormRow key={k} label={k === 0 ? 'Equal-cost alternatives' : ''} text={posText(alt, model.vars, formStyle)} />
                  ))}
                </>
              )}
            </div>
            {analysis.minPending && <div className="border-t px-3 py-2 text-xs text-muted-foreground">Finding minimal forms...</div>}
            {analysis.minError && <div className="border-t px-3 py-2 text-xs text-destructive">{analysis.minError}</div>}
            {analysis.min && (analysis.min.sop.note || analysis.min.pos.note) && (
              <div className="border-t bg-warning/10 px-3 py-2 text-xs">{analysis.min.sop.note ?? analysis.min.pos.note}</div>
            )}
            <StatBar className="h-auto min-h-7 py-1"
              items={[
                analysis.min && analysis.min.sop.primesComplete && `${analysis.min.sop.primes.length} prime implicants (1s)`,
                analysis.min && analysis.min.sop.primesComplete && `${analysis.min.sop.essential.length} essential`,
                'SOP = OR of ANDs, POS = AND of ORs',
              ]}
            />
          </Panel>

          {layout && best && (
            <Panel>
              <PanelHeader title="Karnaugh map">
                <Tabs value={kmapMode} onValueChange={(v) => setKmapMode(v as 'sop' | 'pos')}>
                  <TabsList className="h-7">
                    <TabsTrigger value="sop">Group 1s (SOP)</TabsTrigger>
                    <TabsTrigger value="pos">Group 0s (POS)</TabsTrigger>
                  </TabsList>
                </Tabs>
              </PanelHeader>
              <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                <KmapSvg layout={layout} result={model.table.result} groups={groups} vars={model.vars} mode={kmapMode} />
                <div className="space-y-2">
                  <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {kmapMode === 'sop' ? 'Groups of 1s (product terms)' : 'Groups of 0s (sum clauses)'}
                  </div>
                  {groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{kmapMode === 'sop' ? 'The function is 0 everywhere: no groups.' : 'The function is 1 everywhere: no groups.'}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {groups.map((g, k) => {
                        const isEssential = groupMinResult?.essential.some((e) => e.value === g.value && e.mask === g.mask);
                        const term = kmapMode === 'sop' ? productText(g, model.vars, formStyle) : `(${clauseText(g, model.vars, formStyle)})`;
                        return (
                          <li key={k} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ backgroundColor: GROUP_COLORS[k % GROUP_COLORS.length] }} />
                            <div className="min-w-0">
                              <div className="break-words font-mono">{term}</div>
                              <div className="text-2xs text-muted-foreground">
                                covers {implicantMinterms(g, n).join(', ')}
                                {isEssential ? ' (essential)' : ''}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="text-2xs text-muted-foreground">
                    X marks a don&apos;t-care. Groups that run off one edge continue on the opposite edge (the map wraps around); they are drawn
                    open on that side.
                  </p>
                </div>
              </div>
            </Panel>
          )}
          {!layout && n > 4 && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              A Karnaugh map is drawn for 2 to 4 variables.
            </div>
          )}

          {mode === 'expr' && (
            <Panel>
              <PanelHeader title="Equivalence checker" />
              <div className="space-y-3 p-3">
                <Field label="Compare with another expression" hint="Uses the same notation and implicit-AND setting.">
                  <Input value={secondText} onChange={(e) => setSecondText(e.target.value)} className="font-mono" aria-label="Second expression" spellCheck={false} />
                </Field>
                <ErrorBanner error={second?.error ?? null} />
                {eq && (
                  <div className="space-y-2">
                    <div
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm font-medium',
                        eq.equivalent ? 'border-success/40 bg-success/10 text-success' : 'border-destructive/40 bg-destructive/10 text-destructive'
                      )}
                    >
                      {eq.equivalent
                        ? `Equivalent: both expressions agree on all ${eq.rows.toLocaleString()} assignments of ${eq.vars.join(', ') || 'no variables'}.`
                        : `Not equivalent: they differ on ${eq.differences.toLocaleString()} of ${eq.rows.toLocaleString()} assignments.`}
                    </div>
                    {!eq.equivalent && (
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-center text-sm">
                          <thead className="bg-muted text-xs">
                            <tr>
                              {eq.vars.map((v) => (
                                <th key={v} className="px-3 py-1 font-mono">
                                  {v}
                                </th>
                              ))}
                              <th className="border-l px-3 py-1">Expression 1</th>
                              <th className="px-3 py-1">Expression 2</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono">
                            {eq.counterexamples.map((ce, k) => (
                              <tr key={k} className="border-t">
                                {eq.vars.map((v) => (
                                  <td key={v} className="px-3 py-1">
                                    {cellText(ce.assignment[v] ? 1 : 0)}
                                  </td>
                                ))}
                                <td className="border-l px-3 py-1">{cellText(ce.a ? 1 : 0)}</td>
                                <td className="px-3 py-1">{cellText(ce.b ? 1 : 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="border-t bg-muted/30 px-3 py-1 text-2xs text-muted-foreground">
                          Counterexamples{eq.differences > eq.counterexamples.length ? ` (first ${eq.counterexamples.length})` : ''}: assignments where the two expressions give different results.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
