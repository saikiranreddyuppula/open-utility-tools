'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileKey, Loader2, ShieldAlert, Sparkles } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { zipFiles } from '@/lib/zip';
import {
  defaultEku,
  ed25519Supported,
  EKU_KEYS,
  generate,
  KEY_TYPE_LABELS,
  utf8Encode,
  validateOptions,
  type EkuKey,
  type GenerationResult,
  type GenOptions,
  type HashAlg,
  type KeyType,
  type Mode,
  type Profile,
} from './logic';

interface Form {
  mode: Mode;
  profile: Profile;
  cn: string;
  o: string;
  ou: string;
  c: string;
  st: string;
  l: string;
  sans: string;
  addCnToSan: boolean;
  days: string;
  keyType: KeyType;
  hash: HashAlg;
  pathLen: string;
  eku: EkuKey[];
  caCn: string;
  caDays: string;
}

const DEFAULT_FORM: Form = {
  mode: 'self-signed',
  profile: 'tls-server',
  cn: 'localhost',
  o: 'Local Development',
  ou: '',
  c: '',
  st: '',
  l: '',
  sans: 'localhost\n127.0.0.1\n::1',
  addCnToSan: true,
  days: '365',
  keyType: 'ec-p256',
  hash: 'SHA-256',
  pathLen: '',
  eku: ['serverAuth'],
  caCn: 'Local Development Root CA',
  caDays: '3650',
};

const KEY_ORDER: KeyType[] = ['ec-p256', 'ec-p384', 'ec-p521', 'rsa-2048', 'rsa-3072', 'rsa-4096', 'ed25519'];

const PROFILES: { id: Profile; label: string; hint: string }[] = [
  { id: 'tls-server', label: 'TLS server', hint: 'serverAuth - HTTPS sites, APIs, local dev servers' },
  { id: 'tls-client', label: 'TLS client', hint: 'clientAuth - mutual TLS, VPN/device identity' },
  { id: 'ca', label: 'Certificate authority', hint: 'CA:TRUE, keyCertSign + cRLSign' },
  { id: 'code-signing', label: 'Code signing', hint: 'codeSigning - signing binaries / scripts' },
];

const EKU_LABELS: Record<EkuKey, string> = {
  serverAuth: 'Server auth',
  clientAuth: 'Client auth',
  codeSigning: 'Code signing',
  emailProtection: 'E-mail (S/MIME)',
};

function toOptions(f: Form): GenOptions {
  const pl = f.pathLen.trim();
  return {
    mode: f.mode,
    profile: f.profile,
    dn: { cn: f.cn, o: f.o, ou: f.ou, c: f.c, st: f.st, l: f.l },
    sans: f.sans.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
    addCnToSan: f.addCnToSan,
    days: f.days.trim() === '' ? Number.NaN : Number(f.days),
    keyType: f.keyType,
    hash: f.hash,
    pathLen: pl === '' ? null : Number(pl),
    eku: f.eku,
    caCn: f.caCn,
    caDays: f.caDays.trim() === '' ? Number.NaN : Number(f.caDays),
  };
}

function FileCard({ f }: { f: GenerationResult['files'][number] }) {
  const secret = f.kind === 'private-key';
  return (
    <Panel>
      <PanelHeader title={f.title} className="h-auto min-h-9 flex-wrap py-1">
        {secret && <Badge variant="destructive">secret</Badge>}
        <CopyButton value={f.pem} />
        <DownloadButton data={f.pem} filename={f.name} mime="application/x-pem-file" label="Download" />
        {f.der && f.kind !== 'chain' && (
          <DownloadButton
            data={() => f.der as Uint8Array}
            filename={f.name.replace(/\.pem$/, '.der')}
            label=".der"
          />
        )}
      </PanelHeader>
      <p className="border-b px-3 py-1 text-2xs text-muted-foreground">{f.description}</p>
      <pre className="max-h-44 overflow-auto whitespace-pre p-3 font-mono text-xs">{f.pem.trimEnd()}</pre>
    </Panel>
  );
}

export default function SelfSignedGeneratorTool() {
  const [form, setForm] = useState<Form>(DEFAULT_FORM);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [resultKey, setResultKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edOk, setEdOk] = useState(true);
  const runId = useRef(0);

  const opts = useMemo(() => toOptions(form), [form]);
  const optsKey = useMemo(() => JSON.stringify(opts), [opts]);
  const validation = useMemo(() => validateOptions(opts), [opts]);
  const stale = result !== null && resultKey !== optsKey;

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => setForm((prev) => ({ ...prev, [key]: value })), []);

  useEffect(() => {
    let cancelled = false;
    ed25519Supported().then((ok) => {
      if (!cancelled) setEdOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (o: GenOptions) => {
    const id = ++runId.current;
    setBusy(true);
    setError(null);
    try {
      const r = await generate(o);
      if (id === runId.current) {
        setResult(r);
        setResultKey(JSON.stringify(o));
      }
    } catch (e) {
      if (id === runId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === runId.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run(toOptions(DEFAULT_FORM));
  }, [run]);

  const changeMode = (mode: Mode) => {
    setForm((prev) => {
      const next: Form = { ...prev, mode };
      if (mode === 'ca-leaf') {
        if (prev.profile === 'ca') {
          next.profile = 'tls-server';
          next.eku = defaultEku('tls-server');
        }
        if (prev.pathLen === '') next.pathLen = '0';
      }
      return next;
    });
  };

  const changeProfile = (profile: Profile) => {
    setForm((prev) => ({ ...prev, profile, eku: defaultEku(profile) }));
  };

  const toggleEku = (k: EkuKey, on: boolean) => {
    setForm((prev) => ({ ...prev, eku: on ? EKU_KEYS.filter((x) => x === k || prev.eku.includes(x)) : prev.eku.filter((x) => x !== k) }));
  };

  const isCaProfile = form.profile === 'ca';
  const showPathLen = isCaProfile || form.mode === 'ca-leaf';
  const slow = form.keyType === 'rsa-4096' || form.keyType === 'rsa-3072';
  const canRun = validation.errors.length === 0 && !busy;

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={form.mode} onValueChange={(v) => changeMode(v as Mode)}>
        <TabsList className="h-auto w-full flex-wrap sm:w-fit">
          <TabsTrigger value="self-signed">Self-signed certificate</TabsTrigger>
          <TabsTrigger value="csr">CSR + private key</TabsTrigger>
          <TabsTrigger value="ca-leaf">Local CA + signed leaf</TabsTrigger>
        </TabsList>
      </Tabs>

      <OptionsBar className="items-start">
        <Field label="Common Name (CN)" className="min-w-[200px] flex-1" hint={form.mode === 'ca-leaf' ? 'Host name of the leaf certificate' : undefined}>
          <Input value={form.cn} onChange={(e) => set('cn', e.target.value)} placeholder="example.com" spellCheck={false} />
        </Field>
        <Field label="Organization (O)" className="min-w-[160px] flex-1">
          <Input value={form.o} onChange={(e) => set('o', e.target.value)} placeholder="Example Inc." />
        </Field>
        <Field label="Org. unit (OU)" className="min-w-[120px] flex-1">
          <Input value={form.ou} onChange={(e) => set('ou', e.target.value)} />
        </Field>
        <Field label="Country (C)" className="w-24">
          <Input value={form.c} onChange={(e) => set('c', e.target.value.toUpperCase().slice(0, 2))} placeholder="US" maxLength={2} className="font-mono uppercase" />
        </Field>
        <Field label="State (ST)" className="min-w-[120px] flex-1">
          <Input value={form.st} onChange={(e) => set('st', e.target.value)} />
        </Field>
        <Field label="Locality (L)" className="min-w-[120px] flex-1">
          <Input value={form.l} onChange={(e) => set('l', e.target.value)} />
        </Field>
      </OptionsBar>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Subject Alternative Names" className="h-auto min-h-9 flex-wrap py-1">
            {!isCaProfile && (
              <label className="flex items-center gap-2 px-1 text-2xs text-muted-foreground">
                <Switch checked={form.addCnToSan} onCheckedChange={(v) => set('addCnToSan', v)} /> add CN as SAN
              </label>
            )}
          </PanelHeader>
          <Textarea
            value={form.sans}
            onChange={(e) => set('sans', e.target.value)}
            spellCheck={false}
            placeholder={'example.com\n*.example.com\n192.168.1.10\n::1\nadmin@example.com'}
            className="max-h-48 min-h-28 resize-y rounded-none border-0 font-mono text-xs shadow-none"
          />
          <p className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
            One per line (or comma-separated): DNS names incl. wildcards (*.example.com), IPv4/IPv6 addresses, e-mail addresses, URIs. Non-ASCII names are converted to punycode.
          </p>
        </Panel>

        <div className="flex flex-col gap-3">
          <OptionsBar>
            <Field label="Profile" className="min-w-[190px] flex-1" hint={PROFILES.find((p) => p.id === form.profile)?.hint}>
              <Select value={form.profile} onValueChange={(v) => changeProfile(v as Profile)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILES.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={p.id === 'ca' && form.mode === 'ca-leaf'}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Key type" className="min-w-[150px] flex-1">
              <Select value={form.keyType} onValueChange={(v) => set('keyType', v as KeyType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KEY_ORDER.map((k) => (
                    <SelectItem key={k} value={k} disabled={k === 'ed25519' && !edOk}>
                      {KEY_TYPE_LABELS[k]}
                      {k === 'ed25519' && !edOk ? ' (unsupported here)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Signature hash" className="min-w-[110px]">
              <Select value={form.hash} onValueChange={(v) => set('hash', v as HashAlg)} disabled={form.keyType === 'ed25519'}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHA-256">SHA-256</SelectItem>
                  <SelectItem value="SHA-384">SHA-384</SelectItem>
                  <SelectItem value="SHA-512">SHA-512</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.mode !== 'csr' && (
              <Field label="Valid for (days)" className="w-32">
                <Input type="number" inputMode="numeric" min={1} max={36500} value={form.days} onChange={(e) => set('days', e.target.value)} className="font-mono" />
              </Field>
            )}
            {form.mode === 'ca-leaf' && (
              <>
                <Field label="CA name (CN)" className="min-w-[180px] flex-1">
                  <Input value={form.caCn} onChange={(e) => set('caCn', e.target.value)} />
                </Field>
                <Field label="CA valid (days)" className="w-32">
                  <Input type="number" inputMode="numeric" min={1} max={36500} value={form.caDays} onChange={(e) => set('caDays', e.target.value)} className="font-mono" />
                </Field>
              </>
            )}
            {showPathLen && (
              <Field label="CA path length" className="w-32" hint="empty = unlimited">
                <Input type="number" inputMode="numeric" min={0} max={99} value={form.pathLen} onChange={(e) => set('pathLen', e.target.value)} className="font-mono" placeholder="none" />
              </Field>
            )}
          </OptionsBar>
          {!isCaProfile && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Extended key usage</span>
              {EKU_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <Checkbox id={`eku-${k}`} checked={form.eku.includes(k)} onCheckedChange={(c) => toggleEku(k, c === true)} />
                  <Label htmlFor={`eku-${k}`} className="text-xs font-normal">
                    {EKU_LABELS[k]}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {validation.errors.map((e) => (
        <ErrorBanner key={e} error={e} />
      ))}
      {validation.warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{w}</span>
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void run(opts)} disabled={!canRun} className="gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? 'Generating...' : form.mode === 'csr' ? 'Generate CSR + key' : form.mode === 'ca-leaf' ? 'Generate CA + certificate' : 'Generate certificate + key'}
        </Button>
        {busy && slow && <span className="text-xs text-muted-foreground">RSA key generation can take a few seconds.</span>}
        {stale && !busy && <span className="text-xs text-warning">Options changed - generate again to refresh the output.</span>}
        <span className="ml-auto text-2xs text-muted-foreground">Keys are generated with WebCrypto in your browser and never leave this page.</span>
      </div>
      <ErrorBanner error={error} />

      {result && (
        <div className={stale ? 'space-y-3 opacity-60' : 'space-y-3'}>
          {result.trustNote && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{result.trustNote}</span>
            </div>
          )}

          <Panel>
            <PanelHeader title="Generated files" className="h-auto min-h-9 flex-wrap py-1">
              <DownloadButton
                label="Download all (.zip)"
                variant="secondary"
                filename={result.mode === 'ca-leaf' ? 'local-ca-bundle.zip' : result.mode === 'csr' ? 'csr-bundle.zip' : 'self-signed-bundle.zip'}
                data={() => zipFiles(result.files.map((f) => ({ name: f.name, data: utf8Encode(f.pem) })))}
              />
            </PanelHeader>
            <div className="flex flex-wrap items-center gap-2 p-3">
              {result.files.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 font-mono text-2xs">
                  <FileKey className="size-3" /> {f.name}
                </span>
              ))}
            </div>
            <StatBar items={[`${result.files.length} files`, `generated in ${result.elapsedMs} ms`, 'PEM / PKCS#8']} />
          </Panel>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {result.files.map((f) => (
              <FileCard key={f.id} f={f} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {result.summaries.map((s) => (
              <Panel key={s.title}>
                <PanelHeader title={`${s.title} - decoded`} />
                <div className="divide-y">
                  {s.rows.map((r, i) => (
                    <div key={`${r.label}-${i}`} className="grid grid-cols-1 gap-0.5 px-3 py-1.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-3">
                      <span className="text-xs text-muted-foreground">{r.label}</span>
                      <span className="break-all font-mono text-xs">{r.value}</span>
                    </div>
                  ))}
                  {s.fingerprint && (
                    <div className="grid grid-cols-1 gap-0.5 px-3 py-1.5 sm:grid-cols-[170px_minmax(0,1fr)_auto] sm:gap-3">
                      <span className="text-xs text-muted-foreground">SHA-256 fingerprint</span>
                      <span className="break-all font-mono text-xs">{s.fingerprint}</span>
                      <CopyButton value={s.fingerprint} size="icon-sm" className="size-5" />
                    </div>
                  )}
                </div>
                <p className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">Read back from the DER that was just generated (signature verified in-browser).</p>
              </Panel>
            ))}
          </div>

          <Panel>
            <PanelHeader title="Equivalent openssl commands">
              <CopyButton value={result.commands} />
            </PanelHeader>
            <pre className="max-h-80 overflow-auto whitespace-pre p-3 font-mono text-xs">{result.commands}</pre>
          </Panel>
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        Everything is generated locally: keys via WebCrypto, certificates and CSRs assembled as DER in this page. Self-signed and locally-issued certificates are for development,
        testing and private networks - public websites need a certificate from a publicly trusted CA (e.g. Let&apos;s Encrypt). Store private keys safely and never commit them.
      </p>
    </div>
  );
}
