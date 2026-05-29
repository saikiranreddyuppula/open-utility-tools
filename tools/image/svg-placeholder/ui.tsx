'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';

export default function PlaceholderImageTool() {
  const [w, setW] = useState(600);
  const [h, setH] = useState(400);
  const [bg, setBg] = useState('#5b5bd6');
  const [fg, setFg] = useState('#ffffff');
  const [label, setLabel] = useState('');

  const svg = useMemo(() => {
    const text = label || `${w}×${h}`;
    const fontSize = Math.max(12, Math.round(Math.min(w, h) / 8));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${fontSize}" fill="${fg}">${text}</text></svg>`;
  }, [w, h, bg, fg, label]);

  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Width">
          <Input type="number" value={w} min={1} onChange={(e) => setW(Math.max(1, Number(e.target.value) || 1))} className="w-24 font-mono" />
        </Field>
        <Field label="Height">
          <Input type="number" value={h} min={1} onChange={(e) => setH(Math.max(1, Number(e.target.value) || 1))} className="w-24 font-mono" />
        </Field>
        <Field label="Background">
          <Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-8 w-14 p-1" />
        </Field>
        <Field label="Text">
          <Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-8 w-14 p-1" />
        </Field>
        <Field label="Label" hint="blank = WxH">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-40" placeholder={`${w}×${h}`} />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Preview">
          <CopyButton value={dataUri} label="Copy data-URI" />
          <DownloadButton data={svg} filename="placeholder.svg" mime="image/svg+xml" label="SVG" />
        </PanelHeader>
        <div className="bg-grid flex justify-center overflow-auto p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUri} alt="placeholder" className="max-h-[360px] max-w-full" />
        </div>
      </Panel>
    </div>
  );
}
