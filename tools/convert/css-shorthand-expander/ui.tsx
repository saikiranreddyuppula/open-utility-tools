'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'expand' | 'collapse';

const SAMPLE = `margin: 10px 20px;
padding: 5px 10px 15px 20px;
border: 1px solid #333;
border-radius: 4px 8px;
inset: 0;
gap: 8px 16px;
overflow: hidden auto;
place-items: center start;
flex: 1 1 auto;
background: #fff url(bg.png) no-repeat center / cover;
font: italic bold 14px/1.5 Arial, sans-serif;
list-style: square inside url(dot.png);
outline: 2px dashed red;
transition: opacity 0.3s ease-in 0s;`;

/** Split a CSS value into space-separated tokens, keeping parentheses/quotes intact. */
function tokenize(value: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i] ?? '';
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ' ' || ch === '\t' || ch === '\n') && depth === 0) {
      if (cur.trim() !== '') tokens.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== '') tokens.push(cur.trim());
  return tokens;
}

/** 1-4 value box distribution -> [top, right, bottom, left]. */
function boxSides(tokens: string[]): [string, string, string, string] | null {
  const t = tokens;
  const v0 = t[0];
  if (v0 === undefined) return null;
  if (t.length === 1) return [v0, v0, v0, v0];
  const v1 = t[1] ?? v0;
  if (t.length === 2) return [v0, v1, v0, v1];
  const v2 = t[2] ?? v0;
  if (t.length === 3) return [v0, v1, v2, v1];
  const v3 = t[3] ?? v1;
  return [v0, v1, v2, v3];
}

const SIDE_NAMES = ['top', 'right', 'bottom', 'left'] as const;

function expandDeclaration(prop: string, value: string): Array<[string, string]> {
  const p = prop.toLowerCase();
  const tokens = tokenize(value);

  if (p === 'margin' || p === 'padding') {
    const sides = boxSides(tokens);
    if (!sides) return [[prop, value]];
    return SIDE_NAMES.map((s, i) => [`${p}-${s}`, sides[i] ?? sides[0]] as [string, string]);
  }

  if (p === 'border-width' || p === 'border-color' || p === 'border-style') {
    const which = p.split('-')[1] ?? 'width';
    const sides = boxSides(tokens);
    if (!sides) return [[prop, value]];
    return SIDE_NAMES.map((s, i) => [`border-${s}-${which}`, sides[i] ?? sides[0]] as [string, string]);
  }

  if (p === 'inset') {
    const sides = boxSides(tokens);
    if (!sides) return [[prop, value]];
    return SIDE_NAMES.map((s, i) => [s, sides[i] ?? sides[0]] as [string, string]);
  }

  if (p === 'border-radius') {
    const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
    const sides = boxSides(tokens);
    if (!sides) return [[prop, value]];
    return corners.map((c, i) => [`border-${c}-radius`, sides[i] ?? sides[0]] as [string, string]);
  }

  if (p === 'gap') {
    const row = tokens[0] ?? '0';
    const col = tokens[1] ?? row;
    return [['row-gap', row], ['column-gap', col]];
  }

  if (p === 'overflow') {
    const x = tokens[0] ?? 'visible';
    const y = tokens[1] ?? x;
    return [['overflow-x', x], ['overflow-y', y]];
  }

  if (p === 'place-items' || p === 'place-content' || p === 'place-self') {
    const base = p.split('-')[1] ?? 'items';
    const align = tokens[0] ?? 'auto';
    const justify = tokens[1] ?? align;
    return [[`align-${base}`, align], [`justify-${base}`, justify]];
  }

  if (p === 'flex') {
    if (tokens.length === 1 && tokens[0] === 'none') {
      return [['flex-grow', '0'], ['flex-shrink', '0'], ['flex-basis', 'auto']];
    }
    const grow = tokens[0] ?? '0';
    const shrink = tokens[1] ?? '1';
    const basis = tokens[2] ?? '0%';
    return [['flex-grow', grow], ['flex-shrink', shrink], ['flex-basis', basis]];
  }

  if (p === 'border' || p === 'outline') {
    const widthRe = /^(thin|medium|thick|[\d.]+(px|em|rem|%|pt|vw|vh)?)$/;
    const styleRe = /^(none|hidden|dotted|dashed|solid|double|groove|ridge|inset|outset|auto)$/;
    let width = '';
    let style = '';
    let color = '';
    for (const tk of tokens) {
      if (!width && widthRe.test(tk)) width = tk;
      else if (!style && styleRe.test(tk)) style = tk;
      else color = color ? `${color} ${tk}` : tk;
    }
    const out: Array<[string, string]> = [];
    if (width) out.push([`${p}-width`, width]);
    if (style) out.push([`${p}-style`, style]);
    if (color) out.push([`${p}-color`, color]);
    return out.length ? out : [[prop, value]];
  }

  if (p === 'font') {
    // font: [style] [variant] [weight] size[/line-height] family
    const familyStart = tokens.findIndex((t) => /\d/.test(t) && /(px|em|rem|%|pt|vw|vh)/.test(t));
    if (familyStart === -1) return [[prop, value]];
    const sizeToken = tokens[familyStart] ?? '';
    const pre = tokens.slice(0, familyStart);
    const family = tokens.slice(familyStart + 1).join(' ');
    const styleRe = /^(italic|oblique|normal)$/;
    const variantRe = /^(small-caps|normal)$/;
    const weightRe = /^(bold|bolder|lighter|normal|[1-9]00)$/;
    let fStyle = '';
    let fVariant = '';
    let fWeight = '';
    for (const tk of pre) {
      if (!fStyle && styleRe.test(tk)) fStyle = tk;
      else if (!fVariant && variantRe.test(tk)) fVariant = tk;
      else if (!fWeight && weightRe.test(tk)) fWeight = tk;
    }
    const [size, lineHeight] = sizeToken.split('/');
    const out: Array<[string, string]> = [];
    if (fStyle) out.push(['font-style', fStyle]);
    if (fVariant) out.push(['font-variant', fVariant]);
    if (fWeight) out.push(['font-weight', fWeight]);
    out.push(['font-size', size ?? sizeToken]);
    if (lineHeight) out.push(['line-height', lineHeight]);
    if (family) out.push(['font-family', family]);
    return out;
  }

  if (p === 'background') {
    // best-effort split: color / image / repeat / position [/ size] / attachment
    const colorRe = /^(#[0-9a-fA-F]{3,8}|rgb|rgba|hsl|hsla|transparent|currentColor|[a-z]+)$/;
    const repeatRe = /^(no-repeat|repeat|repeat-x|repeat-y|space|round)$/;
    const attachRe = /^(fixed|scroll|local)$/;
    let bgColor = '';
    let bgImage = '';
    let bgRepeat = '';
    let bgAttach = '';
    const posSize: string[] = [];
    for (const tk of tokens) {
      if (tk.startsWith('url(') || tk.startsWith('linear-gradient') || tk.startsWith('radial-gradient')) bgImage = tk;
      else if (repeatRe.test(tk)) bgRepeat = tk;
      else if (attachRe.test(tk)) bgAttach = tk;
      else if (!bgColor && colorRe.test(tk) && !/^(center|top|bottom|left|right)$/.test(tk)) bgColor = tk;
      else posSize.push(tk);
    }
    const joined = posSize.join(' ');
    const [pos, size] = joined.split('/').map((s) => s.trim());
    const out: Array<[string, string]> = [];
    if (bgColor) out.push(['background-color', bgColor]);
    if (bgImage) out.push(['background-image', bgImage]);
    if (bgRepeat) out.push(['background-repeat', bgRepeat]);
    if (pos) out.push(['background-position', pos]);
    if (size) out.push(['background-size', size]);
    if (bgAttach) out.push(['background-attachment', bgAttach]);
    return out.length ? out : [[prop, value]];
  }

  if (p === 'list-style') {
    const typeRe = /^(disc|circle|square|decimal|none|lower-roman|upper-roman|lower-alpha|upper-alpha)$/;
    const posRe = /^(inside|outside)$/;
    let lType = '';
    let lPos = '';
    let lImage = '';
    for (const tk of tokens) {
      if (tk.startsWith('url(')) lImage = tk;
      else if (posRe.test(tk)) lPos = tk;
      else if (typeRe.test(tk)) lType = tk;
    }
    const out: Array<[string, string]> = [];
    if (lType) out.push(['list-style-type', lType]);
    if (lPos) out.push(['list-style-position', lPos]);
    if (lImage) out.push(['list-style-image', lImage]);
    return out.length ? out : [[prop, value]];
  }

  if (p === 'transition') {
    const t = tokens;
    const property = t[0] ?? 'all';
    const duration = t[1] ?? '0s';
    const timing = t[2] ?? 'ease';
    const delay = t[3];
    const out: Array<[string, string]> = [
      ['transition-property', property],
      ['transition-duration', duration],
      ['transition-timing-function', timing],
    ];
    if (delay) out.push(['transition-delay', delay]);
    return out;
  }

  return [[prop, value]];
}

/** Collapse a group of related longhands into a shorthand where possible. */
function collapseDeclarations(decls: Array<[string, string]>): Array<[string, string]> {
  const map = new Map<string, string>();
  for (const [k, v] of decls) map.set(k.toLowerCase(), v);
  const out: Array<[string, string]> = [];
  const consumed = new Set<string>();

  const tryBox = (base: string, shorthand: string) => {
    const t = map.get(`${base}-top`);
    const r = map.get(`${base}-right`);
    const b = map.get(`${base}-bottom`);
    const l = map.get(`${base}-left`);
    if (t !== undefined && r !== undefined && b !== undefined && l !== undefined) {
      let val: string;
      if (t === r && r === b && b === l) val = t;
      else if (t === b && r === l) val = `${t} ${r}`;
      else if (r === l) val = `${t} ${r} ${b}`;
      else val = `${t} ${r} ${b} ${l}`;
      out.push([shorthand, val]);
      consumed.add(`${base}-top`);
      consumed.add(`${base}-right`);
      consumed.add(`${base}-bottom`);
      consumed.add(`${base}-left`);
    }
  };

  tryBox('margin', 'margin');
  tryBox('padding', 'padding');

  // gap
  const rg = map.get('row-gap');
  const cg = map.get('column-gap');
  if (rg !== undefined && cg !== undefined) {
    out.push(['gap', rg === cg ? rg : `${rg} ${cg}`]);
    consumed.add('row-gap');
    consumed.add('column-gap');
  }

  // overflow
  const ox = map.get('overflow-x');
  const oy = map.get('overflow-y');
  if (ox !== undefined && oy !== undefined) {
    out.push(['overflow', ox === oy ? ox : `${ox} ${oy}`]);
    consumed.add('overflow-x');
    consumed.add('overflow-y');
  }

  // flex
  const fg = map.get('flex-grow');
  const fs = map.get('flex-shrink');
  const fb = map.get('flex-basis');
  if (fg !== undefined && fs !== undefined && fb !== undefined) {
    out.push(['flex', `${fg} ${fs} ${fb}`]);
    consumed.add('flex-grow');
    consumed.add('flex-shrink');
    consumed.add('flex-basis');
  }

  // border (width/style/color)
  const bw = map.get('border-width');
  const bs = map.get('border-style');
  const bc = map.get('border-color');
  if (bw !== undefined && bs !== undefined && bc !== undefined) {
    out.push(['border', `${bw} ${bs} ${bc}`]);
    consumed.add('border-width');
    consumed.add('border-style');
    consumed.add('border-color');
  }

  // pass through anything not consumed
  for (const [k, v] of decls) {
    if (!consumed.has(k.toLowerCase())) out.push([k, v]);
  }
  return out;
}

/** Parse "prop: value;" declarations, tolerating missing trailing semicolons. */
function parseDeclarations(input: string): Array<[string, string]> {
  // strip /* comments */
  const noComments = input.replace(/\/\*[\s\S]*?\*\//g, '');
  const decls: Array<[string, string]> = [];
  for (const chunk of noComments.split(';')) {
    const c = chunk.trim();
    if (!c) continue;
    const idx = c.indexOf(':');
    if (idx === -1) continue;
    const prop = c.slice(0, idx).trim();
    const value = c.slice(idx + 1).trim();
    if (prop && value) decls.push([prop, value]);
  }
  return decls;
}

export default function CssShorthandExpanderTool() {
  const [mode, setMode] = useState<Mode>('expand');

  return (
    <TextToolLayout
      deps={[mode]}
      transform={(input) => {
        if (!input.trim()) return '';
        const decls = parseDeclarations(input);
        if (decls.length === 0) throw new Error('No "property: value;" declarations found.');

        let result: Array<[string, string]>;
        if (mode === 'expand') {
          result = decls.flatMap(([prop, value]) => expandDeclaration(prop, value));
        } else {
          result = collapseDeclarations(decls);
        }
        return result.map(([k, v]) => `${k}: ${v};`).join('\n');
      }}
      inputLabel="CSS"
      outputLabel={mode === 'expand' ? 'Longhand' : 'Shorthand'}
      sample={SAMPLE}
      downloadName="styles.css"
      downloadMime="text/css"
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="expand">Expand</TabsTrigger>
              <TabsTrigger value="collapse">Collapse</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
