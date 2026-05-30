'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE = `#3b82f6
#ff8800cc
#0a0`;

interface Rgba {
  r: number;
  g: number;
  b: number;
  /** alpha 0..1 */
  a: number;
}

function parseHex(input: string): Rgba | null {
  let h = input.trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(h)) return null;
  if (h.length === 3 || h.length === 4) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  if (![r, g, b].every((v) => Number.isFinite(v))) return null;
  return { r, g, b, a };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function f3(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

function toAARRGGBB(c: Rgba): string {
  const a = Math.round(c.a * 255);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `0x${hex(a)}${hex(c.r)}${hex(c.g)}${hex(c.b)}`.toUpperCase().replace('0X', '0x');
}

function snippetsFor(c: Rgba, normalized: boolean, includeAlpha: boolean): string[] {
  const { r, g, b, a } = c;
  const hsl = rgbToHsl(r, g, b);
  const rN = normalized ? f3(r / 255) : String(r);
  const gN = normalized ? f3(g / 255) : String(g);
  const bN = normalized ? f3(b / 255) : String(b);
  const aStr = f3(a);
  const hasAlpha = includeAlpha;
  const lines: string[] = [];

  // CSS
  lines.push(
    `/* CSS */`,
    hasAlpha ? `rgba(${r}, ${g}, ${b}, ${aStr})` : `rgb(${r}, ${g}, ${b})`,
    hasAlpha
      ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${aStr})`
      : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    ''
  );

  // Swift
  lines.push(
    `// Swift (UIKit)`,
    `UIColor(red: ${f3(r / 255)}, green: ${f3(g / 255)}, blue: ${f3(b / 255)}, alpha: ${aStr})`,
    `// SwiftUI`,
    `Color(red: ${f3(r / 255)}, green: ${f3(g / 255)}, blue: ${f3(b / 255)}, opacity: ${aStr})`,
    ''
  );

  // Android / Kotlin
  const aByte = Math.round(a * 255);
  lines.push(
    `// Android (Kotlin/Java)`,
    `Color.argb(${aByte}, ${r}, ${g}, ${b})`,
    `${toAARRGGBB(c)} // 0xAARRGGBB int`,
    ''
  );

  // Flutter
  lines.push(`// Flutter`, `Color(${toAARRGGBB(c)})`, '');

  // Java int
  const intVal =
    ((aByte & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  lines.push(`// Java/Android int (ARGB)`, `${intVal | 0}`, '');

  // Python
  lines.push(
    `# Python tuple`,
    hasAlpha ? `(${rN}, ${gN}, ${bN}, ${normalized ? aStr : aByte})` : `(${rN}, ${gN}, ${bN})`,
    ''
  );

  // Tailwind arbitrary
  lines.push(
    `/* Tailwind arbitrary value */`,
    hasAlpha
      ? `bg-[rgba(${r},${g},${b},${aStr})]`
      : `bg-[rgb(${r},${g},${b})]`,
    ''
  );

  // Objective-C
  lines.push(
    `// Objective-C`,
    `[UIColor colorWithRed:${f3(r / 255)} green:${f3(g / 255)} blue:${f3(b / 255)} alpha:${aStr}]`
  );

  return lines;
}

export default function HexToRgbCodeTool() {
  const [normalized, setNormalized] = useState(false);
  const [includeAlpha, setIncludeAlpha] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const tokens = input
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      const blocks: string[] = [];
      for (const tok of tokens) {
        const c = parseHex(tok);
        if (!c) {
          throw new Error(`Invalid hex color: "${tok}" (use #RGB, #RGBA, #RRGGBB or #RRGGBBAA).`);
        }
        const header = `===== ${tok} =====`;
        blocks.push([header, ...snippetsFor(c, normalized, includeAlpha)].join('\n'));
      }
      return blocks.join('\n\n');
    },
    [normalized, includeAlpha]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[normalized, includeAlpha]}
      inputLabel="Hex color(s)"
      outputLabel="Code snippets"
      sample={SAMPLE}
      downloadName="colors.txt"
      options={
        <>
          <Field label="Channel range">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={normalized} onCheckedChange={setNormalized} id="hrc-norm" />
              <Label htmlFor="hrc-norm" className="text-xs text-muted-foreground">
                {normalized ? '0.0–1.0' : '0–255'}
              </Label>
            </div>
          </Field>
          <Field label="Include alpha">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={includeAlpha} onCheckedChange={setIncludeAlpha} id="hrc-alpha" />
              <Label htmlFor="hrc-alpha" className="text-xs text-muted-foreground">
                {includeAlpha ? 'with alpha' : 'opaque'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
