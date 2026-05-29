'use client';

import { useCallback, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OptionsBar, Field } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { BatchRunner, type BatchOutput } from '@/components/tools/batch-runner';
import { convert, FORMAT_INFO, type RasterFormat } from '@/lib/wasm/imaging';

const FORMATS: RasterFormat[] = ['png', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'ico'];

export default function ImageConverterTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<RasterFormat>('webp');
  const [quality, setQuality] = useState(85);
  const [resize, setResize] = useState(false);
  const [maxW, setMaxW] = useState(1920);
  const [maxH, setMaxH] = useState(1080);
  const [bg, setBg] = useState('#ffffff');

  const info = FORMAT_INFO[format];

  const process = useCallback(
    async (file: File, onProgress: (r: number | null) => void): Promise<BatchOutput> => {
      const buf = new Uint8Array(await file.arrayBuffer());
      const out = await convert(
        buf,
        {
          format,
          quality,
          maxWidth: resize ? maxW : 0,
          maxHeight: resize ? maxH : 0,
          background: bg,
        },
        { onProgress }
      );
      const base = file.name.replace(/\.[^.]+$/, '');
      return {
        blob: new Blob([out as BlobPart], { type: info.mime }),
        name: `${base}.${info.ext}`,
      };
    },
    [format, quality, resize, maxW, maxH, bg, info]
  );

  // Changing options should reset processed state — key the BatchRunner.
  const runKey = useMemo(
    () =>
      `${format}-${quality}-${resize}-${maxW}-${maxH}-${bg}-${files.map((f) => f.name + f.size).join(',')}`,
    [format, quality, resize, maxW, maxH, bg, files]
  );

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Output format">
          <Select value={format} onValueChange={(v) => setFormat(v as RasterFormat)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FORMAT_INFO[f].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {info.lossy && (
          <Field label={`Quality · ${quality}`} className="min-w-44">
            <Slider
              value={[quality]}
              onValueChange={([v]) => setQuality(v ?? 85)}
              min={1}
              max={100}
              step={1}
              className="mt-2.5"
            />
          </Field>
        )}

        {!info.alpha && (
          <Field label="Background" hint="for transparency">
            <Input
              type="color"
              value={bg}
              onChange={(e) => setBg(e.target.value)}
              className="h-8 w-14 p-1"
            />
          </Field>
        )}

        <Field label="Resize">
          <div className="flex h-8 items-center gap-2">
            <Switch id="resize" checked={resize} onCheckedChange={setResize} />
            <Label htmlFor="resize" className="text-xs text-muted-foreground">
              fit within
            </Label>
          </div>
        </Field>

        {resize && (
          <>
            <Field label="Max width">
              <Input
                type="number"
                value={maxW}
                min={1}
                onChange={(e) => setMaxW(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 font-mono"
              />
            </Field>
            <Field label="Max height">
              <Input
                type="number"
                value={maxH}
                min={1}
                onChange={(e) => setMaxH(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 font-mono"
              />
            </Field>
          </>
        )}
      </OptionsBar>

      {files.length === 0 ? (
        <FileDropzone
          onFiles={setFiles}
          accept="image/*"
          multiple
          label="Drop images here"
          hint="PNG, JPEG, WebP, GIF, BMP, TIFF, ICO · click to browse · batch supported"
        />
      ) : (
        <>
          <FileDropzone
            onFiles={(f) => setFiles((prev) => [...prev, ...f])}
            accept="image/*"
            multiple
            compact
            label="Add more images"
          />
          <BatchRunner
            key={runKey}
            files={files}
            process={process}
            zipName={`converted-${format}.zip`}
            onClear={() => setFiles([])}
          />
        </>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Note: WebP output is lossless; for ICO, images larger than 256×256 are downscaled.
        Everything is processed locally in a Web Worker — nothing is uploaded.
      </p>
    </div>
  );
}
