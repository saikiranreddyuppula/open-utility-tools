/**
 * Pure helpers for the browser & device report: UA parsing, Tailwind breakpoints, refresh-rate
 * estimation, WebAssembly feature probes and report building / formatting.
 * All browser reads happen in the UI; this file only turns plain data into a report.
 */

export const NA = 'Not available';

/* ------------------------------------------------------------------ */
/* User agent parsing                                                   */
/* ------------------------------------------------------------------ */

export interface ParsedUA {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  engine: string;
  device: 'desktop' | 'mobile' | 'tablet';
}

const WINDOWS_NT: Record<string, string> = {
  '10.0': '10 / 11',
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7',
  '6.0': 'Vista',
  '5.1': 'XP',
};

export function parseUserAgent(ua: string): ParsedUA {
  const grab = (re: RegExp): string | null => re.exec(ua)?.slice(1).find((g) => g !== undefined) ?? null;
  let browser = 'Unknown';
  let version = '';
  const tests: [string, RegExp][] = [
    ['Edge', /(?:Edg|EdgA|EdgiOS)\/([\d.]+)/],
    ['Opera', /(?:OPR|OPiOS)\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Vivaldi', /Vivaldi\/([\d.]+)/],
    ['Yandex', /YaBrowser\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari\//],
    ['Internet Explorer', /(?:MSIE |Trident\/.*rv:)([\d.]+)/],
  ];
  for (const [name, re] of tests) {
    const v = grab(re);
    if (v) {
      browser = name;
      version = v;
      break;
    }
  }
  if (browser === 'Unknown' && /Safari\//.test(ua) && /AppleWebKit/.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  let osVersion = '';
  let m: RegExpExecArray | null;
  if ((m = /Windows NT ([\d.]+)/.exec(ua))) {
    os = 'Windows';
    osVersion = WINDOWS_NT[m[1] ?? ''] ?? m[1] ?? '';
  } else if ((m = /Android ([\d.]+)/.exec(ua))) {
    os = 'Android';
    osVersion = m[1] ?? '';
  } else if ((m = /(?:iPhone|iPad|iPod).*? OS ([\d_]+)/.exec(ua))) {
    os = /iPad/.test(ua) ? 'iPadOS' : 'iOS';
    osVersion = (m[1] ?? '').replace(/_/g, '.');
  } else if ((m = /Mac OS X ([\d_.]+)/.exec(ua))) {
    os = 'macOS';
    osVersion = (m[1] ?? '').replace(/_/g, '.');
  } else if (/CrOS/.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux|X11/.test(ua)) {
    os = /Ubuntu/i.test(ua) ? 'Ubuntu (Linux)' : /Fedora/i.test(ua) ? 'Fedora (Linux)' : 'Linux';
  }

  let engine = 'Unknown';
  if (/Trident\/|MSIE /.test(ua)) engine = 'Trident';
  else if (/iPhone|iPad|iPod/.test(ua)) engine = 'WebKit'; // every iOS browser uses WebKit
  else if (/Firefox\//.test(ua)) engine = 'Gecko';
  else if (/AppleWebKit/.test(ua)) engine = /Chrome\/|Chromium\/|Edg|OPR\/|SamsungBrowser|Vivaldi|YaBrowser/.test(ua) ? 'Blink' : 'WebKit';

  let device: ParsedUA['device'] = 'desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) device = 'tablet';
  else if (/Mobi|iPhone|iPod|Android.*Mobile/i.test(ua)) device = 'mobile';

  return { browser, browserVersion: version, os, osVersion, engine, device };
}

export function describeUA(p: ParsedUA): { browser: string; os: string } {
  return {
    browser: p.browser === 'Unknown' ? 'Unknown' : `${p.browser}${p.browserVersion ? ' ' + p.browserVersion : ''}`,
    os: p.os === 'Unknown' ? 'Unknown' : `${p.os}${p.osVersion ? ' ' + p.osVersion : ''}`,
  };
}

/* ------------------------------------------------------------------ */
/* Breakpoints & numbers                                                */
/* ------------------------------------------------------------------ */

/** Tailwind CSS v4 default breakpoints (min-width, CSS px). */
export const TAILWIND_BREAKPOINTS: { name: string; min: number }[] = [
  { name: 'sm', min: 640 },
  { name: 'md', min: 768 },
  { name: 'lg', min: 1024 },
  { name: 'xl', min: 1280 },
  { name: '2xl', min: 1536 },
];

export function breakpointFor(width: number): { name: string; min: number; label: string } {
  let hit = { name: 'base', min: 0 };
  for (const b of TAILWIND_BREAKPOINTS) if (width >= b.min) hit = b;
  return { ...hit, label: hit.name === 'base' ? 'base (below sm, < 640 px)' : `${hit.name} (≥ ${hit.min} px)` };
}

export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? Number.NaN) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

const COMMON_RATES = [24, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 240, 360];

export interface RefreshEstimate {
  /** Measured rate from the median frame interval. */
  hz: number;
  /** Nearest common display rate within 4%, if any. */
  snapped: number | null;
  frames: number;
}

/** Estimate refresh rate from requestAnimationFrame timestamps (ms). Returns null with too few frames. */
export function estimateRefreshRate(frameTimes: number[]): RefreshEstimate | null {
  if (frameTimes.length < 12) return null;
  const deltas: number[] = [];
  for (let i = 1; i < frameTimes.length; i++) deltas.push((frameTimes[i] ?? 0) - (frameTimes[i - 1] ?? 0));
  const med = median(deltas);
  if (!Number.isFinite(med) || med <= 0) return null;
  const hz = 1000 / med;
  const snapped = COMMON_RATES.find((r) => Math.abs(hz - r) / r < 0.04) ?? null;
  return { hz, snapped, frames: frameTimes.length };
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return NA;
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? v : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

/* ------------------------------------------------------------------ */
/* WebAssembly probes (from the wasm-feature-detect project)            */
/* ------------------------------------------------------------------ */

export const WASM_PROBES: { name: string; bytes: number[] }[] = [
  { name: 'WebAssembly SIMD', bytes: [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11] },
  { name: 'WebAssembly threads (atomics)', bytes: [0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11] },
  { name: 'WebAssembly bulk memory', bytes: [0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 3, 1, 0, 1, 10, 14, 1, 12, 0, 65, 0, 65, 0, 65, 0, 252, 10, 0, 0, 11] },
  { name: 'WebAssembly reference types', bytes: [0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 7, 1, 5, 0, 208, 112, 26, 11] },
];

export const WASM_BASE_BYTES = [0, 97, 115, 109, 1, 0, 0, 0];

/** Run each probe module through `WebAssembly.validate` (never throws). */
export function runWasmProbes(wa: { validate(bytes: Uint8Array<ArrayBuffer>): boolean }): { name: string; supported: boolean }[] {
  return WASM_PROBES.map((p) => {
    try {
      return { name: p.name, supported: wa.validate(new Uint8Array(p.bytes)) };
    } catch {
      return { name: p.name, supported: false };
    }
  });
}

/* ------------------------------------------------------------------ */
/* CSS feature probes                                                   */
/* ------------------------------------------------------------------ */

export const CSS_PROBES: { name: string; query: string }[] = [
  { name: 'Container queries', query: 'container-type: inline-size' },
  { name: ':has() selector', query: 'selector(:has(a))' },
  { name: 'Subgrid', query: 'grid-template-columns: subgrid' },
  { name: 'color-mix()', query: 'color: color-mix(in srgb, red, blue)' },
  { name: 'oklch()', query: 'color: oklch(60% 0.2 250)' },
  { name: 'Anchor positioning', query: 'anchor-name: --a' },
  { name: 'light-dark()', query: 'color: light-dark(red, blue)' },
  { name: 'Scroll-driven animations', query: 'animation-timeline: scroll()' },
  { name: 'text-wrap: balance', query: 'text-wrap: balance' },
  { name: 'Dynamic viewport units (dvh)', query: 'height: 100dvh' },
];

/* ------------------------------------------------------------------ */
/* Snapshot -> Report                                                   */
/* ------------------------------------------------------------------ */

export type Status = 'yes' | 'no' | 'pending';

export interface Feature {
  group: string;
  name: string;
  status: Status;
  detail?: string;
}

export interface Row {
  label: string;
  value: string;
  raw?: unknown;
  /** Adds the "fingerprintable" badge: any website can read this without asking. */
  sensitive?: boolean;
  hint?: string;
}

export interface Section {
  id: string;
  title: string;
  rows: Row[];
}

export interface Report {
  generatedAt: string;
  sections: Section[];
  features: Feature[];
}

export interface Snapshot {
  screenWidth?: number;
  screenHeight?: number;
  availWidth?: number;
  availHeight?: number;
  colorDepth?: number;
  pixelDepth?: number;
  dpr?: number;
  orientationType?: string;
  orientationAngle?: number;
  innerWidth?: number;
  innerHeight?: number;
  outerWidth?: number;
  outerHeight?: number;
  vvWidth?: number;
  vvHeight?: number;
  vvScale?: number;
  gamut?: string;
  dynamicRange?: string;
  /** undefined = not measured yet, null = could not be measured. */
  refresh?: RefreshEstimate | null;
  prefs?: Record<string, string | undefined>;
  pointer?: string;
  hover?: string;
  anyPointer?: string[];
  anyHover?: string[];
  maxTouchPoints?: number;
  displayMode?: string;
  userAgent?: string;
  uaBrands?: { brand: string; version: string }[];
  uaMobile?: boolean;
  uaPlatform?: string;
  /** undefined = loading, null = unsupported, object = values. */
  uaHigh?: Record<string, unknown> | null;
  languages?: string[];
  locale?: string;
  timeZone?: string;
  utcOffsetMinutes?: number;
  calendar?: string;
  numberingSystem?: string;
  cookiesEnabled?: boolean;
  doNotTrack?: string | null;
  gpc?: boolean;
  pdfViewer?: boolean;
  online?: boolean;
  webdriver?: boolean;
  cores?: number;
  deviceMemory?: number;
  connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean; type?: string };
  storage?: { quota?: number; usage?: number } | null;
  gpuVendor?: string;
  gpuRenderer?: string;
}

const val = (v: unknown): string => (v === undefined || v === null || v === '' ? NA : String(v));
const dims = (w?: number, h?: number): string => (w === undefined || h === undefined ? NA : `${Math.round(w)} × ${Math.round(h)}`);
const yesNo = (v: boolean | undefined): string => (v === undefined ? NA : v ? 'Yes' : 'No');

function offsetLabel(min: number | undefined): string {
  if (min === undefined) return NA;
  const sign = min >= 0 ? '+' : '-';
  const a = Math.abs(min);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export function buildReport(s: Snapshot, features: Feature[], now: Date = new Date()): Report {
  const prefs = s.prefs ?? {};
  const bp = s.innerWidth === undefined ? undefined : breakpointFor(s.innerWidth);
  const ua = s.userAgent ? parseUserAgent(s.userAgent) : null;
  const uaDesc = ua ? describeUA(ua) : null;

  const refresh =
    s.refresh === undefined
      ? 'Measuring…'
      : s.refresh === null
        ? NA
        : s.refresh.snapped !== null
          ? `${s.refresh.snapped} Hz (measured ${s.refresh.hz.toFixed(1)})`
          : `${s.refresh.hz.toFixed(1)} Hz`;

  const screen: Section = {
    id: 'screen',
    title: 'Screen & display',
    rows: [
      { label: 'Screen size', value: dims(s.screenWidth, s.screenHeight), raw: s.screenWidth === undefined ? null : [s.screenWidth, s.screenHeight], sensitive: true, hint: 'screen.width × screen.height in CSS pixels' },
      { label: 'Available screen', value: dims(s.availWidth, s.availHeight), sensitive: true, hint: 'Screen minus taskbars / docks' },
      { label: 'Color depth', value: s.colorDepth === undefined ? NA : `${s.colorDepth}-bit`, raw: s.colorDepth ?? null, sensitive: true },
      { label: 'Device pixel ratio', value: s.dpr === undefined ? NA : String(+s.dpr.toFixed(3)), raw: s.dpr ?? null, sensitive: true, hint: 'Also changes with browser zoom' },
      {
        label: 'Physical resolution (approx.)',
        value: s.screenWidth === undefined || s.screenHeight === undefined || s.dpr === undefined ? NA : dims(s.screenWidth * s.dpr, s.screenHeight * s.dpr),
        sensitive: true,
        hint: 'CSS pixels × device pixel ratio',
      },
      { label: 'Orientation', value: s.orientationType === undefined ? NA : `${s.orientationType} (${s.orientationAngle ?? 0}°)` },
      { label: 'Window (inner)', value: dims(s.innerWidth, s.innerHeight), sensitive: true, hint: 'Viewport including scrollbars' },
      { label: 'Window (outer)', value: dims(s.outerWidth, s.outerHeight), sensitive: true },
      { label: 'Visual viewport', value: s.vvWidth === undefined ? NA : `${dims(s.vvWidth, s.vvHeight)} · scale ${s.vvScale === undefined ? '1' : +s.vvScale.toFixed(3)}` },
      { label: 'Tailwind breakpoint', value: bp ? bp.label : NA, raw: bp?.name ?? null, hint: 'Based on the inner window width' },
      { label: 'Color gamut', value: s.gamut === undefined ? NA : s.gamut, sensitive: true },
      { label: 'Dynamic range', value: val(s.dynamicRange), hint: 'high = HDR capable display' },
      { label: 'Refresh rate (estimated)', value: refresh, raw: s.refresh ? Math.round(s.refresh.snapped ?? s.refresh.hz) : null, hint: 'Median requestAnimationFrame interval; browsers may cap it' },
    ],
  };

  const preferences: Section = {
    id: 'prefs',
    title: 'Preferences & input',
    rows: [
      { label: 'prefers-color-scheme', value: val(prefs['prefers-color-scheme']) },
      { label: 'prefers-reduced-motion', value: val(prefs['prefers-reduced-motion']), sensitive: true },
      { label: 'prefers-reduced-transparency', value: val(prefs['prefers-reduced-transparency']) },
      { label: 'prefers-contrast', value: val(prefs['prefers-contrast']), sensitive: true },
      { label: 'prefers-reduced-data', value: val(prefs['prefers-reduced-data']) },
      { label: 'forced-colors', value: val(prefs['forced-colors']), sensitive: true },
      { label: 'inverted-colors', value: val(prefs['inverted-colors']) },
      { label: 'Primary pointer', value: val(s.pointer) },
      { label: 'Primary hover', value: val(s.hover) },
      { label: 'Any pointer', value: s.anyPointer ? (s.anyPointer.join(', ') || 'none') : NA },
      { label: 'Any hover', value: s.anyHover ? (s.anyHover.join(', ') || 'none') : NA },
      { label: 'Max touch points', value: val(s.maxTouchPoints), raw: s.maxTouchPoints ?? null, sensitive: true },
      { label: 'Display mode', value: val(s.displayMode) },
    ],
  };

  const brands = s.uaBrands ? s.uaBrands.map((b) => `"${b.brand}" ${b.version}`).join(', ') : undefined;
  const high = s.uaHigh;
  const highVal = (k: string): string => {
    if (high === undefined) return 'Loading…';
    if (high === null) return NA;
    const v = high[k];
    if (v === undefined || v === '' || v === null) return NA;
    if (Array.isArray(v)) return v.map((b: { brand?: string; version?: string }) => `"${b.brand}" ${b.version}`).join(', ');
    return String(v);
  };
  const browser: Section = {
    id: 'browser',
    title: 'Browser',
    rows: [
      { label: 'User agent', value: val(s.userAgent), sensitive: true },
      { label: 'Browser (parsed)', value: uaDesc ? uaDesc.browser : NA, hint: 'Simple pattern match; Chrome freezes the minor version parts' },
      { label: 'OS (parsed)', value: uaDesc ? uaDesc.os : NA, hint: 'macOS and Windows versions are often frozen or ambiguous in the UA string' },
      { label: 'Engine', value: ua ? ua.engine : NA },
      { label: 'Device type', value: ua ? ua.device : NA },
      { label: 'UA-CH brands', value: val(brands), sensitive: true, hint: 'navigator.userAgentData.brands' },
      { label: 'UA-CH mobile', value: yesNo(s.uaMobile) },
      { label: 'UA-CH platform', value: val(s.uaPlatform), sensitive: true },
      { label: 'UA-CH architecture', value: highVal('architecture'), sensitive: true, hint: 'High-entropy hint via getHighEntropyValues()' },
      { label: 'UA-CH bitness', value: highVal('bitness'), sensitive: true },
      { label: 'UA-CH model', value: highVal('model'), sensitive: true },
      { label: 'UA-CH platform version', value: highVal('platformVersion'), sensitive: true },
      { label: 'UA-CH full version list', value: highVal('fullVersionList'), sensitive: true },
      { label: 'Languages', value: s.languages && s.languages.length ? s.languages.join(', ') : NA, raw: s.languages ?? null, sensitive: true, hint: 'navigator.languages, in preference order' },
      { label: 'Intl locale', value: val(s.locale), sensitive: true },
      { label: 'Time zone', value: s.timeZone === undefined ? NA : `${s.timeZone} (${offsetLabel(s.utcOffsetMinutes)})`, raw: s.timeZone ?? null, sensitive: true },
      { label: 'Calendar', value: val(s.calendar) },
      { label: 'Numbering system', value: val(s.numberingSystem) },
      { label: 'Cookies enabled', value: yesNo(s.cookiesEnabled) },
      { label: 'Do Not Track', value: s.doNotTrack === undefined ? NA : s.doNotTrack === null ? 'unset' : s.doNotTrack },
      { label: 'Global Privacy Control', value: s.gpc === undefined ? NA : s.gpc ? 'On (opt-out signal sent)' : 'Off' },
      { label: 'PDF viewer enabled', value: yesNo(s.pdfViewer) },
      { label: 'Online', value: yesNo(s.online) },
      { label: 'Automated (webdriver)', value: yesNo(s.webdriver) },
    ],
  };

  const c = s.connection;
  const hardware: Section = {
    id: 'hardware',
    title: 'Hardware & performance',
    rows: [
      { label: 'Logical CPU cores', value: val(s.cores), raw: s.cores ?? null, sensitive: true, hint: 'navigator.hardwareConcurrency' },
      { label: 'Device memory', value: s.deviceMemory === undefined ? NA : `≥ ${s.deviceMemory} GB`, raw: s.deviceMemory ?? null, sensitive: true, hint: 'Rounded and capped at 8 GB by the browser' },
      { label: 'GPU vendor', value: val(s.gpuVendor), sensitive: true, hint: 'WebGL WEBGL_debug_renderer_info' },
      { label: 'GPU renderer', value: val(s.gpuRenderer), sensitive: true },
      { label: 'Connection type', value: val(c?.effectiveType), sensitive: true, hint: 'navigator.connection.effectiveType' },
      { label: 'Downlink', value: c?.downlink === undefined ? NA : `${c.downlink} Mbps`, sensitive: true },
      { label: 'Round-trip time', value: c?.rtt === undefined ? NA : `${c.rtt} ms`, sensitive: true },
      { label: 'Data saver', value: yesNo(c?.saveData) },
      { label: 'Storage quota', value: s.storage?.quota === undefined ? NA : formatBytes(s.storage.quota), raw: s.storage?.quota ?? null, sensitive: true, hint: 'navigator.storage.estimate()' },
      { label: 'Storage used', value: s.storage?.usage === undefined ? NA : formatBytes(s.storage.usage), raw: s.storage?.usage ?? null },
    ],
  };

  return { generatedAt: now.toISOString(), sections: [screen, preferences, browser, hardware], features };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

export interface FormatOptions {
  /** Replace fingerprint-sensitive values with "[redacted]". */
  redact: boolean;
}

const REDACTED = '[redacted]';
const featureMark = (s: Status): string => (s === 'yes' ? '✓' : s === 'no' ? '✗' : '…');
const mdEscape = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function reportToMarkdown(r: Report, o: FormatOptions = { redact: false }): string {
  const out: string[] = ['# Browser & device report', '', `_Generated ${r.generatedAt}_`, ''];
  for (const s of r.sections) {
    out.push(`## ${s.title}`, '', '| Property | Value |', '|---|---|');
    for (const row of s.rows) out.push(`| ${mdEscape(row.label)} | ${mdEscape(o.redact && row.sensitive && row.value !== NA ? REDACTED : row.value)} |`);
    out.push('');
  }
  out.push('## Feature support', '');
  const groups = [...new Set(r.features.map((f) => f.group))];
  for (const g of groups) {
    out.push(`**${g}**`, '');
    for (const f of r.features.filter((x) => x.group === g)) out.push(`- ${featureMark(f.status)} ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}

export function reportToObject(r: Report, o: FormatOptions = { redact: false }): Record<string, unknown> {
  const sections: Record<string, Record<string, unknown>> = {};
  for (const s of r.sections) {
    const rows: Record<string, unknown> = {};
    for (const row of s.rows) {
      if (o.redact && row.sensitive && row.value !== NA) rows[row.label] = REDACTED;
      else rows[row.label] = row.value === NA ? null : (row.raw ?? row.value);
    }
    sections[s.title] = rows;
  }
  const features: Record<string, boolean | null> = {};
  for (const f of r.features) features[f.name] = f.status === 'pending' ? null : f.status === 'yes';
  return { generatedAt: r.generatedAt, redacted: o.redact, sections, features };
}

export function reportToJson(r: Report, o: FormatOptions = { redact: false }): string {
  return JSON.stringify(reportToObject(r, o), null, 2);
}

/** One-line headline for the top of the page. */
export function summaryLine(s: Snapshot): string {
  const ua = s.userAgent ? describeUA(parseUserAgent(s.userAgent)) : null;
  return [
    ua ? `${ua.browser} on ${ua.os}` : null,
    s.innerWidth !== undefined ? `${Math.round(s.innerWidth)} × ${Math.round(s.innerHeight ?? 0)} viewport` : null,
    s.dpr !== undefined ? `@${+s.dpr.toFixed(2)}x` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
