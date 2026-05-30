'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Fit = 'contain' | 'cover' | 'fill' | 'scale-down';
type AlignX = 'left' | 'center' | 'right';
type AlignY = 'top' | 'center' | 'bottom';

interface Row {
  label: string;
  value: string;
}

function fmt(n: number, round: boolean): string {
  if (!Number.isFinite(n)) return '0';
  return round ? Math.round(n).toString() : (Math.round(n * 1000) / 1000).toString();
}

export default function AspectFitCoverCalculator() {
  const [srcW, setSrcW] = useState('1920');
  const [srcH, setSrcH] = useState('1080');
  const [boxW, setBoxW] = useState('400');
  const [boxH, setBoxH] = useState('400');
  const [fit, setFit] = useState<Fit>('contain');
  const [alignX, setAlignX] = useState<AlignX>('center');
  const [alignY, setAlignY] = useState<AlignY>('center');
  const [round, setRound] = useState(true);

  const result = useMemo<{ rows: Row[]; css: Row[]; draw: { w: number; h: number; x: number; y: number } } | { error: string }>(() => {
    const sw = Number(srcW);
    const sh = Number(srcH);
    const bw = Number(boxW);
    const bh = Number(boxH);
    if (![sw, sh, bw, bh].every((n) => Number.isFinite(n))) {
      return { error: 'Enter valid numbers for all dimensions.' };
    }
    if (sw <= 0 || sh <= 0 || bw <= 0 || bh <= 0) {
      return { error: 'All dimensions must be greater than zero.' };
    }

    const scaleX = bw / sw;
    const scaleY = bh / sh;

    let scale: number;
    switch (fit) {
      case 'contain':
        scale = Math.min(scaleX, scaleY);
        break;
      case 'cover':
        scale = Math.max(scaleX, scaleY);
        break;
      case 'scale-down':
        // contain, but never upscale beyond original size.
        scale = Math.min(scaleX, scaleY, 1);
        break;
      case 'fill':
        scale = 1; // handled specially below (non-uniform)
        break;
      default:
        scale = Math.min(scaleX, scaleY);
        break;
    }

    let drawW: number;
    let drawH: number;
    if (fit === 'fill') {
      drawW = bw;
      drawH = bh;
    } else {
      drawW = sw * scale;
      drawH = sh * scale;
    }

    const freeX = bw - drawW;
    const freeY = bh - drawH;
    const offX = alignX === 'left' ? 0 : alignX === 'right' ? freeX : freeX / 2;
    const offY = alignY === 'top' ? 0 : alignY === 'bottom' ? freeY : freeY / 2;

    const rows: Row[] = [
      { label: 'Drawn width', value: `${fmt(drawW, round)} px` },
      { label: 'Drawn height', value: `${fmt(drawH, round)} px` },
      { label: 'Scale factor', value: fit === 'fill' ? `${fmt(scaleX, false)} × ${fmt(scaleY, false)}` : `${fmt(scale, false)}×` },
      { label: 'Offset X', value: `${fmt(offX, round)} px` },
      { label: 'Offset Y', value: `${fmt(offY, round)} px` },
    ];

    if (fit === 'contain' || fit === 'scale-down') {
      rows.push({
        label: 'Letterbox bars',
        value:
          freeX > freeY
            ? `${fmt(freeX / 2, round)} px left & right`
            : `${fmt(freeY / 2, round)} px top & bottom`,
      });
    } else if (fit === 'cover') {
      rows.push({
        label: 'Cropped (hidden)',
        value:
          drawW > bw
            ? `${fmt((drawW - bw), round)} px width`
            : `${fmt((drawH - bh), round)} px height`,
      });
    }

    const posX = alignX === 'center' ? 'center' : alignX;
    const posY = alignY === 'center' ? 'center' : alignY;
    const bgSize = fit === 'contain' || fit === 'scale-down' ? 'contain' : fit === 'cover' ? 'cover' : `${fmt(bw, round)}px ${fmt(bh, round)}px`;

    const css: Row[] = [
      { label: 'object-fit', value: fit },
      { label: 'object-position', value: `${posX} ${posY}` },
      { label: 'background-size', value: bgSize },
      { label: 'background-position', value: `${posX} ${posY}` },
    ];

    return { rows, css, draw: { w: drawW, h: drawH, x: offX, y: offY } };
  }, [srcW, srcH, boxW, boxH, fit, alignX, alignY, round]);

  const bw = Number(boxW);
  const bh = Number(boxH);
  const previewScale = useMemo(() => {
    if (!Number.isFinite(bw) || !Number.isFinite(bh) || bw <= 0 || bh <= 0) return 0;
    return Math.min(240 / bw, 160 / bh, 1);
  }, [bw, bh]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Inputs" />
        <OptionsBar>
          <Field label="Source W">
            <Input value={srcW} onChange={(e) => setSrcW(e.target.value)} inputMode="numeric" className="w-24 font-mono" />
          </Field>
          <Field label="Source H">
            <Input value={srcH} onChange={(e) => setSrcH(e.target.value)} inputMode="numeric" className="w-24 font-mono" />
          </Field>
          <Field label="Box W">
            <Input value={boxW} onChange={(e) => setBoxW(e.target.value)} inputMode="numeric" className="w-24 font-mono" />
          </Field>
          <Field label="Box H">
            <Input value={boxH} onChange={(e) => setBoxH(e.target.value)} inputMode="numeric" className="w-24 font-mono" />
          </Field>
          <Field label="Fit mode">
            <Select value={fit} onValueChange={(v) => setFit(v as Fit)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">contain</SelectItem>
                <SelectItem value="cover">cover</SelectItem>
                <SelectItem value="fill">fill</SelectItem>
                <SelectItem value="scale-down">scale-down</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Align X">
            <Select value={alignX} onValueChange={(v) => setAlignX(v as AlignX)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">left</SelectItem>
                <SelectItem value="center">center</SelectItem>
                <SelectItem value="right">right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Align Y">
            <Select value={alignY} onValueChange={(v) => setAlignY(v as AlignY)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">top</SelectItem>
                <SelectItem value="center">center</SelectItem>
                <SelectItem value="bottom">bottom</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Round to integers">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={round} onCheckedChange={setRound} />
              <span className="text-sm text-muted-foreground">{round ? 'On' : 'Off'}</span>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Rendered geometry">
                <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
              </PanelHeader>
              <div className="divide-y">
                {result.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between px-3 py-2">
                    <span className="text-sm text-muted-foreground">{r.label}</span>
                    <span className="font-mono text-sm">{r.value}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="CSS equivalents">
                <CopyButton value={() => result.css.map((r) => `${r.label}: ${r.value};`).join('\n')} />
              </PanelHeader>
              <div className="divide-y">
                {result.css.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-2 px-3 py-2">
                    <code className="text-xs text-muted-foreground">{r.label}</code>
                    <span className="flex items-center gap-2 font-mono text-sm">
                      <span>{r.value}</span>
                      <CopyButton value={`${r.label}: ${r.value};`} size="icon-sm" />
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {previewScale > 0 && (
            <Panel>
              <PanelHeader title="Preview (to scale)" />
              <div className="flex justify-center p-4">
                <div
                  className="relative overflow-hidden border border-dashed border-muted-foreground/50 bg-muted/30"
                  style={{ width: bw * previewScale, height: bh * previewScale }}
                >
                  <div
                    className="absolute bg-primary/30 ring-1 ring-primary"
                    style={{
                      left: result.draw.x * previewScale,
                      top: result.draw.y * previewScale,
                      width: result.draw.w * previewScale,
                      height: result.draw.h * previewScale,
                    }}
                  />
                </div>
              </div>
              <StatBar items={[`box ${boxW}×${boxH}`, `source ${srcW}×${srcH}`, `fit: ${fit}`]} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
