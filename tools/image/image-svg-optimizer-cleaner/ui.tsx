'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

const enc = new TextEncoder();

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Created with an editor -->
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd"
   xmlns="http://www.w3.org/2000/svg"
   width="100"
   height="100"
   viewBox="0 0 100 100"
   version="1.1"
   id="svg1"
   inkscape:version="1.0">
  <metadata id="metadata1">
    <rdf:RDF></rdf:RDF>
  </metadata>
  <sodipodi:namedview id="view1" inkscape:zoom="2" />
  <g id="layer1" inkscape:label="Layer 1">
    <path
       d="M 12.34567,20.98765 C 30.000000,40.5 60.111111,10.222222 88,50.7654321"
       fill="#ff0000"
       stroke="none"
       stroke-width="1" />
    <g id="empty"></g>
  </g>
</svg>`;

/** Round a single numeric literal to `prec` decimals, dropping trailing zeros. */
function roundNum(raw: string, prec: number): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const fixed = n.toFixed(prec);
  // Strip trailing zeros and a dangling decimal point.
  return fixed.replace(/\.?0+$/, '') || '0';
}

interface CleanOpts {
  precision: number;
  roundNumbers: boolean;
  keepIds: boolean;
  keepViewBox: boolean;
  pretty: boolean;
}

function cleanSvg(src: string, opts: CleanOpts): string {
  let s = src;

  // 1. Remove XML / DOCTYPE prolog and comments.
  s = s.replace(/<\?xml[\s\S]*?\?>/g, '');
  s = s.replace(/<!DOCTYPE[\s\S]*?>/g, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Remove <metadata> blocks (with content).
  s = s.replace(/<metadata\b[\s\S]*?<\/metadata>/g, '');

  // 3. Remove editor-specific elements (sodipodi:namedview, inkscape:*).
  s = s.replace(/<sodipodi:[a-zA-Z-]+\b[^>]*?(?:\/>|>[\s\S]*?<\/sodipodi:[a-zA-Z-]+>)/g, '');
  s = s.replace(/<inkscape:[a-zA-Z-]+\b[^>]*?(?:\/>|>[\s\S]*?<\/inkscape:[a-zA-Z-]+>)/g, '');

  // 4. Remove editor namespace declarations and attributes.
  s = s.replace(/\s+xmlns:(?:inkscape|sodipodi|dc|cc|rdf)="[^"]*"/g, '');
  s = s.replace(/\s+(?:inkscape|sodipodi):[a-zA-Z-]+="[^"]*"/g, '');

  // 5. Remove default / no-op attributes.
  s = s.replace(/\s+version="[^"]*"/g, '');
  s = s.replace(/\s+stroke="none"/g, '');
  s = s.replace(/\s+(?:stroke-width|opacity|fill-opacity|stroke-opacity)="1(?:\.0+)?"/g, '');

  // 6. Optionally remove id attributes.
  if (!opts.keepIds) {
    s = s.replace(/\s+id="[^"]*"/g, '');
  }

  // 7. Optionally drop viewBox.
  if (!opts.keepViewBox) {
    s = s.replace(/\s+viewBox="[^"]*"/g, '');
  }

  // 8. Round numeric literals inside attribute values.
  if (opts.roundNumbers) {
    s = s.replace(/-?\d+\.\d+/g, (m) => roundNum(m, opts.precision));
  }

  // 9. Remove empty groups (no attributes, no children) — repeat to catch nesting.
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/<g\s*>\s*<\/g>/g, '');
    s = s.replace(/<g\s+([^>]*?)>\s*<\/g>/g, '');
  }

  // 10. Whitespace handling.
  if (opts.pretty) {
    // Collapse runs of blank lines and trim line ends.
    s = s
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''))
      .filter((line, i, arr) => !(line.trim() === '' && (arr[i - 1]?.trim() ?? '') === ''))
      .join('\n')
      .trim();
  } else {
    // Minify: collapse whitespace between tags and inside tags.
    s = s.replace(/>\s+</g, '><');
    s = s.replace(/\s{2,}/g, ' ');
    s = s.replace(/\s+\/>/g, '/>');
    s = s.replace(/\s+>/g, '>');
    s = s.trim();
  }

  return s;
}

export default function SvgOptimizerCleaner() {
  const [precision, setPrecision] = useState(2);
  const [roundNumbers, setRoundNumbers] = useState(true);
  const [keepIds, setKeepIds] = useState(false);
  const [keepViewBox, setKeepViewBox] = useState(true);
  const [pretty, setPretty] = useState(false);

  return (
    <TextToolLayout
      deps={[precision, roundNumbers, keepIds, keepViewBox, pretty]}
      transform={(input) => {
        if (!input.trim()) return '';
        if (!/<svg[\s>]/i.test(input)) {
          throw new Error('Input does not look like SVG markup (no <svg> tag found).');
        }
        const cleaned = cleanSvg(input, {
          precision,
          roundNumbers,
          keepIds,
          keepViewBox,
          pretty,
        });
        const before = enc.encode(input).length;
        const after = enc.encode(cleaned).length;
        const saved = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
        const header = `/* ${before.toLocaleString()} → ${after.toLocaleString()} bytes · ${saved}% smaller */`;
        return `${header}\n${cleaned}`;
      }}
      inputLabel="SVG source"
      outputLabel="Cleaned SVG"
      sample={SAMPLE}
      accept="image/svg+xml,.svg,text/*"
      downloadName="cleaned.svg"
      downloadMime="image/svg+xml"
      options={
        <>
          <Field label="Output">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={pretty} onCheckedChange={setPretty} />
              <span className="text-sm text-muted-foreground">
                {pretty ? 'Pretty' : 'Minified'}
              </span>
            </div>
          </Field>
          <Field label="Round numbers">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={roundNumbers} onCheckedChange={setRoundNumbers} />
              <span className="text-sm text-muted-foreground">{roundNumbers ? 'On' : 'Off'}</span>
            </div>
          </Field>
          <Field label={`Precision: ${precision}`} className="min-w-[160px]">
            <Slider
              min={0}
              max={6}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 2)}
            />
          </Field>
          <Field label="Keep ids">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={keepIds} onCheckedChange={setKeepIds} />
              <span className="text-sm text-muted-foreground">{keepIds ? 'Keep' : 'Remove'}</span>
            </div>
          </Field>
          <Field label="Keep viewBox">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={keepViewBox} onCheckedChange={setKeepViewBox} />
              <span className="text-sm text-muted-foreground">{keepViewBox ? 'Keep' : 'Remove'}</span>
            </div>
          </Field>
        </>
      }
    />
  );
}
