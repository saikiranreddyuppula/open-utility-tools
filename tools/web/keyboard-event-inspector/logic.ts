/**
 * Pure helpers for the keyboard event inspector: key display mapping, hotkey normalisation,
 * code snippets and log formatting. No DOM access.
 */

export type HotkeyPlatform = 'mac' | 'win';

export interface KeyInfo {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/** Decide Mac vs Windows/Linux conventions from navigator fields (any may be missing). */
export function detectPlatform(info: { uaPlatform?: string; platform?: string; userAgent?: string }): HotkeyPlatform {
  const s = `${info.uaPlatform ?? ''} ${info.platform ?? ''} ${info.userAgent ?? ''}`;
  return /mac|iphone|ipad|ipod/i.test(s) ? 'mac' : 'win';
}

/* ------------------------------------------------------------------ */
/* Key display                                                          */
/* ------------------------------------------------------------------ */

const GLYPHS: Record<string, { glyph: string; name: string }> = {
  ' ': { glyph: '␣', name: 'Space' },
  Enter: { glyph: '⏎', name: 'Enter' },
  Tab: { glyph: '⇥', name: 'Tab' },
  Backspace: { glyph: '⌫', name: 'Backspace' },
  Delete: { glyph: '⌦', name: 'Delete' },
  Escape: { glyph: 'Esc', name: 'Escape' },
  ArrowUp: { glyph: '↑', name: 'Arrow Up' },
  ArrowDown: { glyph: '↓', name: 'Arrow Down' },
  ArrowLeft: { glyph: '←', name: 'Arrow Left' },
  ArrowRight: { glyph: '→', name: 'Arrow Right' },
  Shift: { glyph: '⇧', name: 'Shift' },
  Control: { glyph: 'Ctrl', name: 'Control' },
  Alt: { glyph: '⌥', name: 'Alt / Option' },
  AltGraph: { glyph: 'AltGr', name: 'AltGraph' },
  Meta: { glyph: '⌘', name: 'Meta (Cmd / Win)' },
  CapsLock: { glyph: '⇪', name: 'Caps Lock' },
  NumLock: { glyph: 'Num', name: 'Num Lock' },
  ScrollLock: { glyph: 'ScrLk', name: 'Scroll Lock' },
  ContextMenu: { glyph: '☰', name: 'Context Menu' },
  Home: { glyph: '↖', name: 'Home' },
  End: { glyph: '↘', name: 'End' },
  PageUp: { glyph: 'PgUp', name: 'Page Up' },
  PageDown: { glyph: 'PgDn', name: 'Page Down' },
  Dead: { glyph: '◌', name: 'Dead key (composes the next character)' },
  Unidentified: { glyph: '?', name: 'Unidentified' },
  Process: { glyph: 'IME', name: 'IME processing (Process)' },
  Insert: { glyph: 'Ins', name: 'Insert' },
  PrintScreen: { glyph: 'PrtSc', name: 'Print Screen' },
  Pause: { glyph: 'Pause', name: 'Pause' },
  Clear: { glyph: 'Clear', name: 'Clear' },
};

/** Big, visible representation of `event.key` (space -> ␣, Enter -> ⏎, …). */
export function keyGlyph(key: string): { glyph: string; name: string } {
  const hit = GLYPHS[key];
  if (hit) return hit;
  if (key === '') return { glyph: '∅', name: 'Empty string' };
  if (/^F\d{1,2}$/.test(key)) return { glyph: key, name: `Function key ${key}` };
  if (key === ' ') return { glyph: '⍽', name: 'No-break space' };
  if (Array.from(key).length === 1) {
    const cp = key.codePointAt(0) ?? 0;
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return { glyph: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`, name: 'Control character' };
    return { glyph: key, name: `Character U+${cp.toString(16).toUpperCase().padStart(4, '0')}` };
  }
  return { glyph: key, name: key };
}

/** `event.key` as a code literal, with whitespace and control characters made visible. */
export function keyLiteral(key: string): string {
  return JSON.stringify(key);
}

const LOCATIONS = ['Standard', 'Left', 'Right', 'Numpad'] as const;

export function locationName(location: number): string {
  return LOCATIONS[location] ?? `Unknown (${location})`;
}

/* ------------------------------------------------------------------ */
/* Hotkey strings                                                       */
/* ------------------------------------------------------------------ */

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'OS']);

export function isModifierKey(key: string): boolean {
  return MODIFIER_KEYS.has(key);
}

const PUNCT: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

const SPECIAL_CODES: Record<string, string> = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  CapsLock: 'CapsLock',
  ContextMenu: 'ContextMenu',
  PrintScreen: 'PrintScreen',
  Pause: 'Pause',
};

/** Layout-independent name of the non-modifier key: KeyK -> K, Digit1 -> 1, ArrowUp -> Up, Comma -> `,`. */
export function keyName(k: Pick<KeyInfo, 'key' | 'code'>): string {
  const { code, key } = k;
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1] ?? '';
  m = /^Digit(\d)$/.exec(code);
  if (m) return m[1] ?? '';
  if (code in SPECIAL_CODES) return SPECIAL_CODES[code] ?? code;
  if (code in PUNCT) return PUNCT[code] ?? code;
  if (/^F\d{1,2}$/.test(code) || /^Numpad/.test(code) || /^(Intl|Lang|Media|Browser|Audio|Launch)/.test(code)) return code;
  if (code) return code;
  if (key === ' ') return 'Space';
  if (Array.from(key).length === 1) return key.toUpperCase();
  return key;
}

function modifierList(k: KeyInfo, platform: HotkeyPlatform, useMod: boolean): string[] {
  const out: string[] = [];
  const primary = platform === 'mac' ? k.metaKey : k.ctrlKey;
  if (useMod && primary) out.push('Mod');
  if (k.ctrlKey && !(useMod && platform === 'win')) out.push('Ctrl');
  if (k.altKey) out.push('Alt');
  if (k.shiftKey) out.push('Shift');
  if (k.metaKey && !(useMod && platform === 'mac')) out.push('Meta');
  return out;
}

/**
 * Normalised hotkey string, e.g. `Mod+Shift+K`. `Mod` is Cmd on macOS and Ctrl elsewhere.
 * Modifier order: Mod, Ctrl, Alt, Shift, Meta. Modifier-only presses return the literal modifiers.
 */
export function normalizeHotkey(k: KeyInfo, platform: HotkeyPlatform): string {
  if (isModifierKey(k.key)) return modifierList(k, platform, false).join('+') || k.key;
  return [...modifierList(k, platform, true), keyName(k)].join('+');
}

const MAC_SYMBOLS: Record<string, string> = {
  Mod: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Meta: '⌘',
  Enter: '↩',
  Backspace: '⌫',
  Delete: '⌦',
  Esc: '⎋',
  Tab: '⇥',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Space: '␣',
};

/** Human-readable shortcut for the chosen platform: `⌘⇧K` on macOS, `Ctrl+Shift+K` on Windows/Linux. */
export function displayHotkey(hotkey: string, platform: HotkeyPlatform): string {
  const parts = hotkey.split(/\+(?=.)/);
  if (platform === 'mac') return parts.map((p) => MAC_SYMBOLS[p] ?? p).join('');
  return parts.map((p) => (p === 'Mod' ? 'Ctrl' : p === 'Meta' ? 'Win' : p)).join('+');
}

/* ------------------------------------------------------------------ */
/* Snippets                                                             */
/* ------------------------------------------------------------------ */

export interface SnippetOptions {
  /** `code` = physical key (layout independent), `key` = the produced character. */
  by: 'code' | 'key';
  /** Treat Ctrl and Cmd (Meta) as interchangeable: `(e.ctrlKey || e.metaKey)`. */
  crossPlatform: boolean;
}

function keyTerm(k: KeyInfo, by: 'code' | 'key'): string {
  if (isModifierKey(k.key)) return `e.key === ${quote(k.key)}`;
  if (by === 'code' && k.code) return `e.code === ${quote(k.code)}`;
  if (Array.from(k.key).length === 1 && /\p{L}/u.test(k.key)) return `e.key.toLowerCase() === ${quote(k.key.toLowerCase())}`;
  return `e.key === ${quote(k.key)}`;
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`;
}

/** Boolean JS expression matching this exact key combination. */
export function conditionSnippet(k: KeyInfo, opts: SnippetOptions): string {
  const terms: string[] = [keyTerm(k, opts.by)];
  const selfMod = (name: string): boolean => k.key === name;
  if (opts.crossPlatform) {
    if (k.ctrlKey && k.metaKey) terms.push('e.ctrlKey', 'e.metaKey');
    else if (k.ctrlKey || k.metaKey) terms.push('(e.ctrlKey || e.metaKey)');
    else terms.push('!e.ctrlKey', '!e.metaKey');
  } else {
    terms.push(k.ctrlKey ? 'e.ctrlKey' : '!e.ctrlKey', k.metaKey ? 'e.metaKey' : '!e.metaKey');
  }
  terms.push(k.shiftKey ? 'e.shiftKey' : '!e.shiftKey', k.altKey ? 'e.altKey' : '!e.altKey');
  // When the pressed key *is* a modifier, its own flag is implied by the e.key test.
  const implied = new Set<string>();
  if (selfMod('Control')) implied.add('e.ctrlKey').add('(e.ctrlKey || e.metaKey)');
  if (selfMod('Shift')) implied.add('e.shiftKey');
  if (selfMod('Alt')) implied.add('e.altKey');
  if (selfMod('Meta')) implied.add('e.metaKey').add('(e.ctrlKey || e.metaKey)');
  return terms.filter((t) => !implied.has(t)).join(' && ');
}

/** A ready-to-paste keydown listener using the condition. */
export function listenerSnippet(k: KeyInfo, opts: SnippetOptions): string {
  return [
    "window.addEventListener('keydown', (e) => {",
    `  if (${conditionSnippet(k, opts)}) {`,
    '    e.preventDefault();',
    '    // …handle the shortcut',
    '  }',
    '});',
  ].join('\n');
}

/** Playwright / Puppeteer `keyboard.press` argument for this combination. */
export function playwrightSnippet(k: KeyInfo): string {
  const mods: string[] = [];
  if (k.ctrlKey) mods.push('Control');
  if (k.altKey) mods.push('Alt');
  if (k.shiftKey) mods.push('Shift');
  if (k.metaKey) mods.push('Meta');
  const base = isModifierKey(k.key) ? (k.key === 'AltGraph' ? 'AltGraph' : k.key) : k.code || (k.key === ' ' ? 'Space' : k.key);
  const own = isModifierKey(k.key) ? [k.key] : [];
  const parts = [...mods.filter((m) => !own.includes(m)), base];
  return `await page.keyboard.press('${parts.join('+')}');`;
}

/* ------------------------------------------------------------------ */
/* Event log                                                            */
/* ------------------------------------------------------------------ */

export interface LogRow {
  n: number;
  /** Milliseconds since the first logged event. */
  t: number;
  type: string;
  key?: string;
  code?: string;
  keyCode?: number;
  mods: string;
  repeat?: boolean;
  composing?: boolean;
  inputType?: string;
  data?: string | null;
}

export function modifierString(k: Pick<KeyInfo, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>): string {
  return [k.ctrlKey && 'Ctrl', k.altKey && 'Alt', k.shiftKey && 'Shift', k.metaKey && 'Meta'].filter(Boolean).join('+');
}

export function rowsToJson(rows: LogRow[]): string {
  return JSON.stringify(rows, null, 2);
}

const mdCell = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '';
  const s = typeof v === 'string' ? JSON.stringify(v) : String(v);
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
};

export function rowsToMarkdown(rows: LogRow[]): string {
  const head = '| # | t (ms) | event | key | code | keyCode | modifiers | repeat | composing | inputType | data |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|---|';
  const body = rows.map((r) =>
    [r.n, r.t.toFixed(1), r.type, mdCell(r.key), mdCell(r.code), mdCell(r.keyCode), mdCell(r.mods), r.repeat ? 'yes' : '', r.composing ? 'yes' : '', mdCell(r.inputType), mdCell(r.data)]
      .join(' | ')
      .replace(/^/, '| ')
      .replace(/$/, ' |')
  );
  return [head, sep, ...body].join('\n');
}

/* ------------------------------------------------------------------ */
/* Keyboard layout map                                                  */
/* ------------------------------------------------------------------ */

export const LAYOUT_ROWS: string[][] = [
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
  ['IntlBackslash', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
];

export interface LayoutCell {
  code: string;
  char: string | null;
}

/** Rows of `code -> character` for the current layout (IntlBackslash only if the layout has it). */
export function layoutRows(map: { get(code: string): string | undefined }): LayoutCell[][] {
  return LAYOUT_ROWS.map((row) =>
    row
      .filter((code) => code !== 'IntlBackslash' || map.get(code) !== undefined)
      .map((code) => ({ code, char: map.get(code) ?? null }))
  );
}

export function shortCode(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}
