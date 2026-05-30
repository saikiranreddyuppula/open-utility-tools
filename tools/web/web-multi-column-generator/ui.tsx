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
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type RuleStyle = 'solid' | 'dashed' | 'dotted' | 'double';
type ColumnSpan = 'none' | 'all';
type ColumnFill = 'balance' | 'auto';

const SAMPLE_TEXT =
  'Multi-column layout lets text flow into multiple newspaper-style columns. The browser automatically balances content across the available columns. This is useful for long passages of body text, glossaries, and lists where you want to use horizontal space efficiently. Resize the controls to see how the column count, width, and gap interact.';

function clampHex(value: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : '#cccccc';
}

export default function MultiColumnGenerator() {
  const [useCount, setUseCount] = useState(true);
  const [count, setCount] = useState(3);
  const [useWidth, setUseWidth] = useState(false);
  const [width, setWidth] = useState(200);
  const [gap, setGap] = useState(24);

  const [useRule, setUseRule] = useState(true);
  const [ruleWidth, setRuleWidth] = useState(1);
  const [ruleStyle, setRuleStyle] = useState<RuleStyle>('solid');
  const [ruleColor, setRuleColor] = useState('#d4d4d8');

  const [span, setSpan] = useState<ColumnSpan>('none');
  const [fill, setFill] = useState<ColumnFill>('balance');

  const css = useMemo(() => {
    const decls: string[] = [];

    // Use the `columns` shorthand when only count and/or width are set.
    if (useCount && useWidth) {
      decls.push(`columns: ${width}px ${count};`);
    } else if (useCount) {
      decls.push(`column-count: ${count};`);
    } else if (useWidth) {
      decls.push(`column-width: ${width}px;`);
    } else {
      decls.push(`column-count: auto;`);
    }

    if (gap !== 16) decls.push(`column-gap: ${gap}px;`);

    if (useRule) {
      decls.push(
        `column-rule: ${ruleWidth}px ${ruleStyle} ${clampHex(ruleColor)};`,
      );
    }

    if (fill !== 'balance') decls.push(`column-fill: ${fill};`);
    if (span !== 'none') decls.push(`column-span: ${span};`);

    const body = decls.map((d) => `  ${d}`).join('\n');
    return `.columns {\n${body}\n}`;
  }, [
    useCount,
    count,
    useWidth,
    width,
    gap,
    useRule,
    ruleWidth,
    ruleStyle,
    ruleColor,
    fill,
    span,
  ]);

  const previewStyle = useMemo(() => {
    const style: Record<string, string> = {
      columnGap: `${gap}px`,
    };
    if (useCount) style.columnCount = String(count);
    if (useWidth) style.columnWidth = `${width}px`;
    if (useRule)
      style.columnRule = `${ruleWidth}px ${ruleStyle} ${clampHex(ruleColor)}`;
    style.columnFill = fill;
    return style as React.CSSProperties;
  }, [useCount, count, useWidth, width, gap, useRule, ruleWidth, ruleStyle, ruleColor, fill]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Controls" />
        <div className="flex flex-col gap-4 p-3">
          <Field label="column-count">
            <div className="flex items-center gap-3">
              <Switch checked={useCount} onCheckedChange={setUseCount} />
              <Slider
                value={[count]}
                min={1}
                max={6}
                step={1}
                onValueChange={(v) => setCount(v[0] ?? 3)}
                className="flex-1"
                disabled={!useCount}
              />
              <span className="w-8 text-right font-mono text-sm">{count}</span>
            </div>
          </Field>
          <Field label="column-width (px)">
            <div className="flex items-center gap-3">
              <Switch checked={useWidth} onCheckedChange={setUseWidth} />
              <Slider
                value={[width]}
                min={50}
                max={400}
                step={10}
                onValueChange={(v) => setWidth(v[0] ?? 200)}
                className="flex-1"
                disabled={!useWidth}
              />
              <span className="w-12 text-right font-mono text-sm">{width}</span>
            </div>
          </Field>
          <Field label={`column-gap: ${gap}px`}>
            <Slider
              value={[gap]}
              min={0}
              max={80}
              step={2}
              onValueChange={(v) => setGap(v[0] ?? 24)}
            />
          </Field>

          <Field label="column-rule">
            <div className="flex flex-wrap items-center gap-2">
              <Switch checked={useRule} onCheckedChange={setUseRule} />
              <Input
                type="number"
                value={ruleWidth}
                min={0}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0) setRuleWidth(n);
                }}
                className="w-16"
                disabled={!useRule}
              />
              <Select
                value={ruleStyle}
                onValueChange={(v) => setRuleStyle(v as RuleStyle)}
              >
                <SelectTrigger className="w-28" disabled={!useRule}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">solid</SelectItem>
                  <SelectItem value="dashed">dashed</SelectItem>
                  <SelectItem value="dotted">dotted</SelectItem>
                  <SelectItem value="double">double</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="color"
                value={clampHex(ruleColor)}
                onChange={(e) => setRuleColor(e.target.value)}
                className="h-9 w-10 cursor-pointer rounded border bg-transparent"
                aria-label="Rule color"
                disabled={!useRule}
              />
            </div>
          </Field>

          <OptionsBar>
            <Field label="column-fill">
              <Select value={fill} onValueChange={(v) => setFill(v as ColumnFill)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">balance</SelectItem>
                  <SelectItem value="auto">auto</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="column-span">
              <Select value={span} onValueChange={(v) => setSpan(v as ColumnSpan)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">none</SelectItem>
                  <SelectItem value="all">all</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview & CSS">
          <CopyButton value={() => css} />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <div
            className="max-h-56 overflow-auto rounded-md border bg-background p-3 text-sm leading-relaxed"
            style={previewStyle}
          >
            {span === 'all' && (
              <h3 className="mb-2 text-base font-semibold" style={{ columnSpan: 'all' }}>
                Spanning heading
              </h3>
            )}
            {SAMPLE_TEXT}
          </div>
          <pre className="overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
            {css}
          </pre>
        </div>
        <StatBar
          items={[
            useCount ? `count ${count}` : 'count auto',
            useWidth ? `width ${width}px` : false,
            `gap ${gap}px`,
            useRule ? `rule ${ruleStyle}` : false,
          ]}
        />
      </Panel>
    </div>
  );
}
