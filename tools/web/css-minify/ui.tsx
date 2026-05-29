'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // comments
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

function beautifyCss(css: string): string {
  const min = minifyCss(css);
  let out = '';
  let indent = 0;
  for (let i = 0; i < min.length; i++) {
    const ch = min[i]!;
    if (ch === '{') {
      out += ' {\n' + '  '.repeat(++indent);
    } else if (ch === '}') {
      indent = Math.max(0, indent - 1);
      out = out.replace(/\s+$/, '') + '\n' + '  '.repeat(indent) + '}\n' + '  '.repeat(indent);
    } else if (ch === ';') {
      out += ';\n' + '  '.repeat(indent);
    } else {
      out += ch;
    }
  }
  return out.replace(/\n\s*\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim() + '\n';
}

export default function CssMinifyTool() {
  const [mode, setMode] = useState<'minify' | 'beautify'>('minify');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      return mode === 'minify' ? minifyCss(input) : beautifyCss(input);
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel="CSS"
      outputLabel={mode === 'minify' ? 'Minified' : 'Beautified'}
      sample={'.btn {\n  color: red;\n  padding: 4px 8px;\n}\n.btn:hover { color: darkred; }'}
      downloadName="styles.css"
      downloadMime="text/css"
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'minify' | 'beautify')}>
            <TabsList>
              <TabsTrigger value="minify">Minify</TabsTrigger>
              <TabsTrigger value="beautify">Beautify</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
