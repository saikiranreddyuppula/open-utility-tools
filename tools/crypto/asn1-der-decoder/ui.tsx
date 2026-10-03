'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Trash2,
} from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  decodeInputBytes,
  decodeInputText,
  flattenNodes,
  identifyDer,
  KIND_LABELS,
  parseTree,
  summarizeDer,
  toHex,
  treeToJson,
  CLASS_NAMES,
  type Asn1Node,
  type DecodedInput,
  type Summary,
  type Tone,
} from './logic';

const SAMPLES: { id: string; label: string; text: string }[] = [
  { id: 'cert', label: 'Certificate (EC, many extensions)', text: `-----BEGIN CERTIFICATE-----
MIID9zCCA36gAwIBAgIUIK8RkyMy27EJnucZWx3//+QS54wwCgYIKoZIzj0EAwMw
TzELMAkGA1UEBhMCVVMxHzAdBgNVBAoMFkV4YW1wbGUgVHJ1c3QgU2VydmljZXMx
HzAdBgNVBAMMFkV4YW1wbGUgU2FtcGxlIFJvb3QgQ0EwHhcNMjYxMDAzMDQxODU4
WhcNNDYwOTI4MDQxODU4WjBrMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZv
cm5pYTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEVMBMGA1UECgwMRXhhbXBsZSBD
b3JwMRgwFgYDVQQDDA93d3cuZXhhbXBsZS5jb20wWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAAQxd26yMN+EdZ+Jiy3A9zbb4sDhtQkMl7vaoLm2Bf9FfGvB+cb/p3g4
aiow4FlnvwpQkGKhbNMrOV8cCkHEAx3mo4ICGjCCAhYwDAYDVR0TAQH/BAIwADAO
BgNVHQ8BAf8EBAMCB4AwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMCMB0G
A1UdDgQWBBT9M8u4jEiKtjeSIwFDzGXAeRW0PzAfBgNVHSMEGDAWgBSuhU8R/97E
h7vDfT4VEmf9SWjiDTBjBgNVHREEXDBagg93d3cuZXhhbXBsZS5jb22CC2V4YW1w
bGUuY29tghEqLmFwaS5leGFtcGxlLmNvbYcEwAACCocQIAENuAAAAAAAAAAAAAAA
EIEPb3BzQGV4YW1wbGUuY29tMDUGA1UdHwQuMCwwKqAooCaGJGh0dHA6Ly9jcmwu
ZXhhbXBsZS5jb20vc2FtcGxlLWNhLmNybDBlBggrBgEFBQcBAQRZMFcwIwYIKwYB
BQUHMAGGF2h0dHA6Ly9vY3NwLmV4YW1wbGUuY29tMDAGCCsGAQUFBzAChiRodHRw
Oi8vcGtpLmV4YW1wbGUuY29tL3NhbXBsZS1jYS5jcnQwRwYDVR0gBEAwPjAIBgZn
gQwBAgIwMgYJKwYBBAGGjR8BMCUwIwYIKwYBBQUHAgEWF2h0dHBzOi8vZXhhbXBs
ZS5jb20vY3BzMEsGCisGAQQB1nkCBAIEPQQ7ADkANwClXIwvkRdiLIE+EZ9KJ9gO
e1MdROKKYQm3MPrOUhgGnQAAAZt22qgAAAAEAwAIAAAAAAAAAAAwCgYIKoZIzj0E
AwMDZwAwZAIwVH4KiilXdEpAzXNDEjmEE+a8GmuJ0s7EPUbGp7RAfYpYBKCcBR8C
EZPlvJsLV4NKAjBp+k1mU+pX1B2ce9Jrp4YxWX3D6Y9QOs/Opsc7EGe4UqmpJplR
ZPGTweLP79/N/6c=
-----END CERTIFICATE-----
` },
  { id: 'csr', label: 'CSR (RSA 2048 + SAN)', text: `-----BEGIN CERTIFICATE REQUEST-----
MIIC/DCCAeQCAQAwbzELMAkGA1UEBhMCR0IxDzANBgNVBAgMBkxvbmRvbjEPMA0G
A1UEBwwGTG9uZG9uMRQwEgYDVQQKDAtFeGFtcGxlIEx0ZDELMAkGA1UECwwCSVQx
GzAZBgNVBAMMEnNob3AuZXhhbXBsZS5jby51azCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAL01WKUl+jIhbBK85GsATCDlvmAJX3WM6ROGy8TEt8t4WPbp
+0XR7Zup6Ck15SqmRWz2ePPNS+ATZpDFcKOa1J8YyuRZqw8nQ7ujPXI3KctGfGmV
JpXDTxfVQ7YLv/NTya9Z/ZXte+b+2Y5JKC7NLIefztD8k93flR7zMpzsUOQxx+oD
QvCK+p9iQIuaxdcDkMPI92/AgpTgqNnjW4oIYVF0vQ4fOAFgVLZt5wMLn2cI0oGh
omJaoRzy8K5wkf4RmZrDpyOKvflRtRNML2e+Frc9WtYBt9Ebc+cm2BKVqG3Ku0X4
pVSoAdl8dtaBlBQo6iFxrIh8/rVLQf7Xq7rgu6ECAwEAAaBIMEYGCSqGSIb3DQEJ
DjE5MDcwNQYDVR0RBC4wLIISc2hvcC5leGFtcGxlLmNvLnVrghZ3d3cuc2hvcC5l
eGFtcGxlLmNvLnVrMA0GCSqGSIb3DQEBCwUAA4IBAQArRjdOgdX8VmSE9M4aDIi9
a9i4+QHn+3M0wBfS/unS53L2+9x7ymzKxWaZKH/GT+cbr8IsyDAol0Nty3ohyhnO
SxOLTgL+E5oZLyrxfus6HiN413fv5w2QcRQXy3KGNScOebttxEVytD9l40hnGhar
+p3O8VOZOOMamE6+7NQcSWR19IdjXtf/CvbzMjLIDFPmjDW1MJLkQYYITH7iW3ko
SzZQCdNlG9fxISG20o9OURAOniQcHpRZVifKbGsLsctgqat1AEDtadw6SweFCHWd
ABCoaEo8CSFxpC4Md0JMgocX+rVj9fcRVWFbcvQE7GvhsM8EtLNLlAu5XR3qAxak
-----END CERTIFICATE REQUEST-----
` },
  { id: 'key', label: 'EC private key (PKCS#8)', text: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgnbNLtlapBM/w7Ssq
R2eR8y4t5Mxz7cJWQ6xWIThV+TShRANCAARtteGjEnXxMF0bEOetK4CVla93kHVa
9A7cIRIOBvlG2jpz6YvgMnukDxmbNmSONBnUkpfFKf7pI4l6/reRFqTO
-----END PRIVATE KEY-----
` },
  { id: 'p7b', label: 'PKCS#7 bundle (2 certificates)', text: `-----BEGIN PKCS7-----
MIIGTQYJKoZIhvcNAQcCoIIGPjCCBjoCAQExADALBgkqhkiG9w0BBwGgggYiMIID
9zCCA36gAwIBAgIUIK8RkyMy27EJnucZWx3//+QS54wwCgYIKoZIzj0EAwMwTzEL
MAkGA1UEBhMCVVMxHzAdBgNVBAoMFkV4YW1wbGUgVHJ1c3QgU2VydmljZXMxHzAd
BgNVBAMMFkV4YW1wbGUgU2FtcGxlIFJvb3QgQ0EwHhcNMjYxMDAzMDQxODU4WhcN
NDYwOTI4MDQxODU4WjBrMQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5p
YTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEVMBMGA1UECgwMRXhhbXBsZSBDb3Jw
MRgwFgYDVQQDDA93d3cuZXhhbXBsZS5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMB
BwNCAAQxd26yMN+EdZ+Jiy3A9zbb4sDhtQkMl7vaoLm2Bf9FfGvB+cb/p3g4aiow
4FlnvwpQkGKhbNMrOV8cCkHEAx3mo4ICGjCCAhYwDAYDVR0TAQH/BAIwADAOBgNV
HQ8BAf8EBAMCB4AwHQYDVR0lBBYwFAYIKwYBBQUHAwEGCCsGAQUFBwMCMB0GA1Ud
DgQWBBT9M8u4jEiKtjeSIwFDzGXAeRW0PzAfBgNVHSMEGDAWgBSuhU8R/97Eh7vD
fT4VEmf9SWjiDTBjBgNVHREEXDBagg93d3cuZXhhbXBsZS5jb22CC2V4YW1wbGUu
Y29tghEqLmFwaS5leGFtcGxlLmNvbYcEwAACCocQIAENuAAAAAAAAAAAAAAAEIEP
b3BzQGV4YW1wbGUuY29tMDUGA1UdHwQuMCwwKqAooCaGJGh0dHA6Ly9jcmwuZXhh
bXBsZS5jb20vc2FtcGxlLWNhLmNybDBlBggrBgEFBQcBAQRZMFcwIwYIKwYBBQUH
MAGGF2h0dHA6Ly9vY3NwLmV4YW1wbGUuY29tMDAGCCsGAQUFBzAChiRodHRwOi8v
cGtpLmV4YW1wbGUuY29tL3NhbXBsZS1jYS5jcnQwRwYDVR0gBEAwPjAIBgZngQwB
AgIwMgYJKwYBBAGGjR8BMCUwIwYIKwYBBQUHAgEWF2h0dHBzOi8vZXhhbXBsZS5j
b20vY3BzMEsGCisGAQQB1nkCBAIEPQQ7ADkANwClXIwvkRdiLIE+EZ9KJ9gOe1Md
ROKKYQm3MPrOUhgGnQAAAZt22qgAAAAEAwAIAAAAAAAAAAAwCgYIKoZIzj0EAwMD
ZwAwZAIwVH4KiilXdEpAzXNDEjmEE+a8GmuJ0s7EPUbGp7RAfYpYBKCcBR8CEZPl
vJsLV4NKAjBp+k1mU+pX1B2ce9Jrp4YxWX3D6Y9QOs/Opsc7EGe4UqmpJplRZPGT
weLP79/N/6cwggIjMIIBqqADAgECAhRh2VAmd6KqBvnaEUU3eVPPVA3D9TAKBggq
hkjOPQQDAzBPMQswCQYDVQQGEwJVUzEfMB0GA1UECgwWRXhhbXBsZSBUcnVzdCBT
ZXJ2aWNlczEfMB0GA1UEAwwWRXhhbXBsZSBTYW1wbGUgUm9vdCBDQTAgFw0yNjEw
MDMwNDE4NThaGA8yMDUxMDUyNTA0MTg1OFowTzELMAkGA1UEBhMCVVMxHzAdBgNV
BAoMFkV4YW1wbGUgVHJ1c3QgU2VydmljZXMxHzAdBgNVBAMMFkV4YW1wbGUgU2Ft
cGxlIFJvb3QgQ0EwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAStAz6D4L/3uQYUcAC4
S6d8t+dZcuEDYcgiO/5yaBNDYPoBAHocTqZDqTtwIZG10SKNVSH8ijtVcBodM/sI
LWLFZF7QVM3oGt2GwEQJj8vdNJFKTj4djs6kM4t2qeU9JFijRTBDMBIGA1UdEwEB
/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgEGMB0GA1UdDgQWBBSuhU8R/97Eh7vD
fT4VEmf9SWjiDTAKBggqhkjOPQQDAwNnADBkAjBtP3B9kIztpigQP1IuNVE+XQNt
+T5FQFzZCVykE3pi/3lwtJBI3+LSMt9EhKH9c7gCMFPw5Na+QRqemSQI2XKFNxXm
jQm0z/kwXK8ibchFCFNEO+YZ/2cpvM7ub/wKnf9g/TEA
-----END PKCS7-----
` },
];

const MAX_ROWS = 2500;
const HEX_ROWS = 24;
const HEX_PER_ROW = 16;

type DecodeState =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: DecodedInput };

function decodeSource(text: string, file: { name: string; bytes: Uint8Array } | null): DecodeState {
  if (!file && !text.trim()) return { status: 'empty' };
  try {
    return { status: 'ok', data: file ? decodeInputBytes(file.bytes) : decodeInputText(text) };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

function defaultCollapsed(roots: Asn1Node[], count: number): Set<number> {
  const out = new Set<number>();
  if (count <= 600) return out;
  for (const n of flattenNodes(roots)) if (n.depth >= 2 && n.children.length > 0) out.add(n.id);
  return out;
}

const toneText: Record<Tone, string> = {
  ok: 'text-success',
  warn: 'text-warning',
  bad: 'text-destructive',
  info: '',
  muted: 'text-muted-foreground',
};

function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  if (tone === 'ok') return <Badge variant="success">{children}</Badge>;
  if (tone === 'bad') return <Badge variant="destructive">{children}</Badge>;
  if (tone === 'warn') return <Badge variant="outline" className="border-warning/50 text-warning">{children}</Badge>;
  if (tone === 'muted') return <Badge variant="muted">{children}</Badge>;
  return <Badge variant="secondary">{children}</Badge>;
}

function SummaryView({ s }: { s: Summary }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{s.kind}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-all text-sm font-semibold">{s.title}</h3>
          {s.badges.map((b) => (
            <ToneBadge key={b.text} tone={b.tone}>
              {b.text}
            </ToneBadge>
          ))}
        </div>
      </div>
      {s.sections.map((sec) => (
        <Panel key={sec.title}>
          <PanelHeader title={sec.title} />
          <div className="divide-y">
            {sec.rows.map((r, i) => (
              <div
                key={`${r.label}-${i}`}
                className="group grid grid-cols-1 gap-0.5 px-3 py-1.5 sm:grid-cols-[190px_minmax(0,1fr)_auto] sm:gap-3"
              >
                <span className="text-xs text-muted-foreground">{r.label}</span>
                <span
                  className={cn(
                    'whitespace-pre-wrap break-all text-xs',
                    r.mono && 'font-mono',
                    r.tone ? toneText[r.tone] : ''
                  )}
                >
                  {r.value}
                </span>
                {r.mono && r.value.length > 3 ? (
                  <CopyButton
                    value={r.value.replace(/\n(?=[0-9a-f]{64}$|[0-9a-f]{64}\n)/g, '')}
                    size="icon-sm"
                    className="size-5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  />
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </Panel>
      ))}
      {s.children.map((c, i) => (
        <details key={i} open={i === 0} className="rounded-lg border bg-card">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
            #{i + 1} - {c.title}
          </summary>
          <div className="border-t p-3">
            <SummaryView s={c} />
          </div>
        </details>
      ))}
    </div>
  );
}

function HexDump({ bytes, sel }: { bytes: Uint8Array; sel: Asn1Node | null }) {
  const totalRows = Math.max(1, Math.ceil(bytes.length / HEX_PER_ROW));
  const [row, setRow] = useState(0);

  useEffect(() => {
    if (sel) setRow(Math.max(0, Math.min(totalRows - HEX_ROWS, Math.floor(sel.offset / HEX_PER_ROW) - 2)));
  }, [sel, totalRows]);

  const start = Math.max(0, Math.min(row, totalRows - 1));
  const rows: React.ReactNode[] = [];
  const hdrFrom = sel ? sel.offset : -1;
  const bodyFrom = sel ? sel.offset + sel.headerLen : -1;
  const to = sel ? sel.end : -1;
  for (let r = start; r < Math.min(totalRows, start + HEX_ROWS); r++) {
    const cells: React.ReactNode[] = [];
    const chars: React.ReactNode[] = [];
    for (let c = 0; c < HEX_PER_ROW; c++) {
      const i = r * HEX_PER_ROW + c;
      if (i >= bytes.length) {
        cells.push(<span key={c} className="inline-block w-[1.55em]" />);
        continue;
      }
      const b = bytes[i] ?? 0;
      const cls =
        i >= hdrFrom && i < bodyFrom
          ? 'bg-primary/40 text-foreground'
          : i >= bodyFrom && i < to
            ? 'bg-primary/15'
            : '';
      cells.push(
        <span key={c} className={cn('inline-block w-[1.55em] rounded-[2px] text-center', cls)}>
          {b.toString(16).padStart(2, '0')}
        </span>
      );
      chars.push(
        <span key={c} className={cn('rounded-[2px]', cls)}>
          {b >= 32 && b < 127 ? String.fromCharCode(b) : '.'}
        </span>
      );
    }
    rows.push(
      <div key={r} className="flex gap-3 whitespace-pre leading-5">
        <span className="w-[5ch] shrink-0 text-muted-foreground">{(r * HEX_PER_ROW).toString(16).padStart(4, '0')}</span>
        <span>{cells}</span>
        <span className="hidden text-muted-foreground sm:inline">{chars}</span>
      </div>
    );
  }
  const first = start * HEX_PER_ROW;
  const last = Math.min(bytes.length, (start + HEX_ROWS) * HEX_PER_ROW) - 1;
  return (
    <Panel>
      <PanelHeader title="Hex dump">
        <span className="px-1 font-mono text-2xs text-muted-foreground">
          0x{first.toString(16)}-0x{Math.max(first, last).toString(16)} / {bytes.length}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={start === 0} onClick={() => setRow(Math.max(0, start - HEX_ROWS))}>
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next page"
          disabled={start + HEX_ROWS >= totalRows}
          onClick={() => setRow(Math.min(totalRows - 1, start + HEX_ROWS))}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </PanelHeader>
      <div className="overflow-x-auto p-2 font-mono text-xs">{rows}</div>
      <div className="flex flex-wrap items-center gap-3 border-t bg-muted/30 px-3 py-1 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-[2px] bg-primary/40" /> header (tag + length)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-[2px] bg-primary/15" /> content
        </span>
      </div>
    </Panel>
  );
}

function NodeDetail({ node, bytes }: { node: Asn1Node | null; bytes: Uint8Array }) {
  if (!node) {
    return (
      <Panel>
        <PanelHeader title="Selected node" />
        <p className="p-3 text-xs text-muted-foreground">Click a node in the tree to see its details and highlight its bytes.</p>
      </Panel>
    );
  }
  const contentStart = node.offset + node.headerLen;
  const content = bytes.subarray(contentStart, contentStart + node.len);
  const rows: [string, string][] = [
    ['Type', node.name + (node.constructed ? ' (constructed)' : '')],
    ['Class / tag', `${CLASS_NAMES[node.cls] ?? '?'} / ${node.tag}`],
    ['Offset', `${node.offset} (0x${node.offset.toString(16)})`],
    ['Header length', String(node.headerLen)],
    ['Content length', node.indef ? `${node.len} (indefinite length + 2 byte end marker)` : String(node.len)],
    ['Total length', String(node.end - node.offset)],
  ];
  if (node.unused !== undefined) rows.push(['Unused bits', String(node.unused)]);
  if (node.nested) rows.push(['Nested', node.nested === 'octet' ? 'DER structure inside OCTET STRING' : 'DER structure inside BIT STRING']);
  if (node.oid) rows.push(['OID', node.oid], ['OID name', node.oidName || 'unknown']);
  return (
    <Panel>
      <PanelHeader title="Selected node">
        <CopyButton value={() => node.full || toHex(content)} label="Copy value" />
      </PanelHeader>
      <div className="divide-y text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 px-3 py-1">
            <span className="text-muted-foreground">{k}</span>
            <span className="break-all font-mono">{v}</span>
          </div>
        ))}
        {node.error && (
          <div className="px-3 py-1 text-destructive">{node.error}</div>
        )}
        {!node.constructed && node.full && (
          <div className="px-3 py-1.5">
            <p className="mb-1 text-muted-foreground">Value</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono">{node.full.length > 3000 ? `${node.full.slice(0, 3000)}…` : node.full}</pre>
          </div>
        )}
        {content.length > 0 && !node.constructed && (
          <div className="px-3 py-1.5">
            <p className="mb-1 flex items-center justify-between text-muted-foreground">
              <span>Content bytes ({content.length})</span>
              <CopyButton value={() => toHex(content)} label="Copy hex" size="sm" />
            </p>
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono">
              {toHex(content.subarray(0, 512))}
              {content.length > 512 ? '…' : ''}
            </pre>
          </div>
        )}
      </div>
    </Panel>
  );
}

function TreeRow({
  node,
  collapsed,
  selected,
  onToggle,
  onSelect,
}: {
  node: Asn1Node;
  collapsed: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const hasKids = node.children.length > 0;
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-expanded={hasKids ? !collapsed : undefined}
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer items-start gap-1.5 px-2 py-[3px] font-mono text-xs hover:bg-muted/60',
        selected && 'bg-primary/10 hover:bg-primary/15',
        node.error && 'text-destructive'
      )}
      style={{ paddingLeft: 8 + node.depth * 14 }}
    >
      {hasKids ? (
        <button
          type="button"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          className="mt-[1px] shrink-0 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      ) : (
        <span className="inline-block size-3.5 shrink-0" />
      )}
      <span className="w-[5.5ch] shrink-0 text-right text-[10px] leading-4 text-muted-foreground" title={`offset ${node.offset}, header ${node.headerLen}, content ${node.len}`}>
        {node.offset}
      </span>
      <span className="w-[6.5ch] shrink-0 text-[10px] leading-4 text-muted-foreground">
        {node.headerLen}+{node.len}
      </span>
      <span className={cn('shrink-0 font-semibold', node.constructed ? 'text-primary' : '')}>{node.name}</span>
      {node.nested && <span className="shrink-0 rounded-sm bg-muted px-1 text-[10px] leading-4 text-muted-foreground">DER</span>}
      <span className="min-w-0 flex-1 break-all text-muted-foreground">{node.value}</span>
    </div>
  );
}

export default function Asn1DecoderTool() {
  const [text, setText] = useState<string>(SAMPLES[0]?.text ?? '');
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [blockIdx, setBlockIdx] = useState(0);
  const [expandNested, setExpandNested] = useState(true);
  const [tab, setTab] = useState<'summary' | 'tree'>('summary');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<Summary | null | 'loading'>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const decoded = useMemo(() => decodeSource(text, file), [text, file]);
  const items = decoded.status === 'ok' ? decoded.data.items : [];
  const item = items[Math.min(blockIdx, Math.max(0, items.length - 1))] ?? null;

  const tree = useMemo(() => {
    if (!item || item.legacyEncrypted) return null;
    return parseTree(item.der, { expandNested });
  }, [item, expandNested]);

  useEffect(() => {
    setSelectedId(null);
    setCollapsed(tree ? defaultCollapsed(tree.roots, tree.count) : new Set());
  }, [tree]);

  useEffect(() => {
    let cancelled = false;
    if (!item || item.legacyEncrypted) {
      setSummary(null);
      return;
    }
    setSummary('loading');
    summarizeDer(item.der)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  const flat = useMemo(() => (tree ? flattenNodes(tree.roots) : []), [tree]);
  const selected = useMemo(() => flat.find((n) => n.id === selectedId) ?? null, [flat, selectedId]);

  const visible = useMemo(() => {
    const out: Asn1Node[] = [];
    const walk = (n: Asn1Node) => {
      out.push(n);
      if (!collapsed.has(n.id)) n.children.forEach(walk);
    };
    tree?.roots.forEach(walk);
    return out;
  }, [tree, collapsed]);

  const toggle = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      setFileError(`${f.name} is ${formatBytes(f.size)} - files over 20 MB are not supported.`);
      return;
    }
    setFileError(null);
    const buf = new Uint8Array(await f.arrayBuffer());
    setFile({ name: f.name, bytes: buf });
    setBlockIdx(0);
  }, []);

  const loadSample = (t: string) => {
    setFileError(null);
    setFile(null);
    setText(t);
    setBlockIdx(0);
  };

  const kind = item && !item.legacyEncrypted ? identifyDer(item.der) : null;
  const baseName = (file?.name.replace(/\.[^.]+$/, '') || (item ? item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'asn1')) || 'asn1';

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Input">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText('');
              setFile(null);
              setBlockIdx(0);
            }}
          >
            <Trash2 className="size-3.5" /> Clear
          </Button>
        </PanelHeader>
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Samples</span>
          {SAMPLES.map((s) => (
            <Button key={s.id} variant="outline" size="sm" onClick={() => loadSample(s.text)} title={s.label}>
              {s.id === 'cert' ? 'Certificate' : s.id === 'csr' ? 'CSR' : s.id === 'key' ? 'EC key' : 'PKCS#7 bundle'}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <Textarea
            value={file ? '' : text}
            onChange={(e) => {
              setFile(null);
              setText(e.target.value);
              setBlockIdx(0);
            }}
            placeholder={file ? `Loaded file: ${file.name}` : 'Paste PEM (any label, several blocks), Base64 or hex...'}
            spellCheck={false}
            className="max-h-56 min-h-32 resize-y font-mono text-xs"
          />
          <FileDropzone
            onFiles={onFiles}
            accept=".der,.cer,.crt,.pem,.csr,.p7b,.p7c,.key,.pub,.crl,.p12,.pfx,.cms,.bin,.txt"
            label={file ? file.name : 'Drop a file'}
            hint={file ? `${formatBytes(file.bytes.length)} - click to replace` : '.der .cer .crt .pem .csr .p7b .key .pub'}
            compact
          />
        </div>
        <StatBar
          items={[
            decoded.status === 'ok' && `format: ${decoded.data.format.toUpperCase()}`,
            decoded.status === 'ok' && `${items.length} block${items.length === 1 ? '' : 's'}`,
            item && `${item.der.length.toLocaleString()} bytes`,
            kind && KIND_LABELS[kind],
            'all processing is local',
          ]}
        />
      </Panel>

      {decoded.status === 'error' && <ErrorBanner error={decoded.message} />}
      <ErrorBanner error={fileError} />
      {decoded.status === 'ok' && decoded.data.warnings.map((w) => (
        <p key={w} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">{w}</p>
      ))}

      {items.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Block</span>
          {items.map((it, i) => (
            <Button
              key={i}
              size="sm"
              variant={i === Math.min(blockIdx, items.length - 1) ? 'secondary' : 'outline'}
              onClick={() => setBlockIdx(i)}
            >
              {i + 1}. {it.label} <span className="font-mono text-2xs text-muted-foreground">{formatBytes(it.der.length)}</span>
            </Button>
          ))}
        </div>
      )}

      {item?.legacyEncrypted && (
        <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-semibold">Encrypted PEM block ({item.label})</p>
          <p className="text-muted-foreground">
            This block has RFC 1421 encryption headers (<code className="font-mono">Proc-Type: 4,ENCRYPTED</code>
            {item.dekInfo ? <>, <code className="font-mono">DEK-Info: {item.dekInfo.cipher},{item.dekInfo.iv}</code></> : null}), so its bytes are
            ciphertext, not ASN.1. Decrypt it first - for example <code className="font-mono">openssl rsa -in key.pem -out plain.pem</code> - or use the
            PEM Key Converter tool, then paste the result here.
          </p>
        </div>
      )}

      {item && tree && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'summary' | 'tree')}>
          <div className="flex flex-wrap items-center gap-2">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="tree">ASN.1 tree</TabsTrigger>
            </TabsList>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <CopyButton
                value={() => JSON.stringify(treeToJson(item.der, tree.roots), null, 2)}
                label="Copy JSON"
                variant="outline"
              />
              <DownloadButton data={() => item.der} filename={`${baseName}.der`} label="Download DER" variant="outline" />
            </div>
          </div>

          <TabsContent value="summary">
            {summary === 'loading' && <p className="p-4 text-xs text-muted-foreground">Decoding...</p>}
            {summary && summary !== 'loading' && <SummaryView s={summary} />}
            {summary === null && (
              <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
                The structure was not recognised as a certificate, CSR, key or PKCS#7 bundle - open the <b>ASN.1 tree</b> tab to inspect it generically.
              </div>
            )}
          </TabsContent>

          <TabsContent value="tree">
            <OptionsBar className="mb-3">
              <Field label="Nested DER" hint="Re-parse OCTET / BIT STRING contents">
                <div className="flex h-8 items-center gap-2">
                  <Switch checked={expandNested} onCheckedChange={setExpandNested} />
                  <span className="text-xs text-muted-foreground">{expandNested ? 'auto-expand' : 'off'}</span>
                </div>
              </Field>
              <Field label="Tree">
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
                    <ChevronsUpDown className="size-3.5" /> Expand all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCollapsed(new Set(flat.filter((n) => n.children.length > 0).map((n) => n.id)))}
                  >
                    <ChevronsDownUp className="size-3.5" /> Collapse all
                  </Button>
                </div>
              </Field>
            </OptionsBar>
            {tree.errors.length > 0 && <ErrorBanner className="mb-3" error={tree.errors.slice(0, 3).join(' | ')} />}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <Panel>
                <PanelHeader title="Structure">
                  <span className="px-1 font-mono text-2xs text-muted-foreground">offset - header+content</span>
                </PanelHeader>
                <div role="tree" className="max-h-[640px] overflow-auto py-1">
                  {visible.slice(0, MAX_ROWS).map((n) => (
                    <TreeRow
                      key={n.id}
                      node={n}
                      collapsed={collapsed.has(n.id)}
                      selected={n.id === selectedId}
                      onToggle={() => toggle(n.id)}
                      onSelect={() => setSelectedId(n.id)}
                    />
                  ))}
                  {visible.length > MAX_ROWS && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Showing the first {MAX_ROWS.toLocaleString()} of {visible.length.toLocaleString()} rows - collapse some nodes to see the rest.
                    </p>
                  )}
                </div>
                <StatBar items={[`${tree.count.toLocaleString()} nodes`, `${visible.length.toLocaleString()} visible`, tree.truncated && 'node limit reached']} />
              </Panel>
              <div className="space-y-3">
                <NodeDetail node={selected} bytes={item.der} />
                <HexDump bytes={item.der} sel={selected} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      <p className="text-2xs text-muted-foreground">
        Parses BER/DER (long-form and indefinite lengths) entirely in your browser. Nested structures inside OCTET/BIT STRINGs are detected heuristically.
        Certificate checks (validity, fingerprints, self-signature) are informational only - this tool does not validate trust chains or revocation.
      </p>
    </div>
  );
}
