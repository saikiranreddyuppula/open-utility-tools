'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info, Lock, LockOpen, Paperclip, ShieldAlert, XCircle, HelpCircle } from 'lucide-react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';
import {
  analyzeEmail,
  buildReport,
  formatDuration,
  type AuthResult,
  type EmailAnalysis,
  type Hop,
  type MimePart,
  type RedFlag,
} from './logic';

const GMAIL_SAMPLE = `Delivered-To: recipient@gmail.com
Received: by 2002:a05:7022:fa0f:b0:8a:3c0:1b3c with SMTP id kb15csp1234567dlb;
        Tue, 12 Mar 2024 10:00:05 -0700 (PDT)
X-Google-Smtp-Source: AGHT+IGexample
ARC-Seal: i=1; a=rsa-sha256; t=1710262805; cv=none;
        d=google.com; s=arc-20160816;
        b=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789
ARC-Message-Signature: i=1; a=rsa-sha256; c=relaxed/relaxed; d=google.com; s=arc-20160816;
        h=to:subject:message-id:date:from:mime-version:dkim-signature;
        bh=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=;
        b=ZmFrZXNpZw==
ARC-Authentication-Results: i=1; mx.google.com;
       dkim=pass header.i=@contoso.com header.s=selector1 header.b=Xyz123;
       spf=pass (google.com: domain of alice@contoso.com designates 40.107.220.50 as permitted sender) smtp.mailfrom=alice@contoso.com;
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=contoso.com
Return-Path: <alice@contoso.com>
Received: from NAM11-DM6-obe.outbound.protection.outlook.com (mail-dm6nam11on2050.outbound.protection.outlook.com. [40.107.220.50])
        by mx.google.com with ESMTPS id abc123si456789pld.100.2024.03.12.10.00.05
        for <recipient@gmail.com>
        (version=TLS1_2 cipher=ECDHE-ECDSA-AES128-GCM-SHA256 bits=128/128);
        Tue, 12 Mar 2024 10:00:05 -0700 (PDT)
Received-SPF: pass (google.com: domain of alice@contoso.com designates 40.107.220.50 as permitted sender) client-ip=40.107.220.50;
Authentication-Results: mx.google.com;
       dkim=pass header.i=@contoso.com header.s=selector1 header.b=Xyz123;
       spf=pass (google.com: domain of alice@contoso.com designates 40.107.220.50 as permitted sender) smtp.mailfrom=alice@contoso.com;
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=contoso.com
Received: from DM6PR12MB1234.namprd12.prod.outlook.com ([fe80::1]) by DM6PR12MB1234.namprd12.prod.outlook.com ([fe80::1%5]) with mapi id 15.20.7386.017; Tue, 12 Mar 2024 17:00:01 +0000
Received: from SA1PR12MB1111.namprd12.prod.outlook.com (2603:10b6:806:1::2) by DM6PR12MB1234.namprd12.prod.outlook.com (2603:10b6:5:1::2) with Microsoft SMTP Server (version=TLS1_2, cipher=TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384) id 15.20.7386.17; Tue, 12 Mar 2024 17:00:00 +0000
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=contoso.com; s=selector1; t=1710262800; x=4102444800;
        h=From:To:Subject:Date:Message-ID:MIME-Version;
        bh=47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=;
        b=Zm9vYmFy
From: =?UTF-8?B?QWxpY2UgTcO8bGxlcg==?= <alice@contoso.com>
To: Recipient <recipient@gmail.com>
Subject: =?UTF-8?Q?Quarterly_report_=E2=80=93_Q1?=
Date: Tue, 12 Mar 2024 17:00:00 +0000
Message-ID: <DM6PR12MB1234ABCDEF@DM6PR12MB1234.namprd12.prod.outlook.com>
Content-Language: en-US
MIME-Version: 1.0
Content-Type: text/plain; charset="utf-8"
`;

const PHISH_SAMPLE = `Received: from AM0PR05MB1234.eurprd05.prod.outlook.com (2603:10a6:208:1::2) by AM0PR05MB5678.eurprd05.prod.outlook.com (2603:10a6:208:3::5) with Microsoft SMTP Server (version=TLS1_2, cipher=TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384) id 15.20.7000.1; Tue, 12 Mar 2024 17:00:30 +0000
Received: from mail.secure-pay-update.xyz (mail.secure-pay-update.xyz [185.220.101.5]) by AM0PR05MB1234.eurprd05.prod.outlook.com with ESMTP; Tue, 12 Mar 2024 17:00:29 +0000
Received: from localhost (unknown [10.0.0.9]) by mail.secure-pay-update.xyz with SMTP id abc; Tue, 12 Mar 2024 17:00:35 +0000
Authentication-Results: spf=softfail (sender IP is 185.220.101.5) smtp.mailfrom=secure-pay-update.xyz; dkim=none (message not signed) header.d=none;dmarc=fail action=none header.from=paypal.com;compauth=fail reason=001
Received-SPF: SoftFail (protection.outlook.com: domain of transitioning secure-pay-update.xyz discourages use of 185.220.101.5 as permitted sender)
From: "PayPal Support <support@paypal.com>" <noreply@secure-pay-update.xyz>
Reply-To: "Resolution Center" <help@mailbox-resolve.top>
To: victim@contoso.com
Subject: Your account has been limited
Date: Tue, 12 Mar 2024 17:00:25 +0000
Return-Path: bounce@mailer.other-domain.net
X-MS-Exchange-Organization-SCL: 9
X-Forefront-Antispam-Report: CIP:185.220.101.5;CTRY:DE;LANG:en;SCL:9;SRV:;IPV:NLI;SFV:SPM;H:mail.secure-pay-update.xyz;PTR:mail.secure-pay-update.xyz;CAT:PHSH;DIR:INB;
X-Spam-Status: Yes, score=12.4 required=5.0 tests=BAYES_99,HTML_MESSAGE,URIBL_BLACK autolearn=no
X-Spam-Flag: YES
`;

const MIME_SAMPLE = `Received: from mail.example.com (mail.example.com [203.0.113.5]) by mx.example.org (Postfix) with ESMTPS id 4F1A32A0123 for <sam@example.org>; Tue, 12 Mar 2024 13:15:03 +0000 (UTC)
Authentication-Results: mx.example.org; dkim=pass header.d=example.com header.s=mail; spf=pass smtp.mailfrom=dana@example.com; dmarc=pass header.from=example.com
From: "Dana Whitaker" <dana@example.com>
To: Sam Lee <sam@example.org>
Subject: =?UTF-8?Q?Invoice_#4821_=E2=80=93_March?=
Date: Tue, 12 Mar 2024 09:15:00 -0400
Message-ID: <20240312091500.4821@example.com>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="==MIXED=="

--==MIXED==
Content-Type: multipart/alternative; boundary="==ALT=="

--==ALT==
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

Hi Sam,

Please find the March invoice attached. Total due: =E2=82=AC1,250.00.

Thanks,
Dana
--==ALT==
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: base64

PGh0bWw+PGJvZHk+PHA+SGkgU2FtLDwvcD48cD5QbGVhc2UgZmluZCB0aGUgTWFyY2ggaW52b2ljZSBhdHRhY2hlZC4gVG90YWwgZHVlOiDigqwxLDI1MC4wMC48L3A+PC9ib2R5PjwvaHRtbD4=
--==ALT==--

--==MIXED==
Content-Type: text/csv; name="invoice-4821.csv"
Content-Disposition: attachment; filename="invoice-4821.csv"
Content-Transfer-Encoding: base64

SXRlbSxRdHksUHJpY2UKQ29uc3VsdGluZyAoMTAgaCksMTAsMTI1LjAwClN1cHBvcnQgcmV0YWluZXIsMSwwLjAwCg==
--==MIXED==--
`;

const SAMPLES: { id: string; label: string; text: string }[] = [
  { id: 'gmail', label: 'Gmail delivery (all checks pass)', text: GMAIL_SAMPLE },
  { id: 'phish', label: 'Phishing attempt (red flags)', text: PHISH_SAMPLE },
  { id: 'mime', label: 'Full message with attachment', text: MIME_SAMPLE },
];

const MAX_BYTES = 40 * 1024 * 1024;

type Source = { kind: 'text'; text: string } | { kind: 'file'; name: string; bytes: Uint8Array };

const RESULT_TONE: Record<string, string> = {
  pass: 'text-success',
  bestguesspass: 'text-success',
  fail: 'text-destructive',
  hardfail: 'text-destructive',
  permerror: 'text-destructive',
  softfail: 'text-warning',
  temperror: 'text-warning',
  neutral: 'text-warning',
  policy: 'text-warning',
  none: 'text-muted-foreground',
};

function ResultBadge({ result }: { result: string }) {
  const tone = RESULT_TONE[result] ?? 'text-muted-foreground';
  const Icon = result === 'pass' ? CheckCircle2 : ['fail', 'hardfail', 'permerror'].includes(result) ? XCircle : ['softfail', 'temperror', 'neutral', 'policy'].includes(result) ? AlertTriangle : HelpCircle;
  return (
    <span className={cn('inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase', tone)}>
      <Icon className="size-3.5" />
      {result}
    </span>
  );
}

function sevClass(s: RedFlag['severity']): string {
  switch (s) {
    case 'high':
      return 'border-destructive/40 bg-destructive/10';
    case 'medium':
      return 'border-warning/50 bg-warning/10';
    case 'low':
      return 'border-border bg-muted/40';
    case 'info':
      return 'border-border bg-background';
  }
}

function utc(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z').replace('Z', ' UTC');
}

function safeFilename(n: string): string {
  return n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').slice(0, 180) || 'attachment';
}

function KV({ k, children, mono }: { k: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-0.5 border-b px-3 py-1.5 last:border-b-0 sm:grid-cols-[9rem_1fr]">
      <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className={cn('min-w-0 break-words text-sm', mono && 'font-mono text-xs')}>{children}</div>
    </div>
  );
}

function HopCard({ hop, maxDelay, last }: { hop: Hop; maxDelay: number; last: boolean }) {
  const tlsIcon = hop.tls === 'yes' ? <Lock className="size-3 text-success" /> : hop.tls === 'no' ? <LockOpen className="size-3 text-warning" /> : <HelpCircle className="size-3 text-muted-foreground" />;
  const label = hop.tls === 'yes' ? 'TLS' : hop.tls === 'no' ? 'no TLS' : 'TLS unknown';
  const delayPct = hop.delay !== undefined && maxDelay > 0 ? Math.max(2, Math.round((Math.abs(hop.delay) / maxDelay) * 100)) : 0;
  return (
    <li className="relative flex gap-3 pb-4" data-testid="hop">
      {!last && <span className="absolute left-[0.8rem] top-7 h-[calc(100%-1.5rem)] w-px bg-border" />}
      <span className="z-10 flex size-[1.65rem] shrink-0 items-center justify-center rounded-full border bg-card font-mono text-xs font-semibold">
        {hop.order + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5 rounded-lg border bg-card p-3">
        {hop.parsed || hop.fromHelo || hop.byHost ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {hop.fromHelo || hop.fromRdns ? (
              <>
                <span className="text-2xs uppercase tracking-wide text-muted-foreground">from</span>
                <code className="break-all font-mono text-xs">{hop.fromRdns ?? hop.fromHelo}</code>
                {hop.fromIp && <Badge variant="outline" className="font-mono">{hop.fromIp}</Badge>}
              </>
            ) : (
              <span className="text-2xs uppercase tracking-wide text-muted-foreground">originates at</span>
            )}
            <span className="text-muted-foreground">→</span>
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">by</span>
            <code className="break-all font-mono text-xs">{hop.byHost ?? '?'}</code>
          </div>
        ) : (
          <p className="text-xs text-warning">Could not parse this Received header; showing the raw text.</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {hop.protocol && <Badge variant="secondary" className="font-mono">{hop.protocol}</Badge>}
          <Badge variant="muted" className="gap-1">
            {tlsIcon}
            {label}
          </Badge>
          {hop.byInfo && <Badge variant="muted" className="max-w-[16rem] truncate font-mono" title={hop.byInfo}>{hop.byInfo}</Badge>}
          {hop.id && <span className="font-mono text-2xs text-muted-foreground">id {hop.id}</span>}
        </div>
        {hop.tlsDetail && hop.tls === 'yes' && <p className="break-words font-mono text-2xs text-muted-foreground">{hop.tlsDetail}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {hop.date !== undefined ? (
            <span className="font-mono">{utc(hop.date)}</span>
          ) : (
            <span className="text-warning">no timestamp</span>
          )}
          {hop.zone && <span className="font-mono text-muted-foreground">{hop.zone}</span>}
          {hop.delay !== undefined && (
            <span className={cn('rounded px-1.5 py-0.5 font-mono font-semibold', hop.delay < 0 ? 'bg-destructive/15 text-destructive' : hop.delay >= 3600 ? 'bg-warning/20 text-warning' : 'bg-muted')}>
              {hop.delay >= 0 ? '+' : ''}
              {formatDuration(hop.delay)} vs previous
            </span>
          )}
          {hop.cumulative !== undefined && hop.cumulative > 0 && <span className="text-muted-foreground">total {formatDuration(hop.cumulative)}</span>}
        </div>
        {delayPct > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className={cn('h-full rounded-full', (hop.delay ?? 0) < 0 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${delayPct}%` }} />
          </div>
        )}
        {hop.flags.map((f, i) => (
          <p key={i} className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span>{f === 'unparsed' ? 'Not a recognised Received format' : f === 'no-date' ? 'No timestamp found' : f}</span>
          </p>
        ))}
        {(!hop.parsed || hop.flags.includes('unparsed')) && (
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-2 font-mono text-2xs">{hop.raw}</pre>
        )}
      </div>
    </li>
  );
}

function MimeTree({ part, depth }: { part: MimePart; depth: number }) {
  const [open, setOpen] = useState(true);
  const kids = part.children.length > 0;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded px-1.5 py-1 text-xs hover:bg-muted/50" style={{ paddingLeft: depth * 14 + 6 }}>
        {kids ? (
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-muted-foreground" aria-label={open ? 'Collapse' : 'Expand'}>
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-3.5" />
        )}
        <span className="font-mono text-2xs text-muted-foreground">{part.path || '·'}</span>
        <code className="font-mono font-semibold">{part.contentType}</code>
        {part.charset && <Badge variant="muted">{part.charset.toLowerCase()}</Badge>}
        {part.cte !== '7bit' && <Badge variant="muted">{part.cte}</Badge>}
        {part.disposition && <Badge variant="outline">{part.disposition}</Badge>}
        {part.filename && (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3" />
            {part.filename}
          </span>
        )}
        {!part.contentType.startsWith('multipart/') && <span className="text-muted-foreground">{formatBytes(part.size)}</span>}
        {part.notes.map((n, i) => (
          <span key={i} className="text-warning">{n}</span>
        ))}
      </div>
      {kids && open && part.children.map((c, i) => <MimeTree key={i} part={c} depth={depth + 1} />)}
    </div>
  );
}

function AuthResultRow({ r }: { r: AuthResult }) {
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b px-3 py-2 last:border-b-0">
      <span className="w-16 shrink-0 font-mono text-xs font-semibold uppercase">{r.method}</span>
      <div className="w-24 shrink-0">
        <ResultBadge result={r.result} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {r.props.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.props.map((p, i) => (
              <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">
                <span className="text-muted-foreground">{p.key}=</span>
                {p.value}
              </span>
            ))}
          </div>
        )}
        {r.comment && <p className="break-words text-xs text-muted-foreground">({r.comment})</p>}
        {r.reason && <p className="break-words text-xs text-muted-foreground">reason: {r.reason}</p>}
      </div>
    </div>
  );
}

export default function EmailHeaderAnalyzerTool() {
  const [source, setSource] = useState<Source>({ kind: 'text', text: GMAIL_SAMPLE });
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [bodyIdx, setBodyIdx] = useState(0);
  const runId = useRef(0);

  useEffect(() => {
    const id = ++runId.current;
    setBusy(true);
    const t = setTimeout(
      () => {
        try {
          const a = analyzeEmail(source.kind === 'text' ? source.text : source.bytes, { now: Date.now() });
          if (id !== runId.current) return;
          setAnalysis(a);
          setError(null);
          setBodyIdx(0);
        } catch (e) {
          if (id !== runId.current) return;
          setAnalysis(null);
          setError(e instanceof Error ? e.message : 'Could not analyse this input.');
        } finally {
          if (id === runId.current) setBusy(false);
        }
      },
      source.kind === 'text' ? 200 : 20
    );
    return () => clearTimeout(t);
  }, [source]);

  const onFiles = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`File too large (${formatBytes(f.size)}). The limit is ${formatBytes(MAX_BYTES)}.`);
      return;
    }
    setBusy(true);
    f.arrayBuffer()
      .then((buf) => setSource({ kind: 'file', name: f.name, bytes: new Uint8Array(buf) }))
      .catch(() => setError('Could not read the file.'));
  }, []);

  const a = analysis;
  const maxDelay = useMemo(() => (a ? Math.max(0, ...a.hops.hops.map((h) => Math.abs(h.delay ?? 0))) : 0), [a]);
  const filteredHeaders = useMemo(() => {
    if (!a) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return a.headers;
    return a.headers.filter((h) => h.name.toLowerCase().includes(q) || h.decoded.toLowerCase().includes(q));
  }, [a, filter]);

  const flagCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, info: 0 };
    a?.flags.forEach((f) => (c[f.severity] += 1));
    return c;
  }, [a]);

  const body = a?.textParts[bodyIdx];

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Raw headers or full message">
          <Select value="" onValueChange={(id) => { const s = SAMPLES.find((x) => x.id === id); if (s) setSource({ kind: 'text', text: s.text }); }}>
            <SelectTrigger className="h-7 w-56 text-xs" aria-label="Load a sample">
              <SelectValue placeholder="Load a sample…" />
            </SelectTrigger>
            <SelectContent>
              {SAMPLES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setSource({ kind: 'text', text: '' })}>
            Clear
          </Button>
        </PanelHeader>
        {source.kind === 'text' ? (
          <Textarea
            value={source.text}
            onChange={(e) => setSource({ kind: 'text', text: e.target.value })}
            spellCheck={false}
            rows={10}
            placeholder={'Paste the raw message source here, e.g. Gmail: ⋮ → "Show original", Outlook: File → Properties → Internet headers…'}
            aria-label="Raw email headers"
            className="min-h-56 resize-y rounded-none border-0 border-b font-mono text-xs shadow-none focus-visible:ring-0"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 text-sm">
            <Paperclip className="size-4 text-muted-foreground" />
            <span className="font-mono">{source.name}</span>
            <span className="text-muted-foreground">{formatBytes(source.bytes.length)}</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setSource({ kind: 'text', text: '' })}>
              Remove file
            </Button>
          </div>
        )}
        <div className="p-3">
          <FileDropzone onFiles={onFiles} accept=".eml,.txt,.msg,.mbox,message/rfc822,text/plain" label="Drop a .eml file here" compact hint="or click to browse · parsed locally, nothing is uploaded" />
        </div>
      </Panel>

      <ErrorBanner error={error} />
      {busy && <p className="text-xs text-muted-foreground">Analysing…</p>}

      {a && a.headers.length === 0 && !busy && (
        <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          {a.issues[0] ?? 'Paste headers above to analyse them.'}
        </p>
      )}

      {a && a.headers.length > 0 && (
        <Tabs defaultValue="overview" className="gap-3">
          <div className="max-w-full overflow-x-auto">
            <TabsList>
              <TabsTrigger value="overview">
                Overview
                {flagCounts.high + flagCounts.medium > 0 && (
                  <Badge variant="destructive" className="h-4 px-1">{flagCounts.high + flagCounts.medium}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="hops">Hops ({a.hops.hops.length})</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
              <TabsTrigger value="message">Message{a.attachments.length ? ` (${a.attachments.length} 📎)` : ''}</TabsTrigger>
              <TabsTrigger value="headers">All headers ({a.headers.length})</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <Panel>
              <PanelHeader title="Summary">
                <CopyButton value={() => JSON.stringify(buildReport(a), null, 2)} label="Copy JSON report" />
                <DownloadButton data={() => JSON.stringify(buildReport(a), null, 2)} filename="email-header-report.json" mime="application/json" label="Download JSON" />
              </PanelHeader>
              <div data-testid="summary">
                {a.summary.map((s) => (
                  <KV key={s.label} k={s.label} mono={s.label === 'Message-ID' || s.label === 'Return-Path' || s.label === 'Date'}>
                    {s.value}
                  </KV>
                ))}
              </div>
              <StatBar
                items={[
                  `${a.headers.length} headers`,
                  `${a.hops.hops.length} hop${a.hops.hops.length === 1 ? '' : 's'}`,
                  a.hops.totalSeconds !== null && `transit ${formatDuration(a.hops.totalSeconds)}`,
                  a.hasBody && `${formatBytes(a.inputBytes)}`,
                ]}
              />
            </Panel>

            <Panel>
              <PanelHeader title={`Red flags (${a.flags.length})`} />
              {a.flags.length === 0 ? (
                <p className="flex items-center gap-2 p-3 text-sm text-success">
                  <CheckCircle2 className="size-4" /> Nothing suspicious found in the headers.
                </p>
              ) : (
                <ul className="space-y-2 p-3" data-testid="flags">
                  {a.flags.map((f, i) => (
                    <li key={i} className={cn('flex gap-2 rounded-md border p-2.5', sevClass(f.severity))}>
                      {f.severity === 'high' ? (
                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : f.severity === 'medium' ? (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                      ) : (
                        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">
                          {f.title} <span className="ml-1 text-2xs font-normal uppercase tracking-wide text-muted-foreground">{f.severity}</span>
                        </p>
                        <p className="break-words text-xs text-muted-foreground">{f.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">
                Flags are heuristics from header text alone: treat them as leads, not verdicts.
              </p>
            </Panel>

            {a.spam.length > 0 && (
              <Panel>
                <PanelHeader title="Spam filter headers" />
                <div className="divide-y">
                  {a.spam.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-xs">
                      <code className="font-mono font-semibold">{s.header}</code>
                      <Badge variant={s.verdict === 'bad' ? 'destructive' : s.verdict === 'ok' ? 'success' : 'muted'}>{s.verdict === 'bad' ? 'spam' : s.verdict === 'warn' ? 'suspect' : s.verdict}</Badge>
                      <span className="text-muted-foreground">{s.summary}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            {a.issues.length > 0 && a.issues.map((m, i) => <p key={i} className="text-xs text-warning">{m}</p>)}
          </TabsContent>

          <TabsContent value="hops" className="space-y-3">
            {a.hops.hops.length === 0 ? (
              <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No Received headers found. They record each server the message passed through.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{a.hops.hops.length} hops, oldest first</Badge>
                  {a.hops.totalSeconds !== null && <Badge variant="default">total transit {formatDuration(a.hops.totalSeconds)}</Badge>}
                  <Badge variant="muted">{a.hops.hops.filter((h) => h.tls === 'yes').length} with TLS</Badge>
                  {a.hops.negative > 0 && <Badge variant="destructive">{a.hops.negative} clock-skew</Badge>}
                </div>
                <ol className="m-0 list-none p-0">
                  {a.hops.hops.map((h, i) => (
                    <HopCard key={i} hop={h} maxDelay={maxDelay} last={i === a.hops.hops.length - 1} />
                  ))}
                </ol>
              </>
            )}
          </TabsContent>

          <TabsContent value="auth" className="space-y-4">
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Signatures aren&apos;t verified (no DNS access) — results come from the receiving server&apos;s headers.
            </p>
            {a.auth.summary.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['spf', 'dkim', 'dmarc', 'arc'].map((m) => {
                  const r = a.auth.summary.find((x) => x.method === m);
                  return (
                    <div key={m} className="rounded-lg border bg-card p-3">
                      <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{m}</div>
                      <div className="mt-1">{r ? <ResultBadge result={r.result} /> : <span className="text-xs text-muted-foreground">not reported</span>}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {a.auth.authResults.map((ar, i) => (
              <Panel key={i}>
                <PanelHeader title={`Authentication-Results${a.auth.authResults.length > 1 ? ` #${i + 1}` : ''} · ${ar.authserv || 'no server id'}`} />
                {ar.results.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No results listed.</p> : ar.results.map((r, j) => <AuthResultRow key={j} r={r} />)}
              </Panel>
            ))}

            {a.auth.receivedSpf.map((s, i) => (
              <Panel key={i}>
                <PanelHeader title="Received-SPF" />
                <div className="space-y-1 p-3 text-xs">
                  <ResultBadge result={s.result} />
                  {s.comment && <p className="break-words text-muted-foreground">({s.comment})</p>}
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(s.props).map(([k, v]) => (
                      <span key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">
                        <span className="text-muted-foreground">{k}=</span>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </Panel>
            ))}

            {a.auth.dkim.map((d, i) => (
              <Panel key={i}>
                <PanelHeader title={`DKIM-Signature${a.auth.dkim.length > 1 ? ` #${i + 1}` : ''}`}>
                  {d.dnsName && <CopyButton value={d.dnsName} label="Copy DNS name" />}
                </PanelHeader>
                <div data-testid="dkim">
                  <KV k="Domain (d=)" mono>{d.domain || '—'}</KV>
                  <KV k="Selector (s=)" mono>{d.selector || '—'}</KV>
                  {d.dnsName && <KV k="Key lookup" mono>{d.dnsName} <span className="text-muted-foreground">(TXT)</span></KV>}
                  <KV k="Algorithm (a=)" mono>{d.algorithm || '—'}</KV>
                  <KV k="Canonicalization (c=)" mono>header {d.canonHeader} / body {d.canonBody}</KV>
                  <KV k="Signed headers (h=)">
                    <div className="flex flex-wrap gap-1">
                      {d.headersSigned.map((h, j) => (
                        <span key={j} className={cn('rounded px-1.5 py-0.5 font-mono text-2xs', h.toLowerCase() === 'from' ? 'bg-success/15 text-success' : 'bg-muted')}>
                          {h}
                        </span>
                      ))}
                    </div>
                  </KV>
                  {d.identity && <KV k="Identity (i=)" mono>{d.identity}</KV>}
                  {d.timestamp !== undefined && <KV k="Signed at (t=)" mono>{utc(d.timestamp * 1000)}</KV>}
                  {d.expiration !== undefined && (
                    <KV k="Expires (x=)" mono>
                      {utc(d.expiration * 1000)} {d.expired ? <span className="font-semibold text-destructive">· expired</span> : <span className="text-success">· valid</span>}
                    </KV>
                  )}
                  {d.bodyLength !== undefined && <KV k="Body length (l=)" mono>{d.bodyLength}</KV>}
                  {d.bodyHash && <KV k="Body hash (bh=)" mono>{d.bodyHash.length > 56 ? d.bodyHash.slice(0, 56) + '…' : d.bodyHash}</KV>}
                  {d.signature && <KV k="Signature (b=)" mono>{d.signature.length > 56 ? d.signature.slice(0, 56) + `… (${d.signature.length} chars)` : d.signature}</KV>}
                </div>
                {d.issues.length > 0 && (
                  <ul className="space-y-1 border-t p-3">
                    {d.issues.map((m, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-xs text-warning">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            ))}

            {a.auth.arc.instances.length > 0 && (
              <Panel>
                <PanelHeader title={`ARC chain${a.auth.arc.chainResult ? ` · cv=${a.auth.arc.chainResult}` : ''}`} />
                <div className="divide-y">
                  {a.auth.arc.instances.map((x) => (
                    <div key={x.i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                      <Badge variant="outline" className="font-mono">i={x.i}</Badge>
                      {x.cv && <ResultBadge result={x.cv} />}
                      {x.domain && <span className="font-mono">{x.domain}{x.selector ? ` (s=${x.selector})` : ''}</span>}
                      {x.results?.authserv && <span className="text-muted-foreground">auth by {x.results.authserv}</span>}
                      {x.issues.map((m, j) => (
                        <span key={j} className="text-warning">{m}</span>
                      ))}
                    </div>
                  ))}
                  {a.auth.arc.issues.map((m, j) => (
                    <p key={j} className="px-3 py-1.5 text-xs text-warning">{m}</p>
                  ))}
                </div>
              </Panel>
            )}

            <Panel>
              <PanelHeader title={`Alignment with the From domain${a.auth.fromDomain ? ` · ${a.auth.fromDomain}` : ''}`} />
              {a.auth.alignment.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No DKIM d= or SPF envelope domains were found to compare.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-xs" data-testid="alignment">
                    <thead className="bg-muted/50 text-left text-2xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5 font-medium">Mechanism</th>
                        <th className="px-3 py-1.5 font-medium">Domain</th>
                        <th className="px-3 py-1.5 font-medium">Result</th>
                        <th className="px-3 py-1.5 font-medium">Strict</th>
                        <th className="px-3 py-1.5 font-medium">Relaxed</th>
                        <th className="px-3 py-1.5 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {a.auth.alignment.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-semibold">{r.mechanism}</td>
                          <td className="px-3 py-1.5 font-mono">{r.domain}</td>
                          <td className="px-3 py-1.5">{r.result ? <ResultBadge result={r.result} /> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-1.5">{r.strict ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}</td>
                          <td className="px-3 py-1.5">{r.relaxed ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="space-y-1 border-t px-3 py-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="font-medium">DMARC estimate:</span>
                  <ResultBadge result={a.auth.dmarcEstimate.outcome === 'unknown' ? 'none' : a.auth.dmarcEstimate.outcome} />
                  <span className="text-muted-foreground">{a.auth.dmarcEstimate.reason}</span>
                </p>
                <p className="text-2xs text-muted-foreground">
                  Relaxed alignment compares organizational domains, approximated by the last two labels (three for common suffixes like co.uk) because the Public Suffix List isn&apos;t bundled.
                </p>
              </div>
            </Panel>

            {a.auth.authResults.length === 0 && a.auth.receivedSpf.length === 0 && a.auth.dkim.length === 0 && a.auth.arc.instances.length === 0 && (
              <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">No Authentication-Results, Received-SPF, DKIM-Signature or ARC headers were found.</p>
            )}
          </TabsContent>

          <TabsContent value="message" className="space-y-4">
            {!a.mime ? (
              <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                Only headers were provided. Paste the full message source or drop a .eml file to see the MIME structure, attachments and body.
              </p>
            ) : (
              <>
                <Panel>
                  <PanelHeader title="MIME structure" />
                  <div className="max-h-80 overflow-auto p-2" data-testid="mime-tree">
                    <MimeTree part={a.mime} depth={0} />
                  </div>
                </Panel>

                <Panel>
                  <PanelHeader title={`Attachments (${a.attachments.length})`} />
                  {a.attachments.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No attachments.</p>
                  ) : (
                    <div className="divide-y" data-testid="attachments">
                      {a.attachments.map((x, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1 break-all font-medium">{x.filename}</span>
                          <Badge variant="muted" className="font-mono">{x.contentType}</Badge>
                          <span className="font-mono text-xs text-muted-foreground">{formatBytes(x.size)}</span>
                          {x.disposition === 'inline' && <Badge variant="outline">inline</Badge>}
                          <DownloadButton data={x.bytes} filename={safeFilename(x.filename)} mime={x.contentType} label="Download" variant="outline" />
                        </div>
                      ))}
                    </div>
                  )}
                  {a.attachments.length > 0 && <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">Attachments are decoded in your browser. Treat unexpected files as untrusted before opening them.</p>}
                </Panel>

                <Panel>
                  <PanelHeader title="Body">
                    {a.textParts.length > 1 && (
                      <div className="flex gap-1">
                        {a.textParts.map((t, i) => (
                          <Button key={i} size="sm" variant={i === bodyIdx ? 'secondary' : 'ghost'} onClick={() => setBodyIdx(i)}>
                            {t.contentType.replace('text/', '')} {t.contentType === 'text/html' ? '(source)' : ''}
                          </Button>
                        ))}
                      </div>
                    )}
                    {body && <CopyButton value={body.text} />}
                  </PanelHeader>
                  {body ? (
                    <>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs" data-testid="body-preview">{body.text}</pre>
                      <p className="border-t px-3 py-1.5 text-2xs text-muted-foreground">
                        {body.contentType} · {body.charset}
                        {body.truncated ? ' · truncated' : ''}
                        {body.contentType === 'text/html' ? ' · HTML is shown as source only and never rendered.' : ''}
                      </p>
                    </>
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">No text/plain or text/html body part found.</p>
                  )}
                </Panel>
              </>
            )}
          </TabsContent>

          <TabsContent value="headers" className="space-y-3">
            <Panel>
              <PanelHeader title="All headers">
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name or value…" className="h-7 w-56" aria-label="Search headers" />
                <Button size="sm" variant={showRaw ? 'secondary' : 'ghost'} onClick={() => setShowRaw((r) => !r)}>
                  {showRaw ? 'Raw' : 'Decoded'}
                </Button>
                <CopyButton value={() => JSON.stringify(a.headers.map((h) => ({ name: h.name, value: h.decoded })), null, 2)} label="Copy JSON" />
              </PanelHeader>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full border-collapse text-xs" data-testid="headers-table">
                  <tbody className="divide-y">
                    {filteredHeaders.map((h) => (
                      <tr key={h.index} className="align-top hover:bg-muted/40">
                        <td className="w-10 px-2 py-1.5 text-right font-mono text-2xs text-muted-foreground">{h.index + 1}</td>
                        <td className="w-44 max-w-[40vw] break-all px-2 py-1.5 font-mono font-semibold sm:w-56">{h.name}</td>
                        <td className="whitespace-pre-wrap break-all px-2 py-1.5 font-mono">{showRaw ? h.raw.slice(h.raw.indexOf(':') + 1).trim() : h.decoded}</td>
                      </tr>
                    ))}
                    {filteredHeaders.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-center text-muted-foreground">No header matches “{filter}”.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <StatBar items={[`${filteredHeaders.length} of ${a.headers.length} headers`, a.unparsed.length > 0 && `${a.unparsed.length} unparsed line${a.unparsed.length === 1 ? '' : 's'}`]} />
            </Panel>
            {a.unparsed.length > 0 && (
              <details className="rounded-md border bg-muted/30 text-xs">
                <summary className="cursor-pointer px-3 py-1.5 font-medium">Lines that could not be parsed as headers</summary>
                <pre className="overflow-auto whitespace-pre-wrap border-t px-3 py-2 font-mono text-2xs">{a.unparsed.join('\n')}</pre>
              </details>
            )}
          </TabsContent>
        </Tabs>
      )}

      <p className="text-2xs text-muted-foreground">
        Everything is parsed in your browser; nothing is uploaded. Signatures aren&apos;t verified (no DNS access) — results come from the receiving server&apos;s headers. Parsing handles RFC 2047 encoded words in
        any charset your browser supports, RFC 2231 filenames and nested MIME up to 24 levels. HTML parts are shown as source only.
      </p>
    </div>
  );
}
