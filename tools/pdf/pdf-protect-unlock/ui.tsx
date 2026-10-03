'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Dices, Eye, EyeOff, Info, Loader2, Lock, LockOpen, ShieldCheck, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { decryptPdf, encryptPdf, isEncrypted, pageCount, PDF_PERMISSION } from '@/lib/wasm/pdf';
import { formatBytes } from '@/lib/download';
import { cn } from '@/lib/utils';
import { generatePassword, passwordProblem, passwordStrength, passwordWarning } from './logic';

const MAX_FILE_BYTES = 300 * 1024 * 1024;

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const baseName = (name: string): string => name.replace(/\.pdf$/i, '') || 'document';

function isPdf(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

/** Uniform random integer in [0, max) from the Web Crypto RNG (rejection sampling, no modulo bias). */
function randomInt(max: number): number {
  const wc = (globalThis as unknown as { crypto: Crypto }).crypto;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let x = 0;
  do {
    wc.getRandomValues(buf);
    x = buf[0] ?? 0;
  } while (x >= limit);
  return x % max;
}

function wrongPassword(e: unknown): string {
  const detail = errMsg(e).trim();
  const tail = detail && detail.length < 160 ? ` (${detail})` : '';
  return `That password didn't work — check it and try again; passwords are case-sensitive.${tail}`;
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function PasswordInput({
  value,
  onChange,
  show,
  label,
  autoComplete,
  invalid,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  label: string;
  autoComplete: string;
  invalid?: boolean;
  onEnter?: () => void;
}) {
  return (
    <Input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
      autoComplete={autoComplete}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      aria-label={label}
      aria-invalid={invalid}
      className="font-mono"
    />
  );
}

function StrengthMeter({ password }: { password: string }) {
  const s = passwordStrength(password);
  const filled = password ? Math.max(1, s.score) : 0;
  const color = s.score <= 1 ? 'bg-destructive' : s.score === 2 ? 'bg-warning' : 'bg-success';
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= filled ? color : 'bg-muted')} />
        ))}
      </div>
      <span className="w-16 text-right font-mono text-2xs text-muted-foreground" data-testid="strength-label">
        {password ? s.label : ''}
      </span>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  const Icon = tone === 'warn' ? TriangleAlert : Info;
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
        tone === 'warn' ? 'border-warning/50 bg-warning/10' : 'bg-muted/30'
      )}
    >
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', tone === 'warn' ? 'text-warning' : 'text-muted-foreground')} />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Protect                                                             */
/* ------------------------------------------------------------------ */

const PERMS = [
  { key: 'print', label: 'Allow printing', hint: 'Print the document', flag: PDF_PERMISSION.print },
  {
    key: 'printHighQuality',
    label: 'High-quality printing',
    hint: 'Needs printing; otherwise prints are limited to low resolution',
    flag: PDF_PERMISSION.printHighQuality,
  },
  { key: 'copy', label: 'Copying text & images', hint: 'Select and copy content', flag: PDF_PERMISSION.copy },
  { key: 'modify', label: 'Editing', hint: 'Change the document content', flag: PDF_PERMISSION.modify },
  { key: 'annotate', label: 'Annotations', hint: 'Add comments and highlights', flag: PDF_PERMISSION.annotate },
  { key: 'fillForms', label: 'Form filling', hint: 'Fill in existing form fields', flag: PDF_PERMISSION.fillForms },
  {
    key: 'assemble',
    label: 'Page assembly',
    hint: 'Insert, delete and rotate pages',
    flag: PDF_PERMISSION.assemble,
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    hint: 'Let screen readers read the text — recommended',
    flag: PDF_PERMISSION.accessibility,
  },
] as const;

type PermKey = (typeof PERMS)[number]['key'];
type PermState = Record<PermKey, boolean>;

const ALL_ALLOWED: PermState = {
  print: true,
  printHighQuality: true,
  copy: true,
  modify: true,
  annotate: true,
  fillForms: true,
  assemble: true,
  accessibility: true,
};

const READ_ONLY: PermState = {
  print: false,
  printHighQuality: false,
  copy: false,
  modify: false,
  annotate: false,
  fillForms: false,
  assemble: false,
  accessibility: true,
};

interface ProtectedResult {
  bytes: Uint8Array;
  name: string;
  verified: boolean;
  verifyText: string;
  summary: string[];
}

interface FileInfo {
  name: string;
  size: number;
  pages: number | null;
}

function ProtectPane() {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [alreadyEncrypted, setAlreadyEncrypted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userPw, setUserPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [ownerPw, setOwnerPw] = useState('');
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<'aes256' | 'aes128'>('aes256');
  const [perms, setPerms] = useState<PermState>(ALL_ALLOWED);
  const [result, setResult] = useState<ProtectedResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const aes256 = mode === 'aes256';

  const onFiles = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const my = ++seq.current;
    setLoading(true);
    setError(null);
    setResult(null);
    setAlreadyEncrypted(false);
    setInfo(null);
    setBytes(null);
    try {
      if (!isPdf(f)) throw new Error('Please choose a PDF file.');
      if (f.size > MAX_FILE_BYTES) {
        throw new Error(`File is too large (${formatBytes(f.size)}). Limit is ${formatBytes(MAX_FILE_BYTES)}.`);
      }
      const data = new Uint8Array(await f.arrayBuffer());
      let enc = false;
      try {
        enc = await isEncrypted(data.slice());
      } catch {
        enc = false;
      }
      let pages: number | null = null;
      if (!enc) pages = await pageCount(data.slice());
      if (my !== seq.current) return;
      setBytes(data);
      setAlreadyEncrypted(enc);
      setInfo({ name: f.name, size: f.size, pages });
    } catch (e) {
      if (my === seq.current) setError(errMsg(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  const permBits = useMemo(() => {
    let bits = 0;
    for (const p of PERMS) {
      if (!perms[p.key]) continue;
      if (p.key === 'printHighQuality' && !perms.print) continue;
      bits |= p.flag;
    }
    return bits;
  }, [perms]);

  const restricted = PERMS.filter((p) => !perms[p.key] || (p.key === 'printHighQuality' && !perms.print));
  const hasRestriction = restricted.length > 0;

  const mismatch = userPw !== '' && confirmPw !== '' && userPw !== confirmPw;
  const problemUser = passwordProblem(userPw, aes256, 'The open password');
  const problemOwner = passwordProblem(ownerPw, aes256, 'The owner password');
  const portability = passwordWarning(userPw, aes256) ?? passwordWarning(ownerPw, aes256);
  const confirmMissing = userPw !== '' && confirmPw === '';
  const nothingToDo = userPw === '' && !hasRestriction;
  const sameAsOwner = userPw !== '' && userPw === ownerPw && hasRestriction;

  const canRun =
    !!bytes &&
    !alreadyEncrypted &&
    !busy &&
    !nothingToDo &&
    !mismatch &&
    !confirmMissing &&
    !problemUser &&
    !problemOwner;

  const setPerm = (key: PermKey, v: boolean) => {
    setPerms((p) => ({ ...p, [key]: v }));
    setResult(null);
  };

  const generate = () => {
    const pw = generatePassword(16, randomInt);
    setUserPw(pw);
    setConfirmPw(pw);
    setShow(true);
    setResult(null);
  };

  const run = useCallback(async () => {
    if (!bytes || !info) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // A blank owner password means "random and thrown away", so restrictions cannot be lifted with it.
      const owner = ownerPw || generatePassword(24, randomInt);
      const out = await encryptPdf(bytes.slice(), userPw, owner, permBits, aes256);

      let verified = false;
      let verifyText = 'Could not re-open the result to double-check it.';
      try {
        const enc = await isEncrypted(out.slice());
        const reopened = await decryptPdf(out.slice(), userPw);
        const n = await pageCount(reopened);
        if (enc && (info.pages === null || n === info.pages)) {
          verified = true;
          verifyText = `Verified: the output is encrypted and re-opens with ${userPw ? 'your password' : 'no password'} (${n} page${n === 1 ? '' : 's'}).`;
        } else {
          verifyText = enc ? `Page count changed (${info.pages} → ${n}).` : 'The output does not look encrypted.';
        }
      } catch (e) {
        verifyText = `Could not re-open the result to double-check it (${errMsg(e)}).`;
      }

      setResult({
        bytes: out,
        name: `${baseName(info.name)}-protected.pdf`,
        verified,
        verifyText,
        summary: [
          aes256 ? 'AES-256' : 'AES-128',
          userPw ? 'open password set' : 'opens without a password',
          hasRestriction ? `blocked: ${restricted.map((r) => r.label.toLowerCase()).join(', ')}` : 'all actions allowed',
        ],
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [bytes, info, ownerPw, userPw, permBits, aes256, hasRestriction, restricted]);

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => void onFiles(f)}
        accept="application/pdf,.pdf"
        label={info ? info.name : 'Drop a PDF to protect'}
        hint={
          loading
            ? 'reading…'
            : info
              ? `${info.pages != null ? `${info.pages} page${info.pages === 1 ? '' : 's'} · ` : ''}${formatBytes(info.size)} · drop another to replace`
              : 'click to browse · nothing leaves your browser'
        }
        compact={!!info}
        disabled={loading}
      />

      <ErrorBanner error={error} />

      {info && alreadyEncrypted && (
        <Notice tone="warn">
          <p>
            This PDF is already encrypted. Remove its password on the <strong>Unlock</strong> tab first, then protect
            the unlocked copy with new settings.
          </p>
        </Notice>
      )}

      {info && !alreadyEncrypted && (
        <>
          <Panel>
            <PanelHeader title="Passwords">
              <Button size="sm" variant="ghost" onClick={generate}>
                <Dices className="size-3.5" /> Generate
              </Button>
              <CopyButton value={() => userPw} label="Copy password" size="icon-sm" disabled={!userPw} />
              <Button size="sm" variant="ghost" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {show ? 'Hide' : 'Show'}
              </Button>
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              <Field label="Open password" hint="Needed to open the file. Leave blank to only restrict actions.">
                <PasswordInput
                  value={userPw}
                  onChange={(v) => {
                    setUserPw(v);
                    setResult(null);
                  }}
                  show={show}
                  label="Open password"
                  autoComplete="new-password"
                  invalid={!!problemUser}
                />
                <StrengthMeter password={userPw} />
              </Field>
              <Field label="Confirm open password">
                <PasswordInput
                  value={confirmPw}
                  onChange={(v) => {
                    setConfirmPw(v);
                    setResult(null);
                  }}
                  show={show}
                  label="Confirm open password"
                  autoComplete="new-password"
                  invalid={mismatch}
                />
                {mismatch && <span className="text-2xs text-destructive">The passwords don&apos;t match.</span>}
                {!mismatch && userPw !== '' && confirmPw === userPw && (
                  <span className="text-2xs text-success">Passwords match.</span>
                )}
              </Field>
              <Field
                label="Owner (permissions) password — optional"
                hint="Unlocks the restrictions below. If empty, a random one is generated and discarded, so the restrictions can't be lifted with it."
                className="sm:col-span-2"
              >
                <PasswordInput
                  value={ownerPw}
                  onChange={(v) => {
                    setOwnerPw(v);
                    setResult(null);
                  }}
                  show={show}
                  label="Owner password"
                  autoComplete="new-password"
                  invalid={!!problemOwner}
                />
              </Field>
            </div>
            {(problemUser || problemOwner) && (
              <div className="border-t px-3 py-2 text-xs text-destructive">{problemUser ?? problemOwner}</div>
            )}
            <p className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
              Forgotten passwords cannot be recovered — keep a copy of the original file.
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="Allowed actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPerms(ALL_ALLOWED);
                  setResult(null);
                }}
              >
                Allow all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPerms(READ_ONLY);
                  setResult(null);
                }}
              >
                Read-only
              </Button>
            </PanelHeader>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 p-3 sm:grid-cols-2">
              {PERMS.map((p) => {
                const disabled = p.key === 'printHighQuality' && !perms.print;
                return (
                  <label key={p.key} className={cn('flex cursor-pointer items-start gap-2', disabled && 'opacity-50')}>
                    <Checkbox
                      checked={perms[p.key] && !disabled}
                      disabled={disabled}
                      onCheckedChange={(c) => setPerm(p.key, c === true)}
                      aria-label={p.label}
                      className="mt-0.5 border-muted-foreground/60"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{p.label}</span>
                      <span className="block text-2xs text-muted-foreground">{p.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="border-t bg-muted/30 px-3 py-1.5 text-2xs text-muted-foreground">
              Restrictions are requests to the PDF viewer — well-behaved apps follow them, but they are not
              unbreakable.
            </p>
          </Panel>

          <OptionsBar>
            <Field label="Encryption" hint="AES-256 needs a reader with PDF 2.0 support (current browsers, Acrobat X+, Preview).">
              <Select
                value={mode}
                onValueChange={(v) => {
                  setMode(v as 'aes256' | 'aes128');
                  setResult(null);
                }}
              >
                <SelectTrigger className="w-[17rem]" aria-label="Encryption">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aes256">AES-256 (recommended, PDF 2.0)</SelectItem>
                  <SelectItem value="aes128">AES-128 (wider compatibility)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button size="sm" onClick={() => void run()} disabled={!canRun}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                Protect PDF
              </Button>
            </div>
          </OptionsBar>

          {userPw === '' && hasRestriction && (
            <Notice tone="warn">
              <p>
                No open password: anyone can open this file. The restrictions are advisory — many tools and
                converters ignore them. Add an open password for real protection.
              </p>
            </Notice>
          )}
          {portability && !problemUser && !problemOwner && (
            <Notice tone="warn">
              <p>{portability}</p>
            </Notice>
          )}
          {nothingToDo && (
            <Notice tone="info">
              <p>Set an open password, or untick at least one allowed action, to have something to protect.</p>
            </Notice>
          )}
          {sameAsOwner && (
            <Notice tone="warn">
              <p>
                The owner password equals the open password, so anyone who can open the file can also lift the
                restrictions. Use a different owner password or leave it empty.
              </p>
            </Notice>
          )}

          {result && (
            <Panel>
              <PanelHeader title="Protected PDF">
                <DownloadButton
                  data={() => result.bytes}
                  filename={result.name}
                  mime="application/pdf"
                  label="Download PDF"
                  variant="secondary"
                />
              </PanelHeader>
              <div
                className={cn('flex items-start gap-2 px-3 py-2 text-xs', result.verified ? '' : 'text-foreground')}
                data-testid="verify"
              >
                {result.verified ? (
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
                )}
                <span>{result.verifyText}</span>
              </div>
              <StatBar className="h-auto min-h-7 py-1" items={[formatBytes(result.bytes.length), ...result.summary]} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Unlock                                                              */
/* ------------------------------------------------------------------ */

interface UnlockResult {
  bytes: Uint8Array;
  pages: number | null;
  viaEmptyPassword: boolean;
}

function UnlockPane() {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [encrypted, setEncrypted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [result, setResult] = useState<UnlockResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const finish = useCallback(async (out: Uint8Array, viaEmptyPassword: boolean): Promise<UnlockResult> => {
    let stillEncrypted = false;
    try {
      stillEncrypted = await isEncrypted(out.slice());
    } catch {
      stillEncrypted = false;
    }
    if (stillEncrypted) throw new Error('The output is still encrypted — this PDF uses a protection this tool cannot remove.');
    let pages: number | null = null;
    try {
      pages = await pageCount(out.slice());
    } catch {
      pages = null;
    }
    return { bytes: out, pages, viaEmptyPassword };
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      const my = ++seq.current;
      setLoading(true);
      setError(null);
      setPwError(null);
      setResult(null);
      setPassword('');
      setEncrypted(null);
      setInfo(null);
      setBytes(null);
      try {
        if (!isPdf(f)) throw new Error('Please choose a PDF file.');
        if (f.size > MAX_FILE_BYTES) {
          throw new Error(`File is too large (${formatBytes(f.size)}). Limit is ${formatBytes(MAX_FILE_BYTES)}.`);
        }
        const data = new Uint8Array(await f.arrayBuffer());
        const enc = await isEncrypted(data.slice());
        if (my !== seq.current) return;
        let pages: number | null = null;
        if (!enc) {
          try {
            pages = await pageCount(data.slice());
          } catch {
            pages = null;
          }
        }
        let auto: UnlockResult | null = null;
        if (enc) {
          // Owner-restricted files open with an empty user password — try that first.
          try {
            auto = await finish(await decryptPdf(data.slice(), ''), true);
          } catch {
            auto = null; // a real open password is required
          }
        }
        if (my !== seq.current) return;
        setBytes(data);
        setEncrypted(enc);
        setInfo({ name: f.name, size: f.size, pages });
        setResult(auto);
      } catch (e) {
        if (my === seq.current) setError(errMsg(e));
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    [finish]
  );

  const unlock = useCallback(async () => {
    if (!bytes) return;
    setBusy(true);
    setPwError(null);
    setError(null);
    try {
      let out: Uint8Array;
      try {
        out = await decryptPdf(bytes.slice(), password);
      } catch (e) {
        setPwError(wrongPassword(e));
        return;
      }
      const res = await finish(out, false);
      setResult(res);
      setPassword('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [bytes, password, finish]);

  const needsPassword = encrypted === true && !result;

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => void onFiles(f)}
        accept="application/pdf,.pdf"
        label={info ? info.name : 'Drop a protected PDF'}
        hint={
          loading
            ? 'reading…'
            : info
              ? `${formatBytes(info.size)}${info.pages != null ? ` · ${info.pages} page${info.pages === 1 ? '' : 's'}` : ''} · drop another to replace`
              : 'click to browse · nothing leaves your browser'
        }
        compact={!!info}
        disabled={loading}
      />

      <ErrorBanner error={error} />

      {info && encrypted === false && (
        <Notice tone="info">
          <p>
            <strong>This PDF isn&apos;t encrypted</strong> — there is no password or restriction to remove. You can
            use it as it is.
          </p>
        </Notice>
      )}

      {info && needsPassword && (
        <Panel>
          <PanelHeader title="Password required">
            <Button size="sm" variant="ghost" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {show ? 'Hide' : 'Show'}
            </Button>
          </PanelHeader>
          <form
            className="flex flex-wrap items-end gap-3 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void unlock();
            }}
          >
            <Field
              label="Password"
              hint="Either the open (user) password or the owner password works. It stays in this tab — never stored or sent anywhere."
              className="min-w-[240px] flex-1"
            >
              <PasswordInput
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setPwError(null);
                }}
                show={show}
                label="PDF password"
                autoComplete="current-password"
                invalid={!!pwError}
              />
            </Field>
            <Button type="submit" size="sm" disabled={busy || password.length === 0}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LockOpen className="size-3.5" />}
              Unlock PDF
            </Button>
          </form>
          {pwError && (
            <div role="alert" className="border-t px-3 py-2 text-xs text-destructive">
              {pwError}
            </div>
          )}
        </Panel>
      )}

      {info && result && (
        <Panel>
          <PanelHeader title="Unlocked PDF">
            <DownloadButton
              data={() => result.bytes}
              filename={`${baseName(info.name)}-unlocked.pdf`}
              mime="application/pdf"
              label="Download PDF"
              variant="secondary"
            />
          </PanelHeader>
          <div className="flex items-start gap-2 px-3 py-2 text-xs" data-testid="unlock-status">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            <span>
              {result.viaEmptyPassword
                ? 'No open password was needed — this file only carried usage restrictions (such as no printing or copying). The encryption and restrictions have been removed.'
                : 'Password accepted. The encryption and restrictions have been removed.'}
            </span>
          </div>
          <StatBar
            className="h-auto min-h-7 py-1"
            items={[
              formatBytes(result.bytes.length),
              result.pages != null && `${result.pages} page${result.pages === 1 ? '' : 's'}`,
              `${baseName(info.name)}-unlocked.pdf`,
            ]}
          />
        </Panel>
      )}

      <p className="text-2xs text-muted-foreground">
        Only works when you know the password — this tool cannot crack passwords. Only remove protection from files
        you are allowed to modify.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type Tab = 'protect' | 'unlock';

export default function PdfProtectUnlockTool() {
  const [tab, setTab] = useState<Tab>('protect');
  return (
    <div className="flex flex-col gap-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="protect">
            <Lock className="size-3.5" /> Protect
          </TabsTrigger>
          <TabsTrigger value="unlock">
            <LockOpen className="size-3.5" /> Unlock
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className={tab === 'protect' ? 'contents' : 'hidden'}>
        <ProtectPane />
      </div>
      <div className={tab === 'unlock' ? 'contents' : 'hidden'}>
        <UnlockPane />
      </div>
      <p className="text-2xs text-muted-foreground">
        Everything runs in your browser — files and passwords are never uploaded, logged or saved. Standard PDF
        encryption (AES) only; certificate-based and DRM-protected PDFs are not supported.
      </p>
    </div>
  );
}
