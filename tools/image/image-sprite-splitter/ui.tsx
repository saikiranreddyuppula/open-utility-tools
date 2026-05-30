'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'count' | 'size';

interface Cell {
  index: number;
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function SpriteSplitterTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>('count');
  const [colsStr, setColsStr] = useState('4');
  const [rowsStr, setRowsStr] = useState('4');
  const [cellWStr, setCellWStr] = useState('32');
  const [cellHStr, setCellHStr] = useState('32');
  const [marginStr, setMarginStr] = useState('0');
  const [spacingStr, setSpacingStr] = useState('0');
  const [cells, setCells] = useState<Cell[]>([]);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url) {
        setError('Could not read file.');
        return;
      }
      const img = new globalThis.Image();
      img.onload = () => {
        imgRef.current = img;
        setSrc(url);
        setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => setError('Could not load image.');
      img.src = url;
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsDataURL(file);
  }, []);

  const slice = useCallback(() => {
    const img = imgRef.current;
    if (!img || !imgSize) {
      setError('Upload a sprite sheet first.');
      return;
    }
    const margin = Math.max(0, Math.floor(Number(marginStr) || 0));
    const spacing = Math.max(0, Math.floor(Number(spacingStr) || 0));
    const sheetW = imgSize.w;
    const sheetH = imgSize.h;

    let nCols: number;
    let nRows: number;
    let cw: number;
    let ch: number;

    if (mode === 'count') {
      nCols = Math.max(1, Math.floor(Number(colsStr) || 0));
      nRows = Math.max(1, Math.floor(Number(rowsStr) || 0));
      cw = Math.floor((sheetW - margin * 2 - spacing * (nCols - 1)) / nCols);
      ch = Math.floor((sheetH - margin * 2 - spacing * (nRows - 1)) / nRows);
    } else {
      cw = Math.max(1, Math.floor(Number(cellWStr) || 0));
      ch = Math.max(1, Math.floor(Number(cellHStr) || 0));
      nCols = Math.max(1, Math.floor((sheetW - margin * 2 + spacing) / (cw + spacing)));
      nRows = Math.max(1, Math.floor((sheetH - margin * 2 + spacing) / (ch + spacing)));
    }

    if (cw < 1 || ch < 1) {
      setError('Computed cell size is invalid. Check your inputs.');
      return;
    }
    if (nCols * nRows > 2000) {
      setError('Too many cells (max 2000). Use larger cells or fewer rows/columns.');
      return;
    }

    const out: Cell[] = [];
    let index = 0;
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const sx = margin + c * (cw + spacing);
        const sy = margin + r * (ch + spacing);
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported.');
          return;
        }
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
        out.push({ index, url: canvas.toDataURL('image/png'), x: sx, y: sy, w: cw, h: ch });
        index += 1;
      }
    }
    setCells(out);
    setError(null);
  }, [imgSize, mode, colsStr, rowsStr, cellWStr, cellHStr, marginStr, spacingStr]);

  const jsonMap = useMemo(() => {
    if (cells.length === 0) return '';
    return JSON.stringify(
      cells.map((c) => ({ index: c.index, x: c.x, y: c.y, w: c.w, h: c.h })),
      null,
      2
    );
  }, [cells]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload sheet
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <Field label="Define grid by">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="count">Columns × Rows</TabsTrigger>
                <TabsTrigger value="size">Cell size</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'count' ? (
            <>
              <Field label="Columns">
                <Input
                  value={colsStr}
                  onChange={(e) => setColsStr(e.target.value)}
                  inputMode="numeric"
                  className="w-20"
                />
              </Field>
              <Field label="Rows">
                <Input
                  value={rowsStr}
                  onChange={(e) => setRowsStr(e.target.value)}
                  inputMode="numeric"
                  className="w-20"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Cell width (px)">
                <Input
                  value={cellWStr}
                  onChange={(e) => setCellWStr(e.target.value)}
                  inputMode="numeric"
                  className="w-24"
                />
              </Field>
              <Field label="Cell height (px)">
                <Input
                  value={cellHStr}
                  onChange={(e) => setCellHStr(e.target.value)}
                  inputMode="numeric"
                  className="w-24"
                />
              </Field>
            </>
          )}
          <Field label="Margin (px)">
            <Input
              value={marginStr}
              onChange={(e) => setMarginStr(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="Spacing (px)">
            <Input
              value={spacingStr}
              onChange={(e) => setSpacingStr(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Button size="sm" onClick={slice} disabled={!src}>
            Slice
          </Button>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload a sprite sheet, choose how to divide it, then click Slice. Each cell becomes a
          downloadable PNG. All processing happens locally in your browser.
        </p>
      )}

      {src && imgSize && (
        <Panel>
          <PanelHeader title={`Source — ${imgSize.w}×${imgSize.h}`} />
          <div className="flex justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="source sheet" className="max-h-[260px] rounded border" />
          </div>
        </Panel>
      )}

      {cells.length > 0 && (
        <Panel>
          <PanelHeader title={`${cells.length} cells`} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2 p-3">
            {cells.map((c) => (
              <a
                key={c.index}
                href={c.url}
                download={`sprite-${c.index}.png`}
                className="flex flex-col items-center gap-1 rounded-md border bg-muted/30 p-1 hover:bg-muted/60"
                title={`x:${c.x} y:${c.y} ${c.w}×${c.h}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.url}
                  alt={`cell ${c.index}`}
                  className="max-h-16 max-w-full object-contain bg-[repeating-conic-gradient(#0001_0_25%,transparent_0_50%)] bg-[length:8px_8px]"
                />
                <span className="font-mono text-2xs text-muted-foreground">#{c.index}</span>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {jsonMap && (
        <Panel>
          <PanelHeader title="Cell coordinate map (JSON)">
            <CopyButton value={() => jsonMap} />
          </PanelHeader>
          <pre className="max-h-64 overflow-auto p-3 font-mono text-xs">{jsonMap}</pre>
        </Panel>
      )}
    </div>
  );
}
