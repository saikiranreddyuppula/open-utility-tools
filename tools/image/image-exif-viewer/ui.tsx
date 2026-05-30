'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface ExifEntry {
  label: string;
  value: string;
}

type IfdValue = number | number[] | string;

const TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

const TAG_NAMES: Record<number, string> = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8827: 'ISO',
  0x8769: 'ExifIFD',
  0x8825: 'GPSIFD',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0x920a: 'FocalLength',
  0xa002: 'PixelXDimension',
  0xa003: 'PixelYDimension',
  0xa405: 'FocalLengthIn35mm',
  0x9209: 'Flash',
  0x8822: 'ExposureProgram',
  0x9201: 'ShutterSpeedValue',
  0x9202: 'ApertureValue',
};

const GPS_TAG_NAMES: Record<number, string> = {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
};

const ORIENTATION_LABELS: Record<number, string> = {
  1: 'Normal (0°)',
  2: 'Mirrored horizontal',
  3: 'Rotated 180°',
  4: 'Mirrored vertical',
  5: 'Mirrored + rotated 90° CCW',
  6: 'Rotated 90° CW',
  7: 'Mirrored + rotated 90° CW',
  8: 'Rotated 90° CCW',
};

function readIfd(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  little: boolean
): Map<number, IfdValue> {
  const out = new Map<number, IfdValue>();
  const base = tiffStart + ifdOffset;
  if (base + 2 > view.byteLength) return out;
  const count = view.getUint16(base, little);
  for (let i = 0; i < count; i++) {
    const entry = base + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const num = view.getUint32(entry + 4, little);
    const size = TYPE_SIZES[type];
    if (size === undefined || num <= 0 || num > 0x10000) continue;
    const byteLen = size * num;
    let valOffset = entry + 8;
    if (byteLen > 4) {
      valOffset = tiffStart + view.getUint32(entry + 8, little);
    }
    if (valOffset + byteLen > view.byteLength) continue;

    if (type === 2) {
      // ASCII
      let s = '';
      for (let j = 0; j < num; j++) {
        const code = view.getUint8(valOffset + j);
        if (code === 0) break;
        s += String.fromCharCode(code);
      }
      out.set(tag, s.trim());
    } else if (type === 5 || type === 10) {
      // RATIONAL / SRATIONAL
      const arr: number[] = [];
      for (let j = 0; j < num; j++) {
        const off = valOffset + j * 8;
        const numer = type === 5 ? view.getUint32(off, little) : view.getInt32(off, little);
        const denom = type === 5 ? view.getUint32(off + 4, little) : view.getInt32(off + 4, little);
        arr.push(denom === 0 ? 0 : numer / denom);
      }
      out.set(tag, arr.length === 1 ? (arr[0] ?? 0) : arr);
    } else if (type === 3) {
      const arr: number[] = [];
      for (let j = 0; j < num; j++) arr.push(view.getUint16(valOffset + j * 2, little));
      out.set(tag, arr.length === 1 ? (arr[0] ?? 0) : arr);
    } else if (type === 4 || type === 9) {
      const arr: number[] = [];
      for (let j = 0; j < num; j++) {
        arr.push(
          type === 4
            ? view.getUint32(valOffset + j * 4, little)
            : view.getInt32(valOffset + j * 4, little)
        );
      }
      out.set(tag, arr.length === 1 ? (arr[0] ?? 0) : arr);
    } else if (type === 1 || type === 7) {
      const arr: number[] = [];
      for (let j = 0; j < num; j++) arr.push(view.getUint8(valOffset + j));
      out.set(tag, arr.length === 1 ? (arr[0] ?? 0) : arr);
    }
  }
  return out;
}

function dmsToDecimal(parts: number[], ref: string): number | null {
  const d = parts[0];
  const m = parts[1];
  const s = parts[2];
  if (d === undefined) return null;
  let dec = d + (m ?? 0) / 60 + (s ?? 0) / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return dec;
}

function num(v: IfdValue | undefined): number | null {
  if (typeof v === 'number') return v;
  if (Array.isArray(v) && typeof v[0] === 'number') return v[0];
  return null;
}

function parseExif(buffer: ArrayBuffer): ExifEntry[] | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not JPEG

  let offset = 2;
  let app1Start = -1;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) break;
    if (marker === 0xffda) break; // start of scan
    const segLen = view.getUint16(offset + 2);
    if (marker === 0xffe1) {
      app1Start = offset + 4;
      break;
    }
    offset += 2 + segLen;
  }
  if (app1Start < 0) return null;

  // "Exif\0\0"
  const sig = String.fromCharCode(
    view.getUint8(app1Start),
    view.getUint8(app1Start + 1),
    view.getUint8(app1Start + 2),
    view.getUint8(app1Start + 3)
  );
  if (sig !== 'Exif') return null;

  const tiffStart = app1Start + 6;
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiffStart);
  const little = byteOrder === 0x4949; // 'II'
  if (!little && byteOrder !== 0x4d4d) return null;

  const ifd0Offset = view.getUint32(tiffStart + 4, little);
  const ifd0 = readIfd(view, tiffStart, ifd0Offset, little);

  const entries: ExifEntry[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    entries.push({ label, value });
  };

  push('Make', typeof ifd0.get(0x010f) === 'string' ? (ifd0.get(0x010f) as string) : null);
  push('Model', typeof ifd0.get(0x0110) === 'string' ? (ifd0.get(0x0110) as string) : null);
  push('Software', typeof ifd0.get(0x0131) === 'string' ? (ifd0.get(0x0131) as string) : null);
  push('Date/Time', typeof ifd0.get(0x0132) === 'string' ? (ifd0.get(0x0132) as string) : null);
  const orient = num(ifd0.get(0x0112));
  if (orient !== null) push('Orientation', ORIENTATION_LABELS[orient] ?? String(orient));

  // Exif sub-IFD
  const exifOff = num(ifd0.get(0x8769));
  let exif = new Map<number, IfdValue>();
  if (exifOff !== null && exifOff > 0) {
    exif = readIfd(view, tiffStart, exifOff, little);
  }
  const get = (tag: number): IfdValue | undefined => exif.get(tag) ?? ifd0.get(tag);

  const dto = get(0x9003);
  push('Date taken', typeof dto === 'string' ? dto : null);
  const dtd = get(0x9004);
  push('Date digitized', typeof dtd === 'string' ? dtd : null);

  const exp = num(get(0x829a));
  if (exp !== null && exp > 0) {
    const label = exp < 1 ? `1/${Math.round(1 / exp)} s` : `${exp.toFixed(2)} s`;
    push('Exposure time', label);
  }
  const fnum = num(get(0x829d));
  if (fnum !== null && fnum > 0) push('Aperture', `f/${fnum.toFixed(1)}`);
  const iso = num(get(0x8827));
  if (iso !== null) push('ISO', String(iso));
  const focal = num(get(0x920a));
  if (focal !== null && focal > 0) push('Focal length', `${focal.toFixed(0)} mm`);
  const focal35 = num(get(0xa405));
  if (focal35 !== null && focal35 > 0) push('Focal length (35mm)', `${focal35.toFixed(0)} mm`);
  const px = num(get(0xa002));
  const py = num(get(0xa003));
  if (px !== null && py !== null) push('Dimensions', `${px} × ${py} px`);

  // GPS IFD
  const gpsOff = num(ifd0.get(0x8825));
  if (gpsOff !== null && gpsOff > 0) {
    const gps = readIfd(view, tiffStart, gpsOff, little);
    const latRef = typeof gps.get(0x0001) === 'string' ? (gps.get(0x0001) as string) : 'N';
    const latVal = gps.get(0x0002);
    const lonRef = typeof gps.get(0x0003) === 'string' ? (gps.get(0x0003) as string) : 'E';
    const lonVal = gps.get(0x0004);
    if (Array.isArray(latVal) && Array.isArray(lonVal)) {
      const lat = dmsToDecimal(latVal, latRef);
      const lon = dmsToDecimal(lonVal, lonRef);
      if (lat !== null && lon !== null) {
        push('GPS coordinates', `${lat.toFixed(6)}, ${lon.toFixed(6)}`);
      }
    }
    const alt = num(gps.get(0x0006));
    if (alt !== null && alt > 0) push('GPS altitude', `${alt.toFixed(1)} m`);
  }

  return entries;
}

export default function ExifViewerTool() {
  const [entries, setEntries] = useState<ExifEntry[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [hadExif, setHadExif] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result;
      if (!(buf instanceof ArrayBuffer)) {
        setError('Could not read file.');
        return;
      }
      try {
        const parsed = parseExif(buf);
        if (parsed === null) {
          setEntries([]);
          setHadExif(false);
          return;
        }
        setEntries(parsed);
        setHadExif(parsed.length > 0);
      } catch {
        setError('Failed to parse EXIF data — the file may be malformed.');
      }
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsArrayBuffer(file);
  }, []);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload JPEG
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {entries === null && !error && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload a JPEG photo to read its embedded EXIF metadata (camera, exposure, GPS).
          Parsing happens entirely in your browser — the file is never uploaded.
        </p>
      )}

      {entries !== null && !hadExif && (
        <p className="px-1 text-xs text-muted-foreground">
          No EXIF metadata found in this file. It may have been stripped, or it is not a
          JPEG with EXIF.
        </p>
      )}

      {entries !== null && entries.length > 0 && (
        <Panel>
          <PanelHeader title="EXIF metadata">
            <CopyButton
              value={() => entries.map((e) => `${e.label}: ${e.value}`).join('\n')}
            />
          </PanelHeader>
          <div className="max-h-[520px] divide-y overflow-auto">
            {entries.map((e) => (
              <div key={e.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-40 shrink-0 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {e.label}
                </span>
                <span className="min-w-0 flex-1 break-words font-mono text-sm">{e.value}</span>
                <CopyButton value={e.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[fileName && `File: ${fileName}`, `${entries.length} fields`]} />
        </Panel>
      )}
    </div>
  );
}
