'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

function clampHex(value: string, fallback: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : fallback;
}

const FILLER =
  'Scroll inside this box to preview the custom scrollbar. ';

export default function ScrollbarStyler() {
  const [width, setWidth] = useState(10);
  const [trackColor, setTrackColor] = useState('#f1f5f9');
  const [thumbColor, setThumbColor] = useState('#94a3b8');
  const [thumbHover, setThumbHover] = useState('#64748b');
  const [thumbRadius, setThumbRadius] = useState(8);
  const [trackRadius, setTrackRadius] = useState(8);

  const track = clampHex(trackColor, '#f1f5f9');
  const thumb = clampHex(thumbColor, '#94a3b8');
  const hover = clampHex(thumbHover, '#64748b');

  const css = useMemo(() => {
    const ffWidth = width <= 12 ? 'thin' : 'auto';
    return [
      '/* WebKit / Blink (Chrome, Safari, Edge) */',
      '.scroll-area::-webkit-scrollbar {',
      `  width: ${width}px;`,
      `  height: ${width}px;`,
      '}',
      '.scroll-area::-webkit-scrollbar-track {',
      `  background: ${track};`,
      `  border-radius: ${trackRadius}px;`,
      '}',
      '.scroll-area::-webkit-scrollbar-thumb {',
      `  background: ${thumb};`,
      `  border-radius: ${thumbRadius}px;`,
      '}',
      '.scroll-area::-webkit-scrollbar-thumb:hover {',
      `  background: ${hover};`,
      '}',
      '',
      '/* Firefox (standards) */',
      '.scroll-area {',
      `  scrollbar-width: ${ffWidth};`,
      `  scrollbar-color: ${thumb} ${track};`,
      '}',
    ].join('\n');
  }, [width, track, thumb, hover, thumbRadius, trackRadius]);

  const previewStyle = useMemo(
    () =>
      ({
        scrollbarWidth: width <= 12 ? 'thin' : 'auto',
        scrollbarColor: `${thumb} ${track}`,
      }) as React.CSSProperties,
    [width, thumb, track],
  );

  const colorField = (
    label: string,
    value: string,
    set: (s: string) => void,
    fallback: string,
  ) => (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={clampHex(value, fallback)}
          onChange={(e) => set(e.target.value)}
          className="h-9 w-10 cursor-pointer rounded border bg-transparent"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => set(e.target.value)}
          className="w-28 font-mono"
        />
      </div>
    </Field>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Controls" />
        <div className="flex flex-col gap-4 p-3">
          <Field label={`Scrollbar width: ${width}px`}>
            <Slider
              value={[width]}
              min={2}
              max={24}
              step={1}
              onValueChange={(v) => setWidth(v[0] ?? 10)}
            />
          </Field>
          {colorField('Track color', trackColor, setTrackColor, '#f1f5f9')}
          {colorField('Thumb color', thumbColor, setThumbColor, '#94a3b8')}
          {colorField('Thumb hover', thumbHover, setThumbHover, '#64748b')}
          <Field label={`Thumb radius: ${thumbRadius}px`}>
            <Slider
              value={[thumbRadius]}
              min={0}
              max={20}
              step={1}
              onValueChange={(v) => setThumbRadius(v[0] ?? 8)}
            />
          </Field>
          <Field label={`Track radius: ${trackRadius}px`}>
            <Slider
              value={[trackRadius]}
              min={0}
              max={20}
              step={1}
              onValueChange={(v) => setTrackRadius(v[0] ?? 8)}
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview & CSS">
          <CopyButton value={() => css} />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <style>{`
            .sb-preview::-webkit-scrollbar { width: ${width}px; height: ${width}px; }
            .sb-preview::-webkit-scrollbar-track { background: ${track}; border-radius: ${trackRadius}px; }
            .sb-preview::-webkit-scrollbar-thumb { background: ${thumb}; border-radius: ${thumbRadius}px; }
            .sb-preview::-webkit-scrollbar-thumb:hover { background: ${hover}; }
          `}</style>
          <div
            className="sb-preview h-40 overflow-auto rounded-md border bg-background p-3 text-sm leading-relaxed"
            style={previewStyle}
          >
            <div style={{ width: '160%' }}>
              {Array.from({ length: 14 }, (_, i) => (
                <p key={i} className="py-1">
                  {i + 1}. {FILLER}
                  {FILLER}
                </p>
              ))}
            </div>
          </div>
          <pre className="max-h-64 overflow-auto rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
            {css}
          </pre>
        </div>
        <StatBar
          items={[
            `width ${width}px`,
            `Firefox: ${width <= 12 ? 'thin' : 'auto'}`,
            `thumb ${thumb}`,
          ]}
        />
      </Panel>
    </div>
  );
}
