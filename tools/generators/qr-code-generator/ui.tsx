'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Contact,
  ImagePlus,
  Link as LinkIcon,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Type,
  Wifi,
  X,
} from 'lucide-react';

import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBytes } from '@/lib/download';
import {
  colourWarnings,
  encodeQr,
  geoPayload,
  logoImageRect,
  mailtoPayload,
  planLogoBox,
  qrPathData,
  qrToSvg,
  smsPayload,
  telPayload,
  vcardPayload,
  wifiPayload,
  type EcLevel,
  type LogoBox,
  type ModuleStyle,
  type QrCode,
  type QrMode,
  type WifiSecurity,
} from './logic';

type ContentType = 'url' | 'text' | 'wifi' | 'email' | 'phone' | 'sms' | 'vcard' | 'geo';

const TYPES: { id: ContentType; label: string; icon: typeof LinkIcon }[] = [
  { id: 'url', label: 'URL', icon: LinkIcon },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'phone', label: 'Phone', icon: Phone },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'vcard', label: 'Contact', icon: Contact },
  { id: 'geo', label: 'Location', icon: MapPin },
];

interface Fields {
  url: string;
  text: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiSecurity: WifiSecurity;
  wifiHidden: boolean;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  phone: string;
  smsNumber: string;
  smsMessage: string;
  vcFirst: string;
  vcLast: string;
  vcOrg: string;
  vcTitle: string;
  vcPhone: string;
  vcEmail: string;
  vcUrl: string;
  geoLat: string;
  geoLon: string;
}

const DEFAULT_FIELDS: Fields = {
  url: 'https://example.com/hello',
  text: 'Hello from Open Utility Tools!',
  wifiSsid: 'HomeNetwork',
  wifiPassword: 'correct-horse-battery',
  wifiSecurity: 'WPA',
  wifiHidden: false,
  emailTo: 'hello@example.com',
  emailSubject: 'Hello',
  emailBody: 'Hi there,',
  phone: '+1 555 010 4477',
  smsNumber: '+1 555 010 4477',
  smsMessage: 'Hi! Please call me back.',
  vcFirst: 'Ada',
  vcLast: 'Lovelace',
  vcOrg: 'Analytical Engines Ltd',
  vcTitle: 'Mathematician',
  vcPhone: '+44 20 7946 0000',
  vcEmail: 'ada@example.com',
  vcUrl: 'https://example.com',
  geoLat: '48.8584',
  geoLon: '2.2945',
};

type PayloadResult = { payload: string; hint?: string } | { error: string };

function buildPayload(type: ContentType, f: Fields): PayloadResult {
  try {
    switch (type) {
      case 'url': {
        const u = f.url.trim();
        if (!u) return { payload: '' };
        const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(u);
        return {
          payload: u,
          hint: hasScheme
            ? undefined
            : 'No scheme (e.g. https://). Some phones will show this as plain text instead of opening a link.',
        };
      }
      case 'text':
        return { payload: f.text };
      case 'wifi':
        if (!f.wifiSsid) return { payload: '' };
        return {
          payload: wifiPayload({
            ssid: f.wifiSsid,
            password: f.wifiPassword,
            security: f.wifiSecurity,
            hidden: f.wifiHidden,
          }),
        };
      case 'email':
        if (!f.emailTo.trim()) return { payload: '' };
        return { payload: mailtoPayload({ to: f.emailTo, subject: f.emailSubject, body: f.emailBody }) };
      case 'phone':
        if (!f.phone.trim()) return { payload: '' };
        return { payload: telPayload(f.phone) };
      case 'sms':
        if (!f.smsNumber.trim()) return { payload: '' };
        return { payload: smsPayload({ number: f.smsNumber, message: f.smsMessage }) };
      case 'vcard':
        if (![f.vcFirst, f.vcLast, f.vcOrg, f.vcPhone, f.vcEmail].some((x) => x.trim())) return { payload: '' };
        return {
          payload: vcardPayload({
            firstName: f.vcFirst.trim(),
            lastName: f.vcLast.trim(),
            org: f.vcOrg.trim(),
            title: f.vcTitle.trim(),
            phone: f.vcPhone,
            email: f.vcEmail,
            url: f.vcUrl,
          }),
        };
      case 'geo':
        if (!f.geoLat.trim() && !f.geoLon.trim()) return { payload: '' };
        return { payload: geoPayload(f.geoLat, f.geoLon) };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const EC_INFO: Record<EcLevel, { label: string; recovery: string }> = {
  L: { label: 'L: Low', recovery: '~7%' },
  M: { label: 'M: Medium', recovery: '~15%' },
  Q: { label: 'Q: Quartile', recovery: '~25%' },
  H: { label: 'H: High', recovery: '~30%' },
};

const MODE_LABEL: Record<QrMode, string> = {
  numeric: 'Numeric',
  alphanumeric: 'Alphanumeric',
  byte: 'Byte (UTF-8)',
};

// ---------------------------------------------------------------------------
// Logo + canvas rendering
// ---------------------------------------------------------------------------

interface Logo {
  name: string;
  canvas: HTMLCanvasElement;
  dataUrl: string;
  aspect: number;
}

async function loadLogo(file: File): Promise<Logo> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (PNG, JPG, SVG or WebP).');
  if (file.size > 8 * 1024 * 1024) throw new Error('That logo is larger than 8 MB. Use a smaller image.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new globalThis.Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not decode that image.'));
      i.src = url;
    });
    const w0 = img.naturalWidth || 256;
    const h0 = img.naturalHeight || 256;
    const isSvg = file.type === 'image/svg+xml';
    const scale = isSvg ? 256 / Math.max(w0, h0) : Math.min(1, 256 / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return { name: file.name, canvas, dataUrl: canvas.toDataURL('image/png'), aspect: w / h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface DrawOpts {
  sizePx: number;
  quiet: number;
  style: ModuleStyle;
  fg: string;
  bg: string;
  transparent: boolean;
  logo: Logo | null;
  box: LogoBox | null;
}

/** Paint the code onto `canvas` with whole-pixel modules; returns the pixel size and module size. */
function drawQr(canvas: HTMLCanvasElement, qr: QrCode, o: DrawOpts): { px: number; mod: number } {
  const total = qr.size + 2 * o.quiet;
  const px = Math.max(o.sizePx, total);
  const mod = Math.floor(px / total);
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.clearRect(0, 0, px, px);
  if (!o.transparent) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, px, px);
  }
  const off = Math.floor((px - mod * total) / 2);
  ctx.save();
  ctx.translate(off, off);
  ctx.scale(mod, mod);
  ctx.fillStyle = o.fg;
  ctx.fill(new Path2D(qrPathData(qr, o.style, o.quiet, o.box)));
  ctx.restore();
  if (o.logo && o.box) {
    const r = logoImageRect({ box: o.box, aspect: o.logo.aspect }, o.quiet);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(o.logo.canvas, off + r.x * mod, off + r.y * mod, r.w * mod, r.h * mod);
  }
  return { px, mod };
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed.'))), 'image/png');
  });
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'url' | 'decimal';
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      <Input
        value={value}
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <span>{children}</span>
    </div>
  );
}

const VERSION_CHOICES = Array.from({ length: 40 }, (_, i) => i + 1);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QrCodeGeneratorTool() {
  const [type, setType] = useState<ContentType>('url');
  const [f, setF] = useState<Fields>(DEFAULT_FIELDS);
  const [ecl, setEcl] = useState<EcLevel>('M');
  const [minVersion, setMinVersion] = useState(1);
  const [modeSel, setModeSel] = useState<'auto' | QrMode>('auto');
  const [eci, setEci] = useState(false);
  const [style, setStyle] = useState<ModuleStyle>('square');
  const [sizePx, setSizePx] = useState(512);
  const [quiet, setQuiet] = useState(4);
  const [fg, setFg] = useState('#000000');
  const [bg, setBg] = useState('#ffffff');
  const [transparent, setTransparent] = useState(false);
  const [logo, setLogo] = useState<Logo | null>(null);
  const [logoArea, setLogoArea] = useState(12);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [drawInfo, setDrawInfo] = useState<{ px: number; mod: number } | null>(null);
  const [drawError, setDrawError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF((p) => ({ ...p, [k]: v }));

  const built = useMemo(() => buildPayload(type, f), [type, f]);
  const payload = 'payload' in built ? built.payload : '';
  const deferredPayload = useDeferredValue(payload);

  const effEcl: EcLevel = logo ? 'H' : ecl;
  const effMinVersion = logo ? Math.max(minVersion, 5) : minVersion;

  const encoded = useMemo(() => {
    if (!deferredPayload) return { qr: null as QrCode | null, error: null as string | null };
    try {
      const qr = encodeQr(deferredPayload, {
        ecl: effEcl,
        minVersion: effMinVersion,
        mode: modeSel,
        eci,
      });
      return { qr, error: null };
    } catch (e) {
      return { qr: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferredPayload, effEcl, effMinVersion, modeSel, eci]);
  const qr = encoded.qr;

  const box = useMemo(() => (qr && logo ? planLogoBox(qr, logoArea / 100) : null), [qr, logo, logoArea]);

  const drawOpts: DrawOpts = useMemo(
    () => ({ sizePx, quiet, style, fg, bg, transparent, logo, box }),
    [sizePx, quiet, style, fg, bg, transparent, logo, box]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qr) {
      setDrawInfo(null);
      return;
    }
    try {
      setDrawInfo(drawQr(canvas, qr, drawOpts));
      setDrawError(null);
    } catch (e) {
      setDrawError(e instanceof Error ? e.message : String(e));
    }
  }, [qr, drawOpts]);

  const svgFor = (q: QrCode): string =>
    qrToSvg(q, {
      quiet,
      style,
      fg,
      bg: transparent ? '' : bg,
      sizePx: Math.max(sizePx, q.size + 2 * quiet),
      logo: logo && box ? { box, href: logo.dataUrl, aspect: logo.aspect } : null,
    });

  const onLogoFile = async (file: File) => {
    setLogoError(null);
    try {
      setLogo(await loadLogo(file));
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : String(e));
    }
  };

  const warnings: string[] = [];
  if ('hint' in built && built.hint) warnings.push(built.hint);
  if (!transparent) warnings.push(...colourWarnings(fg, bg));
  if (quiet < 4) warnings.push('Quiet zone is below the 4-module minimum in the specification. Some scanners need it to find the code.');
  if (style === 'dots') warnings.push('Dot modules are less robust than squares. Test with a few phones before printing.');
  if (qr && qr.version >= 20) warnings.push(`Version ${qr.version} is very dense. Shorten the content or print the code larger so it stays easy to scan.`);
  if (logo && qr && !box) warnings.push('This code is too small to hold a logo. Add more content or raise the minimum version.');

  const usedPct = qr ? Math.round((qr.usedBits / qr.capacityBits) * 100) : 0;
  const svgText = qr ? svgFor(qr) : '';
  const canEci = modeSel === 'byte' || (modeSel === 'auto' && /[^\u0000-\u007f]/.test(payload));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      {/* ------------------------------------------------------------ left */}
      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <PanelHeader title="Content" />
          <div className="flex flex-col gap-3 p-3">
            <Tabs value={type} onValueChange={(v) => setType(v as ContentType)}>
              <TabsList className="h-auto w-full flex-wrap justify-start gap-0.5">
                {TYPES.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="flex-none">
                    <t.icon className="size-3.5" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {type === 'url' && (
              <TextField label="Website address" value={f.url} onChange={(v) => set('url', v)} placeholder="https://example.com" inputMode="url" />
            )}

            {type === 'text' && (
              <Field label="Text">
                <Textarea
                  value={f.text}
                  onChange={(e) => set('text', e.target.value)}
                  spellCheck={false}
                  rows={4}
                  placeholder="Any text, up to a few thousand characters"
                />
              </Field>
            )}

            {type === 'wifi' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Network name (SSID)" value={f.wifiSsid} onChange={(v) => set('wifiSsid', v)} />
                <TextField
                  label="Password"
                  value={f.wifiPassword}
                  onChange={(v) => set('wifiPassword', v)}
                  className={f.wifiSecurity === 'nopass' ? 'opacity-50' : undefined}
                />
                <Field label="Security">
                  <Select value={f.wifiSecurity} onValueChange={(v) => set('wifiSecurity', v as WifiSecurity)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WPA">WPA / WPA2 / WPA3</SelectItem>
                      <SelectItem value="WEP">WEP</SelectItem>
                      <SelectItem value="nopass">None (open network)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Hidden network">
                  <label className="flex h-8 items-center gap-2 text-xs">
                    <Switch checked={f.wifiHidden} onCheckedChange={(c) => set('wifiHidden', c)} />
                    {f.wifiHidden ? 'Hidden SSID' : 'Broadcast SSID'}
                  </label>
                </Field>
              </div>
            )}

            {type === 'email' && (
              <div className="flex flex-col gap-3">
                <TextField label="To" value={f.emailTo} onChange={(v) => set('emailTo', v)} type="email" inputMode="email" placeholder="name@example.com" />
                <TextField label="Subject" value={f.emailSubject} onChange={(v) => set('emailSubject', v)} />
                <Field label="Body">
                  <Textarea value={f.emailBody} onChange={(e) => set('emailBody', e.target.value)} rows={3} spellCheck={false} />
                </Field>
              </div>
            )}

            {type === 'phone' && (
              <TextField label="Phone number" value={f.phone} onChange={(v) => set('phone', v)} type="tel" inputMode="tel" placeholder="+1 555 010 4477" />
            )}

            {type === 'sms' && (
              <div className="flex flex-col gap-3">
                <TextField label="Phone number" value={f.smsNumber} onChange={(v) => set('smsNumber', v)} type="tel" inputMode="tel" placeholder="+1 555 010 4477" />
                <Field label="Message">
                  <Textarea value={f.smsMessage} onChange={(e) => set('smsMessage', e.target.value)} rows={3} spellCheck={false} />
                </Field>
              </div>
            )}

            {type === 'vcard' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="First name" value={f.vcFirst} onChange={(v) => set('vcFirst', v)} />
                <TextField label="Last name" value={f.vcLast} onChange={(v) => set('vcLast', v)} />
                <TextField label="Organization" value={f.vcOrg} onChange={(v) => set('vcOrg', v)} />
                <TextField label="Job title" value={f.vcTitle} onChange={(v) => set('vcTitle', v)} />
                <TextField label="Phone" value={f.vcPhone} onChange={(v) => set('vcPhone', v)} type="tel" inputMode="tel" />
                <TextField label="Email" value={f.vcEmail} onChange={(v) => set('vcEmail', v)} type="email" inputMode="email" />
                <TextField label="Website" value={f.vcUrl} onChange={(v) => set('vcUrl', v)} inputMode="url" className="sm:col-span-2" />
              </div>
            )}

            {type === 'geo' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField label="Latitude" value={f.geoLat} onChange={(v) => set('geoLat', v)} inputMode="decimal" placeholder="48.8584" />
                <TextField label="Longitude" value={f.geoLon} onChange={(v) => set('geoLon', v)} inputMode="decimal" placeholder="2.2945" />
              </div>
            )}

            {'error' in built && <ErrorBanner error={built.error} />}

            {payload && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Encoded text</span>
                  <CopyButton value={payload} size="sm" label="Copy text" />
                </div>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-2xs">
                  {payload.replace(/\r\n/g, '\n')}
                </pre>
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Error correction and format" />
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Error correction" hint={logo ? 'Locked to H while a logo is used' : `Recovers ${EC_INFO[effEcl].recovery} damage`}>
              <Select value={effEcl} onValueChange={(v) => setEcl(v as EcLevel)} disabled={!!logo}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EC_INFO) as EcLevel[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {EC_INFO[k].label} ({EC_INFO[k].recovery})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Minimum version" hint={logo && minVersion < 5 ? 'Raised to 5 to fit the logo' : undefined}>
              <Select value={String(minVersion)} onValueChange={(v) => setMinVersion(Number(v) || 1)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="1">Auto (smallest)</SelectItem>
                  {VERSION_CHOICES.slice(1).map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      Version {v} ({v * 4 + 17}×{v * 4 + 17})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data mode">
              <Select value={modeSel} onValueChange={(v) => setModeSel(v as 'auto' | QrMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (most compact)</SelectItem>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="alphanumeric">Alphanumeric</SelectItem>
                  <SelectItem value="byte">Byte (UTF-8)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="UTF-8 ECI header" hint={canEci ? 'Rarely needed. Only for old scanners that assume Latin-1' : 'Applies to byte mode with non-ASCII text'}>
              <label className="flex h-8 items-center gap-2 text-xs">
                <Switch checked={eci} onCheckedChange={setEci} disabled={!canEci && !eci} />
                {eci ? 'Included' : 'Off'}
              </label>
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Style" />
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Module shape">
              <Tabs value={style} onValueChange={(v) => setStyle(v as ModuleStyle)}>
                <TabsList>
                  <TabsTrigger value="square">Square</TabsTrigger>
                  <TabsTrigger value="rounded">Rounded</TabsTrigger>
                  <TabsTrigger value="dots">Dots</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label={`Size: ${sizePx} px`}>
              <Slider value={[sizePx]} min={128} max={2048} step={16} onValueChange={(v) => setSizePx(v[0] ?? 512)} />
            </Field>
            <Field label={`Quiet zone: ${quiet} modules`}>
              <Slider value={[quiet]} min={0} max={10} step={1} onValueChange={(v) => setQuiet(v[0] ?? 4)} />
            </Field>
            <Field label="Colours">
              <div className="flex items-center gap-2">
                <Input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-8 w-12 p-1" aria-label="Foreground colour" />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  title="Swap foreground and background"
                  aria-label="Swap foreground and background"
                  onClick={() => {
                    setFg(bg);
                    setBg(fg);
                  }}
                >
                  <ArrowLeftRight className="size-3.5" />
                </Button>
                <Input
                  type="color"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className="h-8 w-12 p-1"
                  disabled={transparent}
                  aria-label="Background colour"
                />
              </div>
            </Field>
            <Field label="Background">
              <label className="flex h-8 items-center gap-2 text-xs">
                <Switch checked={transparent} onCheckedChange={setTransparent} />
                {transparent ? 'Transparent' : 'Solid colour'}
              </label>
            </Field>
            <Field label="Centre logo" hint="Forces error correction H. Covers up to about 20% of the code">
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => logoInputRef.current?.click()}>
                  <ImagePlus className="size-3.5" />
                  {logo ? 'Replace' : 'Upload logo'}
                </Button>
                {logo && (
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove logo" title="Remove logo" onClick={() => setLogo(null)}>
                    <X className="size-3.5" />
                  </Button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onLogoFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            </Field>
            {logo && (
              <Field label={`Logo area: ${logoArea}% of code${box ? ` (${box.size}×${box.size} modules)` : ''}`} className="sm:col-span-2 lg:col-span-3">
                <Slider value={[logoArea]} min={4} max={20} step={1} onValueChange={(v) => setLogoArea(v[0] ?? 12)} />
              </Field>
            )}
          </div>
          {logoError && (
            <div className="px-3 pb-3">
              <ErrorBanner error={logoError} />
            </div>
          )}
        </Panel>
      </div>

      {/* ------------------------------------------------------------ right */}
      <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
        <Panel>
          <PanelHeader title="QR code">
            <CopyButton value={() => svgText} label="Copy SVG" disabled={!qr} />
            <DownloadButton
              data={() => svgText}
              filename="qrcode.svg"
              mime="image/svg+xml;charset=utf-8"
              label="SVG"
              disabled={!qr}
            />
            <DownloadButton
              data={async () => {
                if (!qr) return '';
                const c = document.createElement('canvas');
                drawQr(c, qr, drawOpts);
                return canvasToPng(c);
              }}
              filename="qrcode.png"
              mime="image/png"
              label="PNG"
              variant="secondary"
              disabled={!qr}
            />
          </PanelHeader>

          <div className="flex min-h-[260px] items-center justify-center p-4">
            {!deferredPayload && !payload ? (
              <p className="text-center text-sm text-muted-foreground">Enter some content to generate a QR code.</p>
            ) : encoded.error ? (
              <div className="w-full">
                <ErrorBanner error={encoded.error} />
              </div>
            ) : (
              <div
                className="overflow-hidden rounded-md border"
                style={
                  transparent
                    ? {
                        backgroundColor: '#ffffff',
                        backgroundImage:
                          'conic-gradient(#e5e7eb 25%, transparent 0 50%, #e5e7eb 0 75%, transparent 0)',
                        backgroundSize: '16px 16px',
                      }
                    : undefined
                }
              >
                <canvas
                  ref={canvasRef}
                  role="img"
                  aria-label="Generated QR code"
                  className="block h-auto w-full max-w-[340px]"
                />
              </div>
            )}
          </div>

          {qr && (
            <div className="border-t px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-2xs text-muted-foreground">
                <span>Data capacity used</span>
                <span className="font-mono tabular">{usedPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={usedPct > 90 ? 'h-full bg-warning' : 'h-full bg-primary'}
                  style={{ width: `${Math.min(100, usedPct)}%` }}
                />
              </div>
            </div>
          )}

          <StatBar
            className="h-auto min-h-7 py-1"
            items={
              qr
                ? [
                    `Version ${qr.version} (${qr.size}×${qr.size})`,
                    `EC ${qr.ecl} (${EC_INFO[qr.ecl].recovery})`,
                    MODE_LABEL[qr.mode] + (qr.eci ? ' + ECI' : ''),
                    `${qr.charCount} ${qr.mode === 'byte' ? 'bytes' : 'chars'}`,
                    `Mask ${qr.mask}`,
                    drawInfo ? `${drawInfo.px}px · ${drawInfo.mod}px/module` : null,
                    `SVG ${formatBytes(svgText.length)}`,
                  ]
                : ['No code yet']
            }
          />
        </Panel>

        {drawError && <ErrorBanner error={drawError} />}
        {warnings.map((w) => (
          <Warn key={w}>{w}</Warn>
        ))}

        <p className="px-1 text-xs text-muted-foreground">
          Everything is generated in your browser; nothing is uploaded. QR Code is a registered trademark of Denso Wave.
          Always test a printed code with a real phone before distributing it.
        </p>
      </div>
    </div>
  );
}
