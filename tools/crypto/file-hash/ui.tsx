'use client';
import { useCallback, useRef, useState } from 'react';
import { Check, FileUp, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Panel, PanelHeader, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { cn } from '@/lib/utils';

const webcrypto = (
  globalThis as unknown as { crypto: { subtle: SubtleCrypto } }
).crypto;

type Algo = 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512';
const ALGOS: Algo[] = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'];

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/* Self-contained MD5 (RFC 1321) over a byte array, returns lowercase hex. */
function md5Hex(bytes: Uint8Array): string {
  function rl(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c));
  }
  function add(a: number, b: number): number {
    return (a + b) | 0;
  }
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15,
    21,
  ];
  const K: number[] = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

  const origLen = bytes.length;
  const bitLen = origLen * 8;
  // padded length = multiple of 64, leaving 8 bytes for length
  const withOne = origLen + 1;
  const padded = (Math.ceil((withOne + 8) / 64) * 64) | 0;
  const msg = new Uint8Array(padded);
  msg.set(bytes);
  msg[origLen] = 0x80;
  // little-endian 64-bit length (low 32 bits, then high 32 bits)
  const lo = bitLen >>> 0;
  const hi = Math.floor(bitLen / 4294967296) >>> 0;
  msg[padded - 8] = lo & 0xff;
  msg[padded - 7] = (lo >>> 8) & 0xff;
  msg[padded - 6] = (lo >>> 16) & 0xff;
  msg[padded - 5] = (lo >>> 24) & 0xff;
  msg[padded - 4] = hi & 0xff;
  msg[padded - 3] = (hi >>> 8) & 0xff;
  msg[padded - 2] = (hi >>> 16) & 0xff;
  msg[padded - 1] = (hi >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Int32Array(16);
  for (let off = 0; off < padded; off += 64) {
    for (let j = 0; j < 16; j++) {
      const p = off + j * 4;
      M[j] =
        (msg[p] ?? 0) | ((msg[p + 1] ?? 0) << 8) | ((msg[p + 2] ?? 0) << 16) | ((msg[p + 3] ?? 0) << 24);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = add(add(add(F, A), K[i] ?? 0), M[g] ?? 0);
      A = D;
      D = C;
      C = B;
      B = add(B, rl(F, s[i] ?? 0));
    }
    a0 = add(a0, A);
    b0 = add(b0, B);
    c0 = add(c0, C);
    d0 = add(d0, D);
  }

  const out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((v, i) => {
    out[i * 4] = v & 0xff;
    out[i * 4 + 1] = (v >>> 8) & 0xff;
    out[i * 4 + 2] = (v >>> 16) & 0xff;
    out[i * 4 + 3] = (v >>> 24) & 0xff;
  });
  return Array.from(out, (b) => b.toString(16).padStart(2, '0')).join('');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(2)} ${units[i] ?? 'KB'}`;
}

export default function FileHash() {
  const [selected, setSelected] = useState<Record<Algo, boolean>>({
    MD5: true,
    'SHA-1': true,
    'SHA-256': true,
    'SHA-512': false,
  });
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [hashes, setHashes] = useState<Partial<Record<Algo, string>>>({});
  const [expected, setExpected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hashFile = useCallback(
    async (file: File) => {
      setError(null);
      setHashes({});
      setFileName(file.name);
      setFileSize(file.size);
      const algos = ALGOS.filter((a) => selected[a]);
      if (algos.length === 0) {
        setError('Select at least one algorithm');
        return;
      }
      setBusy(true);
      try {
        const buf = await file.arrayBuffer();
        const result: Partial<Record<Algo, string>> = {};
        for (const algo of algos) {
          if (algo === 'MD5') {
            result[algo] = md5Hex(new Uint8Array(buf));
          } else {
            const digest = await webcrypto.subtle.digest(algo, buf);
            result[algo] = bufToHex(digest);
          }
        }
        setHashes(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to hash file');
      } finally {
        setBusy(false);
      }
    },
    [selected],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void hashFile(file);
    },
    [hashFile],
  );

  const expectedNorm = expected.trim().toLowerCase();
  const match = expectedNorm
    ? (Object.values(hashes) as string[]).some((h) => h.toLowerCase() === expectedNorm)
    : null;

  return (
    <div className="flex flex-col gap-3">
      <Field label="Algorithms">
        <div className="flex flex-wrap gap-4">
          {ALGOS.map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={selected[a]}
                onCheckedChange={(c) => setSelected((prev) => ({ ...prev, [a]: c === true }))}
              />
              {a}
            </label>
          ))}
        </div>
      </Field>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/60',
        )}
      >
        {busy ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <FileUp className="h-8 w-8 text-muted-foreground" />}
        <div className="text-sm font-medium">{busy ? 'Hashing…' : 'Drop a file here or click to browse'}</div>
        <div className="text-xs text-muted-foreground">Everything runs locally in your browser</div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void hashFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <ErrorBanner error={error} />

      {fileName ? (
        <Panel>
          <PanelHeader title={`${fileName} — ${formatBytes(fileSize)}`} />
          <div className="divide-y">
            {ALGOS.filter((a) => hashes[a]).map((a) => {
              const value = hashes[a] ?? '';
              const isMatch = expectedNorm ? value.toLowerCase() === expectedNorm : false;
              return (
                <div key={a} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{a}</span>
                  <span className="flex-1 break-all font-mono text-xs">{value}</span>
                  {expectedNorm && isMatch ? <Check className="h-4 w-4 shrink-0 text-green-600" /> : null}
                  <CopyButton value={value} />
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <Field label="Expected checksum (optional)" hint="Paste a known hash to verify it matches any computed value above.">
        <Input
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="e.g. d41d8cd98f00b204e9800998ecf8427e"
          className="font-mono"
        />
      </Field>

      {match !== null && Object.keys(hashes).length > 0 ? (
        match ? (
          <div className="flex items-center gap-2 rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700">
            <Check className="h-4 w-4" />
            Checksum matches.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <X className="h-4 w-4" />
            No computed hash matches the expected checksum.
          </div>
        )
      ) : null}
    </div>
  );
}
