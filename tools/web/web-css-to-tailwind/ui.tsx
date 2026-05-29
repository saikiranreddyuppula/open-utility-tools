'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

// Tailwind's default spacing scale (rem -> token). 0.25rem = 4px = "1".
const SPACING: Record<string, string> = {
  '0': '0',
  '0px': '0',
  '1px': 'px',
  '0.125rem': '0.5',
  '2px': '0.5',
  '0.25rem': '1',
  '4px': '1',
  '0.375rem': '1.5',
  '6px': '1.5',
  '0.5rem': '2',
  '8px': '2',
  '0.625rem': '2.5',
  '10px': '2.5',
  '0.75rem': '3',
  '12px': '3',
  '0.875rem': '3.5',
  '14px': '3.5',
  '1rem': '4',
  '16px': '4',
  '1.25rem': '5',
  '20px': '5',
  '1.5rem': '6',
  '24px': '6',
  '1.75rem': '7',
  '28px': '7',
  '2rem': '8',
  '32px': '8',
  '2.5rem': '10',
  '40px': '10',
  '3rem': '12',
  '48px': '12',
  '4rem': '16',
  '64px': '16',
};

const FONT_SIZE: Record<string, string> = {
  '0.75rem': 'text-xs',
  '12px': 'text-xs',
  '0.875rem': 'text-sm',
  '14px': 'text-sm',
  '1rem': 'text-base',
  '16px': 'text-base',
  '1.125rem': 'text-lg',
  '18px': 'text-lg',
  '1.25rem': 'text-xl',
  '20px': 'text-xl',
  '1.5rem': 'text-2xl',
  '24px': 'text-2xl',
  '1.875rem': 'text-3xl',
  '30px': 'text-3xl',
  '2.25rem': 'text-4xl',
  '36px': 'text-4xl',
  '3rem': 'text-5xl',
  '48px': 'text-5xl',
};

const FONT_WEIGHT: Record<string, string> = {
  '100': 'font-thin',
  '200': 'font-extralight',
  '300': 'font-light',
  '400': 'font-normal',
  normal: 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
  '700': 'font-bold',
  bold: 'font-bold',
  '800': 'font-extrabold',
  '900': 'font-black',
};

const RADIUS: Record<string, string> = {
  '0': 'rounded-none',
  '0px': 'rounded-none',
  '0.125rem': 'rounded-sm',
  '2px': 'rounded-sm',
  '0.25rem': 'rounded',
  '4px': 'rounded',
  '0.375rem': 'rounded-md',
  '6px': 'rounded-md',
  '0.5rem': 'rounded-lg',
  '8px': 'rounded-lg',
  '0.75rem': 'rounded-xl',
  '12px': 'rounded-xl',
  '1rem': 'rounded-2xl',
  '16px': 'rounded-2xl',
  '1.5rem': 'rounded-3xl',
  '24px': 'rounded-3xl',
  '9999px': 'rounded-full',
  '50%': 'rounded-full',
};

const DISPLAY: Record<string, string> = {
  block: 'block',
  'inline-block': 'inline-block',
  inline: 'inline',
  flex: 'flex',
  'inline-flex': 'inline-flex',
  grid: 'grid',
  'inline-grid': 'inline-grid',
  contents: 'contents',
  table: 'table',
  none: 'hidden',
};

const POSITION: Record<string, string> = {
  static: 'static',
  fixed: 'fixed',
  absolute: 'absolute',
  relative: 'relative',
  sticky: 'sticky',
};

const FLEX_DIR: Record<string, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  column: 'flex-col',
  'column-reverse': 'flex-col-reverse',
};

const JUSTIFY: Record<string, string> = {
  'flex-start': 'justify-start',
  start: 'justify-start',
  'flex-end': 'justify-end',
  end: 'justify-end',
  center: 'justify-center',
  'space-between': 'justify-between',
  'space-around': 'justify-around',
  'space-evenly': 'justify-evenly',
};

const ALIGN_ITEMS: Record<string, string> = {
  'flex-start': 'items-start',
  start: 'items-start',
  'flex-end': 'items-end',
  end: 'items-end',
  center: 'items-center',
  baseline: 'items-baseline',
  stretch: 'items-stretch',
};

const TEXT_ALIGN: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

const FLEX_WRAP: Record<string, string> = {
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
  nowrap: 'flex-nowrap',
};

const COLOR_NAMES: Record<string, string> = {
  black: 'black',
  white: 'white',
  transparent: 'transparent',
  '#000': 'black',
  '#000000': 'black',
  '#fff': 'white',
  '#ffffff': 'white',
};

function spacing(prefix: string, value: string): string | null {
  const tok = SPACING[value];
  if (tok != null) return `${prefix}-${tok}`;
  return `${prefix}-[${value}]`;
}

function color(prefix: string, value: string): string {
  const named = COLOR_NAMES[value.toLowerCase()];
  if (named) return `${prefix}-${named}`;
  // arbitrary value, strip spaces
  return `${prefix}-[${value.replace(/\s+/g, '')}]`;
}

function lookup(
  table: Record<string, string>,
  value: string,
  fallbackPrefix?: string,
): string | null {
  const hit = table[value.toLowerCase()];
  if (hit) return hit;
  if (fallbackPrefix) return `${fallbackPrefix}-[${value.replace(/\s+/g, '')}]`;
  return null;
}

function convertDeclaration(prop: string, value: string): string[] {
  const p = prop.trim().toLowerCase();
  const v = value.trim().replace(/\s*!important$/i, '').trim();
  const out: string[] = [];

  const addSpacing = (prefix: string) => {
    const r = spacing(prefix, v);
    if (r) out.push(r);
  };

  switch (p) {
    case 'margin':
      addSpacing('m');
      break;
    case 'margin-top':
      addSpacing('mt');
      break;
    case 'margin-right':
      addSpacing('mr');
      break;
    case 'margin-bottom':
      addSpacing('mb');
      break;
    case 'margin-left':
      addSpacing('ml');
      break;
    case 'padding':
      addSpacing('p');
      break;
    case 'padding-top':
      addSpacing('pt');
      break;
    case 'padding-right':
      addSpacing('pr');
      break;
    case 'padding-bottom':
      addSpacing('pb');
      break;
    case 'padding-left':
      addSpacing('pl');
      break;
    case 'gap':
      addSpacing('gap');
      break;
    case 'row-gap':
      addSpacing('gap-y');
      break;
    case 'column-gap':
      addSpacing('gap-x');
      break;
    case 'width':
      if (v === '100%') out.push('w-full');
      else if (v === 'auto') out.push('w-auto');
      else if (v === '100vw') out.push('w-screen');
      else {
        const r = spacing('w', v);
        if (r) out.push(r);
      }
      break;
    case 'height':
      if (v === '100%') out.push('h-full');
      else if (v === 'auto') out.push('h-auto');
      else if (v === '100vh') out.push('h-screen');
      else {
        const r = spacing('h', v);
        if (r) out.push(r);
      }
      break;
    case 'display': {
      const r = lookup(DISPLAY, v);
      if (r) out.push(r);
      break;
    }
    case 'position': {
      const r = lookup(POSITION, v);
      if (r) out.push(r);
      break;
    }
    case 'flex-direction': {
      const r = lookup(FLEX_DIR, v);
      if (r) out.push(r);
      break;
    }
    case 'justify-content': {
      const r = lookup(JUSTIFY, v);
      if (r) out.push(r);
      break;
    }
    case 'align-items': {
      const r = lookup(ALIGN_ITEMS, v);
      if (r) out.push(r);
      break;
    }
    case 'flex-wrap': {
      const r = lookup(FLEX_WRAP, v);
      if (r) out.push(r);
      break;
    }
    case 'flex-grow':
      out.push(v === '0' ? 'grow-0' : 'grow');
      break;
    case 'flex-shrink':
      out.push(v === '0' ? 'shrink-0' : 'shrink');
      break;
    case 'color':
      out.push(color('text', v));
      break;
    case 'background-color':
    case 'background':
      out.push(color('bg', v));
      break;
    case 'border-color':
      out.push(color('border', v));
      break;
    case 'font-size': {
      const r = lookup(FONT_SIZE, v, 'text');
      if (r) out.push(r);
      break;
    }
    case 'font-weight': {
      const r = lookup(FONT_WEIGHT, v);
      if (r) out.push(r);
      break;
    }
    case 'font-style':
      if (v === 'italic') out.push('italic');
      else if (v === 'normal') out.push('not-italic');
      break;
    case 'text-align': {
      const r = lookup(TEXT_ALIGN, v);
      if (r) out.push(r);
      break;
    }
    case 'text-decoration':
    case 'text-decoration-line':
      if (v.includes('underline')) out.push('underline');
      else if (v.includes('line-through')) out.push('line-through');
      else if (v === 'none') out.push('no-underline');
      break;
    case 'text-transform':
      if (v === 'uppercase') out.push('uppercase');
      else if (v === 'lowercase') out.push('lowercase');
      else if (v === 'capitalize') out.push('capitalize');
      else if (v === 'none') out.push('normal-case');
      break;
    case 'line-height':
      out.push(`leading-[${v.replace(/\s+/g, '')}]`);
      break;
    case 'letter-spacing':
      out.push(`tracking-[${v.replace(/\s+/g, '')}]`);
      break;
    case 'border-radius': {
      const r = lookup(RADIUS, v);
      if (r) out.push(r);
      else out.push(`rounded-[${v.replace(/\s+/g, '')}]`);
      break;
    }
    case 'border-width':
      if (v === '0' || v === '0px') out.push('border-0');
      else if (v === '1px') out.push('border');
      else if (v === '2px') out.push('border-2');
      else if (v === '4px') out.push('border-4');
      else if (v === '8px') out.push('border-8');
      else out.push(`border-[${v}]`);
      break;
    case 'border':
      if (v === 'none' || v.startsWith('0')) out.push('border-0');
      else out.push('border');
      break;
    case 'opacity': {
      const num = Number(v);
      if (Number.isFinite(num)) {
        out.push(`opacity-${Math.round(num <= 1 ? num * 100 : num)}`);
      }
      break;
    }
    case 'overflow':
      out.push(`overflow-${v}`);
      break;
    case 'cursor':
      out.push(`cursor-${v}`);
      break;
    case 'z-index':
      out.push(`z-[${v}]`);
      break;
    case 'box-shadow':
      out.push(v === 'none' ? 'shadow-none' : 'shadow');
      break;
    default:
      // Unknown: emit a clearly-marked arbitrary property utility.
      out.push(`[${p}:${v.replace(/\s+/g, '_')}]`);
      break;
  }
  return out;
}

function stripCss(input: string): string {
  // remove comments and a wrapping selector { ... } if present
  let css = input.replace(/\/\*[\s\S]*?\*\//g, '');
  const braceOpen = css.indexOf('{');
  const braceClose = css.lastIndexOf('}');
  if (braceOpen !== -1 && braceClose > braceOpen) {
    css = css.slice(braceOpen + 1, braceClose);
  }
  return css;
}

export default function CssToTailwindTool() {
  const [output, setOutput] = useState<'classes' | 'attribute'>('classes');

  const transform = useCallback(
    (input: string) => {
      const css = stripCss(input).trim();
      if (!css) return '';
      const classes: string[] = [];
      for (const part of css.split(';')) {
        const decl = part.trim();
        if (!decl) continue;
        const idx = decl.indexOf(':');
        if (idx === -1) continue;
        const prop = decl.slice(0, idx);
        const value = decl.slice(idx + 1);
        if (!prop.trim() || !value.trim()) continue;
        classes.push(...convertDeclaration(prop, value));
      }
      if (classes.length === 0) {
        throw new Error('No convertible CSS declarations found.');
      }
      const joined = classes.join(' ');
      return output === 'attribute' ? `className="${joined}"` : joined;
    },
    [output],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[output]}
      inputLabel="CSS"
      outputLabel="Tailwind"
      inputPlaceholder="display: flex; padding: 16px; color: #fff;"
      sample={
        '.card {\n' +
        '  display: flex;\n' +
        '  flex-direction: column;\n' +
        '  justify-content: center;\n' +
        '  padding: 16px;\n' +
        '  margin-top: 8px;\n' +
        '  background-color: #ffffff;\n' +
        '  color: black;\n' +
        '  font-size: 14px;\n' +
        '  font-weight: 600;\n' +
        '  border-radius: 8px;\n' +
        '}'
      }
      downloadName="tailwind.txt"
      options={
        <Field label="Output">
          <Tabs
            value={output}
            onValueChange={(v) => setOutput(v as 'classes' | 'attribute')}
          >
            <TabsList>
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="attribute">className=&quot;&quot;</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
