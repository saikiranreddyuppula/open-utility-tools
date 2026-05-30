'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Layout = 'row' | 'column' | 'grid';

interface Tile {
  name: string;
  img: HTMLImageElement;
  w: number;
  h: number;
}

interface Frame {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function SpriteMergerTool() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [layout, setLayout] = useState<Layout>('grid');
  const [gutter, setGutter] = useState(2);
  const [padding, setPadding] = useState(0);
  const [cols, setCols] = useState(4);
  const [bg, setBg] = useState('#00000000');
  const [transparent, setTransparent] = useState(true);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [sheetSize, setSheetSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const build = useCallback(
    (
      list: Tile[],
      lay: Layout,
      gut: number,
      pad: number,
      cc: number,
      bgColor: string,
      trans: boolean
    ) => {
      if (list.length === 0) {
        setOutUrl(null);
        setFrames([]);
        setSheetSize(null);
        return;
      }

      // Compute placement.
      const placed: Frame[] = [];
      let sheetW = 0;
      let sheetH = 0;

      if (lay === 'row') {
        let x = pad;
        let maxH = 0;
        for (const t of list) {
          placed.push({ name: t.name, x, y: pad, w: t.w, h: t.h });
          x += t.w + gut;
          if (t.h > maxH) maxH = t.h;
        }
        sheetW = x - gut + pad;
        sheetH = maxH + pad * 2;
      } else if (lay === 'column') {
        let y = pad;
        let maxW = 0;
        for (const t of list) {
          placed.push({ name: t.name, x: pad, y, w: t.w, h: t.h });
          y += t.h + gut;
          if (t.w > maxW) maxW = t.w;
        }
        sheetW = maxW + pad * 2;
        sheetH = y - gut + pad;
      } else {
        const nCols = Math.max(1, cc);
        // Uniform cell size = max tile dimensions for a clean grid.
        let cellW = 0;
        let cellH = 0;
        for (const t of list) {
          if (t.w > cellW) cellW = t.w;
          if (t.h > cellH) cellH = t.h;
        }
        const nRows = Math.ceil(list.length / nCols);
        for (let i = 0; i < list.length; i++) {
          const t = list[i];
          if (!t) continue;
          const c = i % nCols;
          const r = Math.floor(i / nCols);
          const x = pad + c * (cellW + gut);
          const y = pad + r * (cellH + gut);
          placed.push({ name: t.name, x, y, w: t.w, h: t.h });
        }
        sheetW = pad * 2 + nCols * cellW + (nCols - 1) * gut;
        sheetH = pad * 2 + nRows * cellH + (nRows - 1) * gut;
      }

      sheetW = Math.max(1, Math.round(sheetW));
      sheetH = Math.max(1, Math.round(sheetH));

      const canvas = document.createElement('canvas');
      canvas.width = sheetW;
      canvas.height = sheetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      if (!trans) {
        ctx.fillStyle = bgColor.length === 9 ? bgColor.slice(0, 7) : bgColor;
        ctx.fillRect(0, 0, sheetW, sheetH);
      }
      for (let i = 0; i < placed.length; i++) {
        const f = placed[i];
        const t = list[i];
        if (!f || !t) continue;
        ctx.drawImage(t.img, f.x, f.y, f.w, f.h);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError('Could not encode sprite sheet.');
            return;
          }
          setOutUrl(URL.createObjectURL(blob));
        },
        'image/png'
      );
      setFrames(placed);
      setSheetSize({ w: sheetW, h: sheetH });
      setError(null);
    },
    []
  );

  const addFiles = useCallback(
    (files: FileList) => {
      setError(null);
      const arr = Array.from(files);
      let pending = arr.length;
      const loaded: Tile[] = [];
      for (const file of arr) {
        const reader = new FileReader();
        reader.onload = () => {
          const url = typeof reader.result === 'string' ? reader.result : null;
          if (!url) {
            pending -= 1;
            return;
          }
          const img = new globalThis.Image();
          img.onload = () => {
            loaded.push({
              name: file.name.replace(/\.[^.]+$/, ''),
              img,
              w: img.naturalWidth,
              h: img.naturalHeight,
            });
            pending -= 1;
            if (pending === 0) {
              setTiles((prev) => {
                const next = [...prev, ...loaded];
                build(next, layout, gutter, padding, cols, bg, transparent);
                return next;
              });
            }
          };
          img.onerror = () => {
            pending -= 1;
            setError(`Could not load ${file.name}.`);
          };
          img.src = url;
        };
        reader.onerror = () => {
          pending -= 1;
          setError(`Could not read ${file.name}.`);
        };
        reader.readAsDataURL(file);
      }
    },
    [build, layout, gutter, padding, cols, bg, transparent]
  );

  const removeTile = useCallback(
    (idx: number) => {
      setTiles((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        build(next, layout, gutter, padding, cols, bg, transparent);
        return next;
      });
    },
    [build, layout, gutter, padding, cols, bg, transparent]
  );

  const rebuild = useCallback(
    (over: Partial<{ layout: Layout; gutter: number; padding: number; cols: number; bg: string; transparent: boolean }>) => {
      build(
        tiles,
        over.layout ?? layout,
        over.gutter ?? gutter,
        over.padding ?? padding,
        over.cols ?? cols,
        over.bg ?? bg,
        over.transparent ?? transparent
      );
    },
    [build, tiles, layout, gutter, padding, cols, bg, transparent]
  );

  const cssMap = useMemo(() => {
    if (frames.length === 0) return '';
    return frames
      .map(
        (f) =>
          `.sprite-${f.name.replace(/[^a-zA-Z0-9_-]/g, '-')} {\n  width: ${f.w}px;\n  height: ${f.h}px;\n  background-position: -${f.x}px -${f.y}px;\n}`
      )
      .join('\n\n');
  }, [frames]);

  const jsonMap = useMemo(() => {
    if (frames.length === 0) return '';
    const obj: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const f of frames) obj[f.name] = { x: f.x, y: f.y, w: f.w, h: f.h };
    return JSON.stringify(
      {
        sheet: sheetSize ? { w: sheetSize.w, h: sheetSize.h } : null,
        frames: obj,
      },
      null,
      2
    );
  }, [frames, sheetSize]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Add images
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = e.target.files;
              if (fs && fs.length > 0) addFiles(fs);
              e.target.value = '';
            }}
          />
          <Field label="Layout">
            <Select
              value={layout}
              onValueChange={(v) => {
                const l = v as Layout;
                setLayout(l);
                rebuild({ layout: l });
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="row">Horizontal row</SelectItem>
                <SelectItem value="column">Vertical column</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {layout === 'grid' && (
            <Field label={`Columns: ${cols}`} className="min-w-[140px]">
              <Slider
                value={[cols]}
                min={1}
                max={16}
                step={1}
                onValueChange={(v) => {
                  const c = v[0] ?? 4;
                  setCols(c);
                  rebuild({ cols: c });
                }}
              />
            </Field>
          )}
          <Field label={`Gutter: ${gutter}px`} className="min-w-[140px]">
            <Slider
              value={[gutter]}
              min={0}
              max={64}
              step={1}
              onValueChange={(v) => {
                const g = v[0] ?? 0;
                setGutter(g);
                rebuild({ gutter: g });
              }}
            />
          </Field>
          <Field label={`Padding: ${padding}px`} className="min-w-[140px]">
            <Slider
              value={[padding]}
              min={0}
              max={64}
              step={1}
              onValueChange={(v) => {
                const p = v[0] ?? 0;
                setPadding(p);
                rebuild({ padding: p });
              }}
            />
          </Field>
          <Field label="Background">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={bg.length >= 7 ? bg.slice(0, 7) : '#000000'}
                disabled={transparent}
                onChange={(e) => {
                  setBg(e.target.value);
                  rebuild({ bg: e.target.value });
                }}
                className="h-8 w-12 p-1"
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => {
                    setTransparent(e.target.checked);
                    rebuild({ transparent: e.target.checked });
                  }}
                />
                Transparent
              </label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {tiles.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Add two or more images to merge them into a single sprite sheet. All processing
          happens locally in your browser.
        </p>
      )}

      {tiles.length > 0 && (
        <Panel>
          <PanelHeader title={`${tiles.length} image${tiles.length === 1 ? '' : 's'}`} />
          <div className="flex flex-wrap gap-2 p-3">
            {tiles.map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs"
              >
                <span className="max-w-[140px] truncate font-mono">{t.name}</span>
                <span className="text-muted-foreground">
                  {t.w}×{t.h}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => removeTile(i)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {outUrl && sheetSize && (
        <Panel>
          <PanelHeader title={`Sprite sheet — ${sheetSize.w}×${sheetSize.h}`} />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={outUrl}
              alt="sprite sheet"
              className="max-h-[420px] rounded border bg-[repeating-conic-gradient(#0001_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
            />
            <a href={outUrl} download="spritesheet.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
        </Panel>
      )}

      {cssMap && (
        <Panel>
          <PanelHeader title="CSS background-position map">
            <CopyButton value={() => cssMap} />
          </PanelHeader>
          <pre className="max-h-64 overflow-auto p-3 font-mono text-xs">{cssMap}</pre>
        </Panel>
      )}

      {jsonMap && (
        <Panel>
          <PanelHeader title="JSON frame map">
            <CopyButton value={() => jsonMap} />
          </PanelHeader>
          <pre className="max-h-64 overflow-auto p-3 font-mono text-xs">{jsonMap}</pre>
        </Panel>
      )}
    </div>
  );
}
