'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';

function clampHex(v: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : '#000000';
}

function hexToRgba(hex: string, alpha: number): string {
  let h = clampHex(hex).replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CssButtonGeneratorTool() {
  const [bg, setBg] = useState('#4f46e5');
  const [text, setText] = useState('#ffffff');
  const [label, setLabel] = useState('Click me');
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState('600');
  const [padX, setPadX] = useState(20);
  const [padY, setPadY] = useState(10);
  const [radius, setRadius] = useState(8);
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderStyle, setBorderStyle] = useState<BorderStyle>('solid');
  const [borderColor, setBorderColor] = useState('#4338ca');
  const [shadowOn, setShadowOn] = useState(true);
  const [shX, setShX] = useState(0);
  const [shY, setShY] = useState(4);
  const [shBlur, setShBlur] = useState(12);
  const [shSpread, setShSpread] = useState(0);
  const [shColor, setShColor] = useState('#000000');
  const [shAlpha, setShAlpha] = useState(20);
  const [hoverBg, setHoverBg] = useState('#4338ca');
  const [hoverText, setHoverText] = useState('#ffffff');
  const [hoverLift, setHoverLift] = useState(2);
  const [transition, setTransition] = useState(150);

  const shadowValue = useMemo(
    () => `${shX}px ${shY}px ${shBlur}px ${shSpread}px ${hexToRgba(shColor, shAlpha / 100)}`,
    [shX, shY, shBlur, shSpread, shColor, shAlpha],
  );

  const baseStyle: CSSProperties = useMemo(
    () => ({
      backgroundColor: bg,
      color: text,
      fontSize: `${fontSize}px`,
      fontWeight: fontWeight,
      padding: `${padY}px ${padX}px`,
      borderRadius: `${radius}px`,
      border:
        borderWidth > 0 && borderStyle !== 'none'
          ? `${borderWidth}px ${borderStyle} ${borderColor}`
          : 'none',
      boxShadow: shadowOn ? shadowValue : 'none',
      transition: `all ${transition}ms ease`,
      cursor: 'pointer',
    }),
    [bg, text, fontSize, fontWeight, padY, padX, radius, borderWidth, borderStyle, borderColor, shadowOn, shadowValue, transition],
  );

  const css = useMemo(() => {
    const baseLines = [
      `  background-color: ${bg};`,
      `  color: ${text};`,
      `  font-size: ${fontSize}px;`,
      `  font-weight: ${fontWeight};`,
      `  padding: ${padY}px ${padX}px;`,
      `  border-radius: ${radius}px;`,
      borderWidth > 0 && borderStyle !== 'none'
        ? `  border: ${borderWidth}px ${borderStyle} ${borderColor};`
        : '  border: none;',
      shadowOn ? `  box-shadow: ${shadowValue};` : null,
      `  transition: all ${transition}ms ease;`,
      '  cursor: pointer;',
    ].filter((l): l is string => l !== null);

    const hoverLines = [
      `  background-color: ${hoverBg};`,
      `  color: ${hoverText};`,
      hoverLift !== 0 ? `  transform: translateY(${-hoverLift}px);` : null,
    ].filter((l): l is string => l !== null);

    return `.btn {\n${baseLines.join('\n')}\n}\n\n.btn:hover {\n${hoverLines.join('\n')}\n}`;
  }, [
    bg,
    text,
    fontSize,
    fontWeight,
    padY,
    padX,
    radius,
    borderWidth,
    borderStyle,
    borderColor,
    shadowOn,
    shadowValue,
    transition,
    hoverBg,
    hoverText,
    hoverLift,
  ]);

  const colorField = (lbl: string, val: string, set: (v: string) => void) => (
    <Field label={lbl} className="w-36">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={clampHex(val)}
          onChange={(e) => set(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border bg-transparent"
          aria-label={lbl}
        />
        <Input value={val} onChange={(e) => set(e.target.value)} className="font-mono" />
      </div>
    </Field>
  );

  const sliderField = (lbl: string, val: number, set: (n: number) => void, min: number, max: number) => (
    <Field label={`${lbl}: ${val}`} className="min-w-[160px] flex-1">
      <Slider value={[val]} min={min} max={max} step={1} onValueChange={(v) => set(v[0] ?? val)} />
    </Field>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Controls" />
        <div className="space-y-3 p-3">
          <OptionsBar>
            {colorField('Background', bg, setBg)}
            {colorField('Text', text, setText)}
            <Field label="Label" className="min-w-[120px] flex-1">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
          </OptionsBar>
          <OptionsBar>
            {sliderField('Font size', fontSize, setFontSize, 8, 48)}
            <Field label="Font weight" className="w-32">
              <Select value={fontWeight} onValueChange={setFontWeight}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['300', '400', '500', '600', '700', '800'].map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>
          <OptionsBar>
            {sliderField('Padding X', padX, setPadX, 0, 64)}
            {sliderField('Padding Y', padY, setPadY, 0, 48)}
            {sliderField('Radius', radius, setRadius, 0, 50)}
          </OptionsBar>
          <OptionsBar>
            {sliderField('Border width', borderWidth, setBorderWidth, 0, 12)}
            <Field label="Border style" className="w-32">
              <Select value={borderStyle} onValueChange={(v) => setBorderStyle(v as BorderStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['none', 'solid', 'dashed', 'dotted'] as BorderStyle[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {colorField('Border color', borderColor, setBorderColor)}
          </OptionsBar>
          <OptionsBar>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Switch checked={shadowOn} onCheckedChange={setShadowOn} /> Box shadow
            </Label>
          </OptionsBar>
          {shadowOn && (
            <OptionsBar>
              {sliderField('Shadow X', shX, setShX, -40, 40)}
              {sliderField('Shadow Y', shY, setShY, -40, 40)}
              {sliderField('Blur', shBlur, setShBlur, 0, 80)}
              {sliderField('Spread', shSpread, setShSpread, -40, 40)}
              {colorField('Shadow color', shColor, setShColor)}
              {sliderField('Shadow opacity', shAlpha, setShAlpha, 0, 100)}
            </OptionsBar>
          )}
          <OptionsBar>
            {colorField('Hover bg', hoverBg, setHoverBg)}
            {colorField('Hover text', hoverText, setHoverText)}
            {sliderField('Hover lift', hoverLift, setHoverLift, -10, 10)}
            {sliderField('Transition ms', transition, setTransition, 0, 600)}
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview & CSS">
          <CopyButton value={() => css} label="Copy CSS" />
        </PanelHeader>
        <div className="flex min-h-[160px] items-center justify-center rounded-md border bg-muted/40 p-8">
          <button type="button" style={baseStyle} className="css-btn-preview">
            {label || 'Button'}
          </button>
        </div>
        <style>{`.css-btn-preview:hover{background-color:${hoverBg} !important;color:${hoverText} !important;transform:translateY(${-hoverLift}px) !important;}`}</style>
        <div className="p-3">
          <pre className="overflow-auto whitespace-pre rounded bg-muted px-3 py-2 font-mono text-xs">{css}</pre>
        </div>
        <StatBar items={[`${fontSize}px / ${fontWeight}`, `radius ${radius}px`, shadowOn ? 'shadow on' : 'no shadow']} />
      </Panel>
    </div>
  );
}
