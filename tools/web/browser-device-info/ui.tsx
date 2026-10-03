'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fingerprint, RefreshCw } from 'lucide-react';

import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
  CSS_PROBES,
  NA,
  TAILWIND_BREAKPOINTS,
  WASM_BASE_BYTES,
  breakpointFor,
  buildReport,
  estimateRefreshRate,
  reportToJson,
  reportToMarkdown,
  runWasmProbes,
  summaryLine,
  type Feature,
  type RefreshEstimate,
  type Snapshot,
  type Status,
} from './logic';

/* ------------------------------------------------------------------ */
/* Browser reads (all feature-detected, never at module load)            */
/* ------------------------------------------------------------------ */

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function mqSupported(feature: string): boolean {
  return safe(() => window.matchMedia(`(${feature})`).media !== 'not all') ?? false;
}

function pick(feature: string, values: string[]): string | undefined {
  if (!mqSupported(feature)) return undefined;
  for (const v of values) if (safe(() => window.matchMedia(`(${feature}: ${v})`).matches)) return v;
  return 'unknown';
}

function pickAll(feature: string, values: string[]): string[] | undefined {
  if (!mqSupported(feature)) return undefined;
  return values.filter((v) => safe(() => window.matchMedia(`(${feature}: ${v})`).matches));
}

interface NavExtras extends Navigator {
  userAgentData?: {
    brands?: { brand: string; version: string }[];
    mobile?: boolean;
    platform?: string;
    getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
  };
  deviceMemory?: number;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean; addEventListener?: (t: string, cb: () => void) => void; removeEventListener?: (t: string, cb: () => void) => void };
  globalPrivacyControl?: boolean;
}

const PREF_FEATURES: [string, string[]][] = [
  ['prefers-color-scheme', ['dark', 'light', 'no-preference']],
  ['prefers-reduced-motion', ['reduce', 'no-preference']],
  ['prefers-reduced-transparency', ['reduce', 'no-preference']],
  ['prefers-contrast', ['more', 'less', 'custom', 'no-preference']],
  ['prefers-reduced-data', ['reduce', 'no-preference']],
  ['forced-colors', ['active', 'none']],
  ['inverted-colors', ['inverted', 'none']],
];

const MQ_WATCH = [
  '(prefers-color-scheme: dark)',
  '(prefers-reduced-motion: reduce)',
  '(prefers-reduced-transparency: reduce)',
  '(prefers-contrast: more)',
  '(prefers-contrast: less)',
  '(prefers-reduced-data: reduce)',
  '(forced-colors: active)',
  '(inverted-colors: inverted)',
  '(pointer: fine)',
  '(pointer: coarse)',
  '(hover: hover)',
  '(any-pointer: fine)',
  '(any-pointer: coarse)',
  '(display-mode: standalone)',
  '(display-mode: fullscreen)',
  '(dynamic-range: high)',
  '(color-gamut: p3)',
  '(orientation: portrait)',
];

function gatherSync(): Snapshot {
  const nav = navigator as NavExtras;
  const s: Snapshot = {};
  safe(() => {
    s.screenWidth = window.screen.width;
    s.screenHeight = window.screen.height;
    s.availWidth = window.screen.availWidth;
    s.availHeight = window.screen.availHeight;
    s.colorDepth = window.screen.colorDepth;
    s.pixelDepth = window.screen.pixelDepth;
  });
  s.dpr = safe(() => window.devicePixelRatio);
  safe(() => {
    const o = window.screen.orientation;
    if (o) {
      s.orientationType = o.type;
      s.orientationAngle = o.angle;
    }
  });
  safe(() => {
    s.innerWidth = window.innerWidth;
    s.innerHeight = window.innerHeight;
    s.outerWidth = window.outerWidth;
    s.outerHeight = window.outerHeight;
  });
  safe(() => {
    const vv = window.visualViewport;
    if (vv) {
      s.vvWidth = vv.width;
      s.vvHeight = vv.height;
      s.vvScale = vv.scale;
    }
  });
  safe(() => {
    if (mqSupported('color-gamut')) {
      s.gamut = window.matchMedia('(color-gamut: rec2020)').matches
        ? 'rec2020 (wider than P3)'
        : window.matchMedia('(color-gamut: p3)').matches
          ? 'p3 (wider than sRGB)'
          : window.matchMedia('(color-gamut: srgb)').matches
            ? 'srgb'
            : 'unknown';
    }
  });
  s.dynamicRange = pick('dynamic-range', ['high', 'standard']);
  const prefs: Record<string, string | undefined> = {};
  for (const [f, values] of PREF_FEATURES) prefs[f] = pick(f, values);
  s.prefs = prefs;
  s.pointer = pick('pointer', ['fine', 'coarse', 'none']);
  s.hover = pick('hover', ['hover', 'none']);
  s.anyPointer = pickAll('any-pointer', ['fine', 'coarse']);
  s.anyHover = pickAll('any-hover', ['hover']);
  s.maxTouchPoints = safe(() => nav.maxTouchPoints);
  s.displayMode = pick('display-mode', ['fullscreen', 'standalone', 'minimal-ui', 'window-controls-overlay', 'picture-in-picture', 'browser']);

  s.userAgent = safe(() => nav.userAgent);
  safe(() => {
    const d = nav.userAgentData;
    if (d) {
      s.uaBrands = (d.brands ?? []).map((b) => ({ brand: b.brand, version: b.version }));
      s.uaMobile = d.mobile;
      s.uaPlatform = d.platform;
    }
  });
  s.languages = safe(() => (nav.languages && nav.languages.length ? [...nav.languages] : nav.language ? [nav.language] : undefined));
  safe(() => {
    const ro = new Intl.DateTimeFormat().resolvedOptions();
    s.locale = ro.locale;
    s.timeZone = ro.timeZone;
    s.calendar = ro.calendar;
    s.numberingSystem = ro.numberingSystem;
    s.utcOffsetMinutes = -new Date().getTimezoneOffset();
  });
  s.cookiesEnabled = safe(() => nav.cookieEnabled);
  safe(() => {
    if ('doNotTrack' in nav) {
      const v = (nav as unknown as { doNotTrack: string | null }).doNotTrack;
      s.doNotTrack = v === '1' ? '1 (do not track)' : v === '0' ? '0 (tracking allowed)' : null;
    }
  });
  s.gpc = safe(() => nav.globalPrivacyControl);
  s.pdfViewer = safe(() => nav.pdfViewerEnabled);
  s.online = safe(() => nav.onLine);
  s.webdriver = safe(() => nav.webdriver);
  s.cores = safe(() => nav.hardwareConcurrency);
  s.deviceMemory = safe(() => nav.deviceMemory);
  safe(() => {
    const c = nav.connection;
    if (c) s.connection = { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData };
  });
  return s;
}

interface GlInfo {
  webgl: boolean;
  webgl2: boolean;
  vendor?: string;
  renderer?: string;
}

function probeGl(): GlInfo {
  const info: GlInfo = { webgl: false, webgl2: false };
  safe(() => {
    const c1 = document.createElement('canvas');
    const gl = (c1.getContext('webgl') || c1.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      info.webgl = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      info.vendor = String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
      info.renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  });
  safe(() => {
    const gl2 = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
    if (gl2) {
      info.webgl2 = true;
      gl2.getExtension('WEBGL_lose_context')?.loseContext();
    }
  });
  return info;
}

const has = (v: unknown): Status => (v ? 'yes' : 'no');

function staticFeatures(gl: GlInfo): Feature[] {
  const nav = navigator as NavExtras;
  const w = window as unknown as Record<string, unknown>;
  const g = globalThis as unknown as Record<string, unknown>;
  const list: Feature[] = [];
  const add = (group: string, name: string, status: Status, detail?: string): void => void list.push({ group, name, status, detail });

  const wasm = safe(() => typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array(WASM_BASE_BYTES))) ?? false;
  add('WebAssembly', 'WebAssembly', has(wasm));
  const probes = wasm ? (safe(() => runWasmProbes(WebAssembly)) ?? []) : [];
  for (const p of probes) add('WebAssembly', p.name, has(p.supported));

  add('Graphics & media', 'WebGL', has(gl.webgl));
  add('Graphics & media', 'WebGL 2', has(gl.webgl2));
  add('Graphics & media', 'WebGPU', has(safe(() => 'gpu' in nav)), 'navigator.gpu present');
  add('Graphics & media', 'OffscreenCanvas', has(typeof g.OffscreenCanvas !== 'undefined'));
  add('Graphics & media', 'WebCodecs', has(typeof g.VideoDecoder !== 'undefined' && typeof g.VideoEncoder !== 'undefined'));
  add('Graphics & media', 'Web Audio', has(typeof g.AudioContext !== 'undefined' || typeof g.webkitAudioContext !== 'undefined'));
  add('Graphics & media', 'WebRTC', has(typeof g.RTCPeerConnection !== 'undefined'));

  add('Storage & workers', 'Service Worker', has(safe(() => 'serviceWorker' in nav)));
  add('Storage & workers', 'Web Workers', has(typeof g.Worker !== 'undefined'));
  add('Storage & workers', 'SharedArrayBuffer', has(typeof g.SharedArrayBuffer !== 'undefined'));
  add('Storage & workers', 'crossOriginIsolated', has(w.crossOriginIsolated === true));
  add('Storage & workers', 'IndexedDB', has(typeof g.indexedDB !== 'undefined'));
  add('Storage & workers', 'Cache API', has(safe(() => 'caches' in window)));
  add('Storage & workers', 'File System Access', has(safe(() => 'showOpenFilePicker' in window)));
  add('Storage & workers', 'Origin private file system', has(safe(() => typeof navigator.storage?.getDirectory === 'function')));
  add('Storage & workers', 'CompressionStream', has(typeof g.CompressionStream !== 'undefined'));

  add('Platform APIs', 'Web Share', has(safe(() => typeof navigator.share === 'function')));
  add('Platform APIs', 'Clipboard API', has(safe(() => typeof navigator.clipboard?.writeText === 'function')));
  add('Platform APIs', 'Async clipboard (ClipboardItem)', has(typeof g.ClipboardItem !== 'undefined'));
  add('Platform APIs', 'Notifications', has(typeof g.Notification !== 'undefined'), safe(() => `permission: ${Notification.permission}`));
  add('Platform APIs', 'Intl.Segmenter', has(safe(() => typeof Intl.Segmenter === 'function')));
  add('Platform APIs', 'View Transitions', has(safe(() => typeof (document as unknown as { startViewTransition?: unknown }).startViewTransition === 'function')));
  add('Platform APIs', 'Secure context', has(w.isSecureContext === true));

  add('Security & identity', 'WebCrypto (SubtleCrypto)', has(safe(() => typeof crypto.subtle?.digest === 'function')));
  add('Security & identity', 'WebCrypto Ed25519', 'pending');
  add('Security & identity', 'WebCrypto X25519', 'pending');
  add('Security & identity', 'WebAuthn', has(typeof g.PublicKeyCredential !== 'undefined'));
  add('Security & identity', 'Passkeys (platform authenticator)', typeof g.PublicKeyCredential === 'undefined' ? 'no' : 'pending');
  add('Security & identity', 'Passkey autofill (conditional UI)', typeof g.PublicKeyCredential === 'undefined' ? 'no' : 'pending');

  add('Device & I/O', 'Gamepad', has(safe(() => typeof navigator.getGamepads === 'function')));
  add('Device & I/O', 'WebHID', has(safe(() => 'hid' in nav)));
  add('Device & I/O', 'WebUSB', has(safe(() => 'usb' in nav)));
  add('Device & I/O', 'Web Serial', has(safe(() => 'serial' in nav)));
  add('Device & I/O', 'Web Bluetooth', has(safe(() => 'bluetooth' in nav)));
  add('Device & I/O', 'Web MIDI', has(safe(() => 'requestMIDIAccess' in nav)));
  add('Device & I/O', 'Geolocation', has(safe(() => 'geolocation' in nav)));
  add('Device & I/O', 'Screen Wake Lock', has(safe(() => 'wakeLock' in nav)));
  add('Device & I/O', 'Vibration', has(safe(() => typeof navigator.vibrate === 'function')));

  const cssSupports = safe(() => (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' ? CSS.supports.bind(CSS) : null)) ?? null;
  for (const p of CSS_PROBES) {
    const ok = cssSupports ? (safe(() => cssSupports(p.query)) ?? false) : false;
    add('CSS', p.name, has(ok));
  }
  return list;
}

async function measureRefresh(): Promise<RefreshEstimate | null> {
  return new Promise((resolve) => {
    const times: number[] = [];
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve(estimateRefreshRate(times));
    };
    const start = performance.now();
    const step = (t: number): void => {
      if (done) return;
      times.push(t);
      if (t - start >= 1000 || times.length >= 240) finish();
      else requestAnimationFrame(step);
    };
    if (typeof requestAnimationFrame !== 'function') return resolve(null);
    requestAnimationFrame(step);
    window.setTimeout(finish, 2500); // background tabs pause rAF
  });
}

/* ------------------------------------------------------------------ */

function StatusChip({ f }: { f: Feature }) {
  const mark = f.status === 'yes' ? '✓' : f.status === 'no' ? '✗' : '…';
  return (
    <span
      data-testid={`feature-${f.name}`}
      data-status={f.status}
      title={f.detail ?? undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
        f.status === 'yes' && 'border-success/40 bg-success/10',
        f.status === 'no' && 'bg-muted/30 text-muted-foreground',
        f.status === 'pending' && 'bg-muted/30 text-muted-foreground'
      )}
    >
      <span className={cn('w-3 text-center font-semibold', f.status === 'yes' && 'text-success', f.status === 'no' && 'text-destructive')} aria-label={f.status}>
        {mark}
      </span>
      {f.name}
      {f.detail && f.status !== 'no' && <span className="font-mono text-2xs text-muted-foreground">{f.detail}</span>}
    </span>
  );
}

export default function BrowserDeviceInfo() {
  const [sync, setSync] = useState<Snapshot | null>(null);
  const [extra, setExtra] = useState<Snapshot>({});
  const [features, setFeatures] = useState<Feature[]>([]);
  const [redact, setRedact] = useState(false);
  const [measuring, setMeasuring] = useState(false);

  const patchFeature = useCallback((name: string, status: Status, detail?: string) => {
    setFeatures((prev) => prev.map((f) => (f.name === name ? { ...f, status, detail: detail ?? f.detail } : f)));
  }, []);

  const runMeasure = useCallback(async () => {
    setMeasuring(true);
    setExtra((e) => ({ ...e, refresh: undefined }));
    const r = await measureRefresh();
    setExtra((e) => ({ ...e, refresh: r }));
    setMeasuring(false);
  }, []);

  useEffect(() => {
    let alive = true;
    const nav = navigator as NavExtras;
    const refreshStorage = (): void => {
      safe(() => navigator.storage?.estimate?.())
        ?.then((e) => alive && setExtra((x) => ({ ...x, storage: { quota: e.quota, usage: e.usage } })))
        .catch(() => alive && setExtra((x) => ({ ...x, storage: null })));
    };
    const refresh = (): void => {
      if (!alive) return;
      setSync(gatherSync());
      refreshStorage();
    };
    refresh();

    const gl = probeGl();
    setExtra((x) => ({ ...x, gpuVendor: gl.vendor, gpuRenderer: gl.renderer }));
    setFeatures(staticFeatures(gl));

    // High-entropy client hints
    const uad = nav.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === 'function') {
      uad
        .getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList', 'uaFullVersion', 'wow64'])
        .then((v) => alive && setExtra((x) => ({ ...x, uaHigh: v })))
        .catch(() => alive && setExtra((x) => ({ ...x, uaHigh: null })));
    } else {
      setExtra((x) => ({ ...x, uaHigh: null }));
    }

    // Async capability checks
    const subtle = safe(() => crypto.subtle);
    const tryKey = (name: string, algo: string, usages: KeyUsage[]): void => {
      if (!subtle) return patchFeature(name, 'no');
      Promise.resolve()
        .then(() => subtle.generateKey({ name: algo } as Algorithm, false, usages))
        .then(() => alive && patchFeature(name, 'yes'))
        .catch(() => alive && patchFeature(name, 'no'));
    };
    tryKey('WebCrypto Ed25519', 'Ed25519', ['sign', 'verify']);
    tryKey('WebCrypto X25519', 'X25519', ['deriveBits']);
    const PKC = (window as unknown as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>; isConditionalMediationAvailable?: () => Promise<boolean> } }).PublicKeyCredential;
    if (PKC) {
      const run = (name: string, fn: (() => Promise<boolean>) | undefined): void => {
        if (typeof fn !== 'function') return patchFeature(name, 'no');
        Promise.resolve()
          .then(() => fn.call(PKC))
          .then((ok) => alive && patchFeature(name, ok ? 'yes' : 'no'))
          .catch(() => alive && patchFeature(name, 'no'));
      };
      run('Passkeys (platform authenticator)', PKC.isUserVerifyingPlatformAuthenticatorAvailable);
      run('Passkey autofill (conditional UI)', PKC.isConditionalMediationAvailable);
    }

    void runMeasure();

    // Live updates
    let timer = 0;
    const schedule = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 60);
    };
    const cleanups: (() => void)[] = [];
    const listen = (t: EventTarget | null | undefined, type: string): void => {
      if (!t) return;
      t.addEventListener(type, schedule);
      cleanups.push(() => t.removeEventListener(type, schedule));
    };
    listen(window, 'resize');
    listen(window, 'orientationchange');
    listen(window, 'online');
    listen(window, 'offline');
    listen(window, 'languagechange');
    listen(safe(() => window.screen.orientation), 'change');
    listen(safe(() => window.visualViewport), 'resize');
    listen(safe(() => window.visualViewport), 'scroll');
    listen(safe(() => nav.connection as unknown as EventTarget | undefined), 'change');
    for (const q of MQ_WATCH) listen(safe(() => window.matchMedia(q)), 'change');
    let dprMql: MediaQueryList | null = null;
    const onDpr = (): void => {
      schedule();
      armDpr();
    };
    const armDpr = (): void => {
      dprMql?.removeEventListener('change', onDpr);
      dprMql = safe(() => window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)) ?? null;
      dprMql?.addEventListener('change', onDpr);
    };
    armDpr();

    return () => {
      alive = false;
      window.clearTimeout(timer);
      cleanups.forEach((c) => c());
      dprMql?.removeEventListener('change', onDpr);
    };
  }, [patchFeature, runMeasure]);

  const snapshot = useMemo<Snapshot | null>(() => (sync ? { ...sync, ...extra } : null), [sync, extra]);
  const report = useMemo(() => (snapshot ? buildReport(snapshot, features) : null), [snapshot, features]);

  if (!snapshot || !report) {
    return <div className="p-6 text-sm text-muted-foreground">Reading your browser…</div>;
  }

  const bp = snapshot.innerWidth === undefined ? null : breakpointFor(snapshot.innerWidth);
  const sensitiveCount = report.sections.reduce((n, s) => n + s.rows.filter((r) => r.sensitive).length, 0);
  const groups = [...new Set(features.map((f) => f.group))];
  const yes = features.filter((f) => f.status === 'yes').length;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium" data-testid="summary">
              {summaryLine(snapshot) || 'Your browser'}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1" aria-label="Tailwind breakpoints" data-testid="breakpoints">
              {[{ name: 'base', min: 0 }, ...TAILWIND_BREAKPOINTS].map((b) => (
                <span
                  key={b.name}
                  data-active={bp?.name === b.name}
                  className={cn(
                    'rounded-md border px-1.5 py-0.5 font-mono text-2xs',
                    bp?.name === b.name ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground'
                  )}
                >
                  {b.name}
                  {b.min > 0 && <span className="opacity-70"> {b.min}</span>}
                </span>
              ))}
              <span className="ml-2 flex items-center gap-1 text-2xs text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-success" /> live - updates on resize, rotate and setting changes
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <CopyButton value={() => reportToMarkdown(report, { redact })} label="Copy Markdown" variant="secondary" />
            <CopyButton value={() => reportToJson(report, { redact })} label="Copy JSON" variant="secondary" />
            <DownloadButton data={() => reportToJson(report, { redact })} filename="browser-device-report.json" mime="application/json" label="Download JSON" variant="secondary" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Switch id="bd-redact" checked={redact} onCheckedChange={setRedact} />
            <Label htmlFor="bd-redact" className="text-xs">
              Redact fingerprintable values in copied / downloaded reports
            </Label>
          </div>
          <span className="flex items-center gap-1 text-2xs text-muted-foreground">
            <Fingerprint className="size-3.5" />
            {sensitiveCount} rows are tagged: any website can read them without asking, and combined they can help identify your browser. Nothing here leaves your device.
          </span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {report.sections.map((s) => (
          <Panel key={s.id} data-testid={`section-${s.id}`}>
            <PanelHeader title={s.title}>
              {s.id === 'screen' && (
                <Button type="button" variant="ghost" size="sm" onClick={() => void runMeasure()} disabled={measuring} title="Measure the refresh rate again">
                  <RefreshCw className={cn('size-3.5', measuring && 'animate-spin')} /> Re-measure Hz
                </Button>
              )}
            </PanelHeader>
            <dl className="divide-y">
              {s.rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-baseline gap-x-3 px-3 py-1.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                  <dt className="flex items-center gap-1 text-xs text-muted-foreground" title={r.hint}>
                    <span className="truncate">{r.label}</span>
                    {r.sensitive && (
                      <span title="Fingerprintable: any website can read this without asking" className="shrink-0 text-muted-foreground/70">
                        <Fingerprint className="size-3" aria-label="fingerprintable" />
                      </span>
                    )}
                  </dt>
                  <dd
                    className={cn('break-words font-mono text-xs', r.value === NA && 'text-muted-foreground/70')}
                    data-testid={`row-${r.label}`}
                    title={r.hint}
                  >
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHeader title="Feature support">
          <Badge variant="muted">
            {yes} / {features.length} supported
          </Badge>
        </PanelHeader>
        <div className="space-y-3 p-3" data-testid="features">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">{g}</div>
              <div className="flex flex-wrap gap-1.5">
                {features
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <StatusChip key={f.name} f={f} />
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t bg-muted/30 px-3 py-1.5 text-2xs leading-relaxed text-muted-foreground">
          Presence checks only - a ✓ means the API exists, not that permission is granted · Passkey and Ed25519 / X25519 checks run in your browser · Fingerprint-tagged rows are what a site could read silently
        </div>
      </Panel>
    </div>
  );
}
