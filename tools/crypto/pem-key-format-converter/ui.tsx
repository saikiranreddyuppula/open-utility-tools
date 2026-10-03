'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Trash2, XCircle } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import { zipFiles } from '@/lib/zip';
import {
  analyzeItem,
  fingerprintItem,
  FORMAT_LABELS,
  normalizedPem,
  parseInput,
  parseInputBytes,
  utf8Encode,
  type Analysis,
  type KeyFingerprint,
  type OutputBlock,
  type ParsedItem,
  type ParseResult,
} from './logic';

const SAMPLE_RSA = `-----BEGIN RSA PRIVATE KEY-----
MIIEoQIBAAKCAQEAlNJVsWhhn6rfv4qzbx8q15K2wR2HOefaSVPDHDkOIz4RhfxN
Tp1zcj+4zED8z7V4chy6DX5SBvXXzyCrcFwma2ew9D6C6RJOd7FLZZG6RqUtKcpG
EMW8+eHl7Pb4vAhY+qilksqRtHF2rI0BQBP/l7lm64/LI5inMvuuIOC4/SdjG5EM
uMJl40tB4zY4JbbuTzTOd73RnieURg+M6OexU4m0GENpCk7SZK9JMVdOnDjVfJQ7
X9RkdJVXlhs/LoqVS/Z+Qp2z284INkJrQDYiUW4bClvzwa5FnpcyaYn/zxtvyp/C
+idAXcvL2NMwTTxrjVC2WuanVokcIgxDUx4ZAQIDAQABAoH/Bue/GwtWn9Zs/uqs
MZ5t71uiC6ds376DM0kl5yFXfNB46JFNSIs1u6vQW78y316dHIrPzIsmLBjzQMEb
T8Uhf63dWPfmdchLq8dtUfLx9ixOiX8y+70i3dVa0yTX1b4mTXQHlyyCmATLwVCN
KdsZByzHj/obLm5QofpNYEy3unHy15jwSivm6m3rcJI5xqIbHUcSATtCtcjC1Xo0
ysP6xjGMirrAaM3J8NRiqPzaJefdeUVcojoNEzvx57X3cfBMEmNlXpVC9TyMa2rh
bwYYIaNTY/ArcmI7Qn+rPPb/NAGSKcn8e6DhkcjDWGep+BSVigCM3kHXJbxlENuH
rU5hAoGBAMrxztrWXpToiZydaMZ06HqRX3Qg9r+AlcI5SQeYbpkUUgZuLwP+Fhyt
DzyGLJkLCVcGyVH1k8N2VkPgKC3/xpF2+BQYvHDmVAzH5iCyty3B6295QY5lHLpL
OPUE4iLI4pFx+JAr1LayFIjOeZLEBrDXTcp4VSOEInn1KKt8M14hAoGBALu6UJwI
k1FhxF6IrJ6qytzbgeafmESwUnXuMaOAhmW9Ucn2/dSfRK0nMNrTxEy4TYQzjVoS
XGAeMEbQAHVQ1f4RgLesKlFEF3BSSFoIQo/vJ2aiPT6bspgF5SC3dMbFWj9+niO9
tQcp/EYo7W7cxO7842/9KuoT9G25mQP54J7hAoGBAJiHNNj01RFF1GeJRv4hT7kP
GZbGT62Ojv/y3hh/UGBtDVkX5u4xQZ071H/AuDQuP07RIu4ejHgTsLJC/u/TlQIv
UDSKgta3xeP1OdjJeTNC1BhsIgFLrVO2xZAho3RRVzfJWO/CgZTuMtC/nk/YVM8E
gsrxtcuDvAW9ZFu+dT0BAoGAWWzoh1uiaasL8whiSncLiefa2nR+AYKI1XqxFLTd
0Ms9kdrhkY6JFX7MzAECypUk/+va0uRaMsNOtfzRqxDlz1ChI12VDv9DtxLLOnAi
3RPMjhyM1i0vBzIPsuURcLqEQijbxiTRfmcmsHlAmYX7HelDoo5UCguVbUtzM6yt
rqECgYACq5tHkqxjJ5yETBjTJU7zzMfUBqQcSelPtnc6A4Hi/qelQyMxmlBe2yJG
SJmgNTq7HjYWSZaZH+6GgXjwT+CVs2zO+Cbj/gVwfRmvht/4wLUiOw0SsT2vFIvo
1qj9Hz//0DLjKTWzEcgIr0CQDJCi7acFDepG5/63MF9qCWgL4w==
-----END RSA PRIVATE KEY-----
`;
const SAMPLE_EC = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIK0/25lCRaulmtdU+IqOmOLTd9rqUgq/gXG0guyg/ryhoAoGCCqGSM49
AwEHoUQDQgAEVfhamVK4bXlx9ZfNVAqS2Y3MpPkQ0g3RKaOhSRREnr34baOYzCTh
jxmc0APAmh8bod2bfo3ZTcjP24KbF7v3PQ==
-----END EC PRIVATE KEY-----
`;
const SAMPLE_SSH = `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOrZVj0S6k8iazLUwtiTz+7qorJ2a2uqBOqRy+IC5LHr me@laptop
`;
const SAMPLE_ENC = `# password: demo
-----BEGIN ENCRYPTED PRIVATE KEY-----
MIHtMFgGCSqGSIb3DQEFDTBLMCoGCSqGSIb3DQEFDDAdBAhqiy8+2XHPvQIDAYag
MAwGCCqGSIb3DQIJBQAwHQYJYIZIAWUDBAEqBBC/gSUpOAMyVkVIi76o/icBBIGQ
NhxhrPuOiXrJ1oYoy4lvmzn81tlBTx/yKabs+CAK+C3NSFRIaRbps5man6SmiZ2h
JEO/Y4kQ4+e4De0QMj8vhhj+kttBrdFGspClHx6IfwvN3fuqQjIqGgqKb6mYPh19
+ld89hc6VrIHTWNGqD3nscCPD0IsBCWKg1ZN8RBK29gfB2Ql0JFwX4A08LhsPWXe
-----END ENCRYPTED PRIVATE KEY-----
`;
const SAMPLE_MANGLED = `-----BEGIN EC PRIVATE KEY----- MHcCAQEEIK0/25lCRaulmtdU+IqOmOLTd9rqUgq/gXG0guyg/ryhoAoGCCqGSM49 AwEHoUQDQgAEVfhamVK4bXlx9ZfNVAqS2Y3MpPkQ0g3RKaOhSRREnr34baOYzCTh jxmc0APAmh8bod2bfo3ZTcjP24KbF7v3PQ== -----END EC PRIVATE KEY-----
`;
const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIB7DCCAZOgAwIBAgIUD8x3YAjNJ0C0KMHD/u+MbRu4HdcwCgYIKoZIzj0EAwIw
PjELMAkGA1UEBhMCVVMxFTATBgNVBAoMDEV4YW1wbGUgQ29ycDEYMBYGA1UEAwwP
YXBwLmV4YW1wbGUuY29tMB4XDTI2MTAwMzA0Mjg0M1oXDTQ2MDkyODA0Mjg0M1ow
PjELMAkGA1UEBhMCVVMxFTATBgNVBAoMDEV4YW1wbGUgQ29ycDEYMBYGA1UEAwwP
YXBwLmV4YW1wbGUuY29tMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAExTHs8eeG
G4N1FZP99vKRiDseoqDxoWyjFWfRVZCqBg7Br9/vHMTWgFJjA/jPEGL/jhRwOhW7
Ellj1I9tMK2Az6NvMG0wHQYDVR0OBBYEFLbQkZjXlErWdz2eKfp9zj/y62ddMB8G
A1UdIwQYMBaAFLbQkZjXlErWdz2eKfp9zj/y62ddMA8GA1UdEwEB/wQFMAMBAf8w
GgYDVR0RBBMwEYIPYXBwLmV4YW1wbGUuY29tMAoGCCqGSM49BAMCA0cAMEQCIFjT
G5jzQP5AC9Bfv9uMCztWcBR+ecLwzdqGX1QmETk3AiAssPz0Ft+MJknae8yY1WXW
VcWCTcOWcccELHbodGusGg==
-----END CERTIFICATE-----
`;
const SAMPLE_KEY_A = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgJUMf4ZlTqKVJFGuI
gpYbjZZvjPB8IrgFvUISTiHa31OhRANCAATFMezx54Ybg3UVk/328pGIOx6ioPGh
bKMVZ9FVkKoGDsGv3+8cxNaAUmMD+M8QYv+OFHA6FbsSWWPUj20wrYDP
-----END PRIVATE KEY-----
`;
const SAMPLE_CSR = `-----BEGIN CERTIFICATE REQUEST-----
MIIBJjCBzQIBADA+MQswCQYDVQQGEwJVUzEVMBMGA1UECgwMRXhhbXBsZSBDb3Jw
MRgwFgYDVQQDDA9hcHAuZXhhbXBsZS5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMB
BwNCAATFMezx54Ybg3UVk/328pGIOx6ioPGhbKMVZ9FVkKoGDsGv3+8cxNaAUmMD
+M8QYv+OFHA6FbsSWWPUj20wrYDPoC0wKwYJKoZIhvcNAQkOMR4wHDAaBgNVHREE
EzARgg9hcHAuZXhhbXBsZS5jb20wCgYIKoZIzj0EAwIDSAAwRQIgLb9wRlJejDfA
K1Jd1/D9uUuPOlUUFGxMS2tjvffyfogCIQCSidKnqQ3pqNQ2PzXclPRagaVU6SSu
ka1g9zY0Um0F0g==
-----END CERTIFICATE REQUEST-----
`;
const SAMPLE_KEY_B = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg6aV40iA0lWGdozxc
DXmWCOV/wU0sZuu9xsA7sBGjO0ihRANCAASxskd44bJvO7Fn7uBEMcndtu2s6rH8
fxfQkyk0+lrz/F5J8jR4sAgeud6QZAx64Pm7YZJEGLAWmdPYmNZmiFtL
-----END PRIVATE KEY-----
`;

type ParseState =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; data: ParseResult };

function parseSource(text: string, file: { name: string; bytes: Uint8Array } | null): ParseState {
  if (!file && !text.trim()) return { status: 'empty' };
  try {
    return { status: 'ok', data: file ? parseInputBytes(file.bytes) : parseInput(text) };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

const GROUPS: { id: OutputBlock['group']; title: string; hint: string }[] = [
  { id: 'private', title: 'Private key formats', hint: 'Handle with care - never share a private key.' },
  { id: 'public', title: 'Public key formats', hint: 'Safe to share.' },
  { id: 'encodings', title: 'Other encodings', hint: 'Base64, JWK and certificate/CSR re-encodings.' },
];

function OutputCard({ o }: { o: OutputBlock }) {
  return (
    <Panel>
      <PanelHeader title={o.title} className="h-auto min-h-9 flex-wrap py-1">
        <CopyButton value={o.text} />
        <DownloadButton data={o.text} filename={o.filename} mime={o.mime} label="Download" />
        {o.der && o.derFilename && (
          <DownloadButton data={() => o.der as Uint8Array} filename={o.derFilename} label=".der" />
        )}
      </PanelHeader>
      {o.subtitle && <p className="border-b px-3 py-1 text-2xs text-muted-foreground">{o.subtitle}</p>}
      <pre className={cn('max-h-52 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs', o.id.startsWith('b64') && 'max-h-28')}>{o.text.trimEnd()}</pre>
      {o.command && (
        <div className="flex items-start gap-2 border-t bg-muted/30 px-3 py-1.5">
          <span className="mt-0.5 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">openssl</span>
          <code className="min-w-0 flex-1 break-all font-mono text-2xs text-muted-foreground">{o.command}</code>
          <CopyButton value={o.command} size="icon-sm" label="Copy command" className="size-5 shrink-0" />
        </div>
      )}
    </Panel>
  );
}

function ConverterTab() {
  const [text, setText] = useState(SAMPLE_EC);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [blockIdx, setBlockIdx] = useState(0);
  const [pwInput, setPwInput] = useState('');
  const [appliedPw, setAppliedPw] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const parsed = useMemo(() => parseSource(text, file), [text, file]);
  const items = useMemo<ParsedItem[]>(() => (parsed.status === 'ok' ? parsed.data.items : []), [parsed]);
  const idx = Math.min(blockIdx, Math.max(0, items.length - 1));
  const item = items[idx] ?? null;

  useEffect(() => {
    setPwInput('');
    setAppliedPw('');
  }, [text, file, idx]);

  useEffect(() => {
    let cancelled = false;
    if (!item) {
      setAnalysis(null);
      setAnalysisError(null);
      return;
    }
    setBusy(true);
    setAnalysisError(null);
    analyzeItem(item, appliedPw)
      .then((a) => {
        if (!cancelled) {
          setAnalysis(a);
          setBusy(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setAnalysis(null);
          setAnalysisError(e instanceof Error ? e.message : String(e));
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [item, appliedPw]);

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setFileError(`${f.name} is ${formatBytes(f.size)} - key files over 5 MB are not supported.`);
      return;
    }
    setFileError(null);
    setFile({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    setBlockIdx(0);
  }, []);

  const load = (t: string) => {
    setFileError(null);
    setFile(null);
    setText(t);
    setBlockIdx(0);
  };

  const cleaned = useMemo(() => items.map((it) => normalizedPem(it)).join('\n'), [items]);
  const anyRepairs = items.some((it) => it.repairs.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Input">
          <Button variant="ghost" size="sm" onClick={() => load('')}>
            <Trash2 className="size-3.5" /> Clear
          </Button>
        </PanelHeader>
        <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Samples</span>
          <Button variant="outline" size="sm" onClick={() => load(SAMPLE_RSA)}>RSA key</Button>
          <Button variant="outline" size="sm" onClick={() => load(SAMPLE_EC)}>EC key</Button>
          <Button variant="outline" size="sm" onClick={() => load(SAMPLE_SSH)}>ssh-ed25519</Button>
          <Button variant="outline" size="sm" onClick={() => load(SAMPLE_ENC)}>Encrypted</Button>
          <Button variant="outline" size="sm" onClick={() => load(SAMPLE_MANGLED)}>Mangled paste</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[minmax(0,1fr)_240px]">
          <Textarea
            value={file ? '' : text}
            onChange={(e) => {
              setFile(null);
              setText(e.target.value);
              setBlockIdx(0);
            }}
            placeholder={file ? `Loaded file: ${file.name}` : 'Paste a PEM key / certificate / CSR, raw Base64 or hex, a JWK (JSON), or an OpenSSH public key line (ssh-rsa, ecdsa-sha2-nistp256, ssh-ed25519...)'}
            spellCheck={false}
            className="max-h-60 min-h-36 resize-y font-mono text-xs"
          />
          <FileDropzone
            onFiles={onFiles}
            accept=".pem,.key,.pub,.der,.crt,.cer,.csr,.txt,.p8,.openssh,.json,.jwk"
            label={file ? file.name : 'Drop a key file'}
            hint={file ? `${formatBytes(file.bytes.length)} - click to replace` : '.pem .key .pub .der .crt .csr'}
            compact
          />
        </div>
        <StatBar
          items={[
            parsed.status === 'ok' && `input: ${parsed.data.sourceFormat === 'openssh' ? 'OpenSSH' : parsed.data.sourceFormat.toUpperCase()}`,
            parsed.status === 'ok' && `${items.length} block${items.length === 1 ? '' : 's'}`,
            item && FORMAT_LABELS[item.format],
            'runs locally - nothing is uploaded',
          ]}
        />
      </Panel>

      {parsed.status === 'error' && <ErrorBanner error={parsed.message} />}
      <ErrorBanner error={fileError} />
      {parsed.status === 'ok' && parsed.data.warnings.map((w) => (
        <p key={w} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">{w}</p>
      ))}

      {items.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Block</span>
          {items.map((it, i) => (
            <Button key={i} size="sm" variant={i === idx ? 'secondary' : 'outline'} onClick={() => setBlockIdx(i)}>
              {i + 1}. {FORMAT_LABELS[it.format]}
            </Button>
          ))}
        </div>
      )}

      {items.length > 0 && (anyRepairs || items.length > 1) && (
        <Panel>
          <PanelHeader title={items.length > 1 ? `Clean bundle (${items.length} blocks)` : 'Cleaned PEM'} className="h-auto min-h-9 flex-wrap py-1">
            <CopyButton value={cleaned} />
            <DownloadButton data={cleaned} filename="cleaned.pem" />
            {items.length > 1 && (
              <DownloadButton
                label="Split .zip"
                data={() =>
                  zipFiles(
                    items.map((it, i) => ({
                      name: `${String(i + 1).padStart(2, '0')}-${it.format}.${it.format === 'openssh-public' ? 'pub' : it.format === 'jwk' ? 'json' : 'pem'}`,
                      data: utf8Encode(normalizedPem(it)),
                    }))
                  )
                }
                filename="blocks.zip"
              />
            )}
          </PanelHeader>
          {items.flatMap((it, i) => it.repairs.map((r) => ({ r, i }))).length > 0 && (
            <ul className="space-y-0.5 border-b px-3 py-2 text-xs text-muted-foreground">
              {items.flatMap((it, i) => it.repairs.map((r) => ({ r, i }))).map(({ r, i }, k) => (
                <li key={k}>
                  {items.length > 1 ? `Block ${i + 1}: ` : ''}
                  {r}
                </li>
              ))}
            </ul>
          )}
          <pre className="max-h-48 overflow-auto whitespace-pre p-3 font-mono text-xs">{cleaned.trimEnd()}</pre>
          <div className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
            Normalised: LF line endings, Base64 wrapped at 64 characters, correct BEGIN/END lines. Each block is also converted below.
          </div>
        </Panel>
      )}

      {item && analysis && (
        <>
          <Panel>
            <PanelHeader title={analysis.title} />
            <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0">
              {analysis.rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 px-3 py-1 text-xs sm:border-b">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="break-all font-mono">{r.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          {analysis.needsPassword && (
            <Panel>
              <PanelHeader title="Password required" />
              <form
                className="flex flex-wrap items-end gap-3 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAppliedPw(pwInput);
                }}
              >
                <Field label="Password" className="min-w-[220px] flex-1">
                  <Input type="password" autoComplete="off" value={pwInput} onChange={(e) => setPwInput(e.target.value)} placeholder="Key password" />
                </Field>
                <Button type="submit" size="sm" disabled={busy || !pwInput}>
                  <KeyRound className="size-3.5" /> Decrypt locally
                </Button>
              </form>
              <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">
                Supports PBES2 (PBKDF2 + AES-128/192/256-CBC) and legacy &quot;Proc-Type: 4,ENCRYPTED&quot; AES-CBC keys. 3DES / DES / scrypt keys cannot be decrypted by WebCrypto.
                The password never leaves this page.
              </p>
            </Panel>
          )}

          {analysis.notes.map((n) => (
            <p key={n} className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">{n}</p>
          ))}

          {GROUPS.map((g) => {
            const list = analysis.outputs.filter((o) => o.group === g.id);
            if (list.length === 0) return null;
            return (
              <section key={g.id} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{g.title}</h3>
                  <span className="text-2xs text-muted-foreground">{g.hint}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {list.map((o) => (
                    <OutputCard key={o.id} o={o} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
      {busy && <p className="text-xs text-muted-foreground">Working...</p>}
      <ErrorBanner error={analysisError} />
    </div>
  );
}

interface SlotDef {
  id: 'cert' | 'key' | 'csr';
  title: string;
  placeholder: string;
  cmd: string;
}

const SLOTS: SlotDef[] = [
  { id: 'cert', title: 'Certificate', placeholder: '-----BEGIN CERTIFICATE-----', cmd: 'openssl x509 -noout -modulus -in cert.pem | openssl md5' },
  { id: 'key', title: 'Private key', placeholder: '-----BEGIN PRIVATE KEY----- / RSA / EC / encrypted', cmd: 'openssl rsa -noout -modulus -in key.pem | openssl md5' },
  { id: 'csr', title: 'CSR', placeholder: '-----BEGIN CERTIFICATE REQUEST-----', cmd: 'openssl req -noout -modulus -in csr.pem | openssl md5' },
];

type SlotResult =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; fp: KeyFingerprint; note?: string };

async function computeSlot(text: string, password: string): Promise<SlotResult> {
  if (!text.trim()) return { status: 'empty' };
  try {
    const parsed = parseInput(text);
    const it = parsed.items[0];
    if (!it) return { status: 'error', message: 'Nothing to read.' };
    const fp = await fingerprintItem(it, password);
    return { status: 'ok', fp, note: parsed.items.length > 1 ? `${parsed.items.length} blocks pasted - using the first` : undefined };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

function MatcherTab() {
  const [texts, setTexts] = useState<Record<SlotDef['id'], string>>({ cert: SAMPLE_CERT, key: SAMPLE_KEY_A, csr: SAMPLE_CSR });
  const [password, setPassword] = useState('');
  const [results, setResults] = useState<Record<SlotDef['id'], SlotResult>>({ cert: { status: 'empty' }, key: { status: 'empty' }, csr: { status: 'empty' } });

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      Promise.all(SLOTS.map((s) => computeSlot(texts[s.id], password))).then(([cert, key, csr]) => {
        if (!cancelled && cert && key && csr) setResults({ cert, key, csr });
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [texts, password]);

  const present = SLOTS.filter((s) => results[s.id].status === 'ok');
  const pairs: { a: SlotDef; b: SlotDef; match: boolean }[] = [];
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const a = present[i];
      const b = present[j];
      const ra = a ? results[a.id] : undefined;
      const rb = b ? results[b.id] : undefined;
      if (a && b && ra?.status === 'ok' && rb?.status === 'ok') pairs.push({ a, b, match: ra.fp.sha256 === rb.fp.sha256 });
    }
  }
  const allMatch = pairs.length > 0 && pairs.every((p) => p.match);
  const needsPw = SLOTS.some((s) => {
    const r = results[s.id];
    return r.status === 'error' && /password|encrypted/i.test(r.message);
  });

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Button variant="outline" size="sm" onClick={() => setTexts({ cert: SAMPLE_CERT, key: SAMPLE_KEY_A, csr: SAMPLE_CSR })}>Matching sample</Button>
        <Button variant="outline" size="sm" onClick={() => setTexts({ cert: SAMPLE_CERT, key: SAMPLE_KEY_B, csr: SAMPLE_CSR })}>Mismatching sample</Button>
        <Button variant="outline" size="sm" onClick={() => setTexts({ cert: '', key: '', csr: '' })}>
          <Trash2 className="size-3.5" /> Clear
        </Button>
        <Field label="Password (encrypted private key)" className="min-w-[220px] flex-1">
          <Input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={needsPw ? 'Required for the encrypted key' : 'Optional'} />
        </Field>
      </OptionsBar>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {SLOTS.map((s) => {
          const r = results[s.id];
          return (
            <Panel key={s.id}>
              <PanelHeader title={s.title} className="h-auto min-h-9 flex-wrap py-1">
                {r.status === 'ok' && <Badge variant="muted">{FORMAT_LABELS[r.fp.format]}</Badge>}
              </PanelHeader>
              <Textarea
                value={texts[s.id]}
                onChange={(e) => setTexts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                placeholder={s.placeholder}
                spellCheck={false}
                className="max-h-44 min-h-28 resize-y rounded-none border-0 border-b font-mono text-2xs shadow-none"
              />
              <div className="space-y-1 p-3 text-xs">
                {r.status === 'empty' && <p className="text-muted-foreground">Paste a {s.title.toLowerCase()} (optional).</p>}
                {r.status === 'error' && <p className="break-words text-destructive">{r.message}</p>}
                {r.status === 'ok' && (
                  <>
                    <p className="font-medium">{r.fp.description}</p>
                    <p className="text-2xs uppercase tracking-wide text-muted-foreground">SPKI SHA-256</p>
                    <p className="break-all font-mono text-2xs">{r.fp.sha256}</p>
                    {r.fp.modulusMd5 && (
                      <>
                        <p className="pt-1 text-2xs uppercase tracking-wide text-muted-foreground">RSA modulus MD5</p>
                        <p className="break-all font-mono text-2xs">{r.fp.modulusMd5}</p>
                        <p className="text-2xs text-muted-foreground">same as: <code className="font-mono">{s.cmd}</code></p>
                      </>
                    )}
                    {r.note && <p className="text-2xs text-warning">{r.note}</p>}
                  </>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel>
        <PanelHeader title="Comparison" />
        {pairs.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">Provide at least two of the three items to compare their public keys.</p>
        ) : (
          <div className="divide-y">
            <div className={cn('flex items-center gap-2 px-3 py-2 text-sm font-medium', allMatch ? 'text-success' : 'text-destructive')}>
              {allMatch ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {allMatch ? 'All provided items share the same public key.' : 'These items do NOT all belong together.'}
            </div>
            {pairs.map((p) => (
              <div key={`${p.a.id}-${p.b.id}`} className="flex items-center gap-3 px-3 py-2 text-xs">
                {p.match ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-destructive" />}
                <span className="w-44 shrink-0 font-medium">
                  {p.a.title} vs {p.b.title}
                </span>
                <span className={p.match ? 'text-success' : 'text-destructive'}>{p.match ? 'Match' : 'Mismatch'}</span>
              </div>
            ))}
          </div>
        )}
        <p className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
          A certificate, CSR and private key belong together when the SHA-256 of their SubjectPublicKeyInfo is identical. Private keys are never uploaded; for private keys the
          public half is derived locally.
        </p>
      </Panel>
    </div>
  );
}

export default function PemKeyConverterTool() {
  return (
    <Tabs defaultValue="convert">
      <TabsList>
        <TabsTrigger value="convert">Converter</TabsTrigger>
        <TabsTrigger value="match">Key matcher</TabsTrigger>
      </TabsList>
      <TabsContent value="convert">
        <ConverterTab />
      </TabsContent>
      <TabsContent value="match">
        <MatcherTab />
      </TabsContent>
    </Tabs>
  );
}
