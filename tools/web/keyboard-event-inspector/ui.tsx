'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Keyboard as KeyboardIcon } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  conditionSnippet,
  detectPlatform,
  displayHotkey,
  keyGlyph,
  keyLiteral,
  layoutRows,
  listenerSnippet,
  locationName,
  modifierString,
  normalizeHotkey,
  playwrightSnippet,
  rowsToJson,
  rowsToMarkdown,
  shortCode,
  type HotkeyPlatform,
  type KeyInfo,
  type LayoutCell,
  type LogRow,
} from './logic';

interface KeyRecord extends KeyInfo {
  keyCode: number;
  which: number;
  charCode: number | null;
  location: number;
  repeat: boolean;
  isComposing: boolean;
  type: string;
}

const STATE_KEYS = ['CapsLock', 'NumLock', 'ScrollLock', 'AltGraph', 'Fn', 'FnLock'] as const;
const MAX_ROWS = 500;
const KEY_EVENTS = ['keydown', 'keyup', 'keypress'] as const;
const INPUT_EVENTS = ['beforeinput', 'compositionstart', 'compositionupdate', 'compositionend'] as const;

type KeyboardWithLayout = { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> };

function Tile({ label, value, testid, copy, note }: { label: string; value: string; testid: string; copy?: boolean; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
        <span className="truncate">{label}</span>
        {note && <span className="rounded bg-muted px-1 normal-case">{note}</span>}
      </div>
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate font-mono text-sm" data-testid={testid} title={value}>
          {value}
        </span>
        {copy && <CopyButton value={value} size="icon-sm" label={`Copy ${label}`} />}
      </div>
    </div>
  );
}

function Chip({ on, children, testid }: { on: boolean; children: React.ReactNode; testid?: string }) {
  return (
    <span
      data-testid={testid}
      data-on={on}
      className={cn(
        'inline-flex h-6 items-center rounded-md border px-2 font-mono text-xs transition-colors',
        on ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}

function CodeBlock({ title, code, testid }: { title: string; code: string; testid?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
        <CopyButton value={code} size="sm" />
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2.5 font-mono text-xs leading-relaxed" data-testid={testid}>
        {code}
      </pre>
    </div>
  );
}

export default function KeyboardEventInspector() {
  const [last, setLast] = useState<KeyRecord | null>(null);
  const [lastUp, setLastUp] = useState<{ code: string; held: number } | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<LogRow[]>([]);
  const [focused, setFocused] = useState(false);
  const [listenWindow, setListenWindow] = useState(false);
  const [prevent, setPrevent] = useState(true);
  const [logRepeats, setLogRepeats] = useState(true);
  const [platformSetting, setPlatformSetting] = useState<'auto' | HotkeyPlatform>('auto');
  const [detected, setDetected] = useState<HotkeyPlatform>('win');
  const [matchBy, setMatchBy] = useState<'code' | 'key'>('code');
  const [crossPlatform, setCrossPlatform] = useState(true);
  const [layout, setLayout] = useState<LayoutCell[][] | 'unsupported' | 'error' | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const imeRef = useRef<HTMLInputElement>(null);
  const preventRef = useRef(prevent);
  const repeatsRef = useRef(logRepeats);
  const counter = useRef(0);
  const t0 = useRef<number | null>(null);
  const downAt = useRef(new Map<string, number>());
  const lastEscape = useRef(0);

  useEffect(() => {
    preventRef.current = prevent;
    repeatsRef.current = logRepeats;
  }, [prevent, logRepeats]);

  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    setDetected(detectPlatform({ uaPlatform: nav.userAgentData?.platform, platform: nav.platform, userAgent: nav.userAgent }));
    const kb = (navigator as Navigator & { keyboard?: KeyboardWithLayout }).keyboard;
    if (!kb || typeof kb.getLayoutMap !== 'function') {
      setLayout('unsupported');
      return;
    }
    let cancelled = false;
    kb.getLayoutMap()
      .then((m) => {
        if (!cancelled) setLayout(layoutRows(m));
      })
      .catch(() => {
        if (!cancelled) setLayout('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addRow = useCallback((e: Event, partial: Omit<LogRow, 'n' | 't' | 'type'>) => {
    if (t0.current === null) t0.current = e.timeStamp;
    counter.current += 1;
    const row: LogRow = { n: counter.current, t: e.timeStamp - t0.current, type: e.type, ...partial };
    setRows((prev) => [row, ...prev].slice(0, MAX_ROWS));
  }, []);

  useEffect(() => {
    const inRegion = (t: EventTarget | null): boolean => {
      if (listenWindow) return true;
      const n = t as Node | null;
      return !!n && (!!areaRef.current?.contains(n) || !!imeRef.current?.contains(n));
    };
    const readStates = (e: KeyboardEvent): Record<string, boolean> => {
      const out: Record<string, boolean> = {};
      for (const k of STATE_KEYS) {
        try {
          out[k] = e.getModifierState(k);
        } catch {
          out[k] = false;
        }
      }
      return out;
    };

    const onKey = (ev: Event): void => {
      const e = ev as KeyboardEvent;
      if (!inRegion(e.target)) return;
      const el = e.target as HTMLElement | null;
      const editable = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (preventRef.current && !editable && e.type !== 'keyup') {
        // Cancelling a keydown suppresses the keypress that follows it, so for plain character keys we
        // cancel the keypress instead; that still stops Space from scrolling and text from being inserted.
        const plainChar = Array.from(e.key).length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        if (e.type === 'keypress' || !plainChar) e.preventDefault();
        // Keep the site's own shortcuts (Ctrl/Cmd+K, "/") from firing while inspecting keys.
        e.stopPropagation();
      }
      if (e.type === 'keydown' && e.key === 'Escape' && preventRef.current && (listenWindow || el === areaRef.current)) {
        // Escape hatch so Tab/Space capture can never trap keyboard users: press Esc twice.
        if (e.timeStamp - lastEscape.current < 700) {
          areaRef.current?.blur();
          if (listenWindow) setPrevent(false);
        }
        lastEscape.current = e.timeStamp;
      }
      setStates(readStates(e));

      if (e.type === 'keypress') {
        setLast((prev) => (prev ? { ...prev, charCode: e.charCode } : prev));
      } else if (e.type === 'keydown') {
        if (!e.repeat) downAt.current.set(e.code, e.timeStamp);
        setHolding(e.code);
        setLast({
          key: e.key,
          code: e.code,
          keyCode: e.keyCode,
          which: e.which,
          charCode: null,
          location: e.location,
          repeat: e.repeat,
          isComposing: e.isComposing,
          type: e.type,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
        });
      } else {
        const start = downAt.current.get(e.code);
        downAt.current.delete(e.code);
        if (start !== undefined) setLastUp({ code: e.code, held: e.timeStamp - start });
        setHolding((h) => (h === e.code ? null : h));
      }

      if (e.repeat && !repeatsRef.current) return;
      addRow(e, {
        key: e.key,
        code: e.code,
        keyCode: e.type === 'keypress' ? e.charCode : e.keyCode,
        mods: modifierString(e),
        repeat: e.repeat || undefined,
        composing: e.isComposing || undefined,
      });
    };

    const onInput = (ev: Event): void => {
      if (!inRegion(ev.target)) return;
      const e = ev as InputEvent;
      const isComp = e.type.startsWith('composition');
      addRow(e, {
        mods: '',
        inputType: isComp ? undefined : e.inputType,
        data: e.data ?? null,
        composing: !isComp ? e.isComposing || undefined : undefined,
      });
    };

    for (const t of KEY_EVENTS) window.addEventListener(t, onKey, true);
    for (const t of INPUT_EVENTS) window.addEventListener(t, onInput, true);
    return () => {
      for (const t of KEY_EVENTS) window.removeEventListener(t, onKey, true);
      for (const t of INPUT_EVENTS) window.removeEventListener(t, onInput, true);
    };
  }, [listenWindow, addRow]);

  const platform: HotkeyPlatform = platformSetting === 'auto' ? detected : platformSetting;
  const hotkey = last ? normalizeHotkey(last, platform) : '';
  const glyph = last ? keyGlyph(last.key) : null;

  const clear = (): void => {
    setRows([]);
    counter.current = 0;
    t0.current = null;
  };

  const snippets = useMemo(() => {
    if (!last) return null;
    const opts = { by: matchBy, crossPlatform } as const;
    return {
      condition: conditionSnippet(last, opts),
      listener: listenerSnippet(last, opts),
      playwright: playwrightSnippet(last),
      mac: displayHotkey(hotkey, 'mac'),
      win: displayHotkey(hotkey, 'win'),
    };
  }, [last, matchBy, crossPlatform, hotkey]);

  const upText = lastUp && last && lastUp.code === last.code ? `keyup · held ${Math.round(lastUp.held)} ms` : holding ? 'holding…' : '';

  return (
    <div className="space-y-4">
      <OptionsBar>
        <div className="flex items-center gap-2">
          <Switch id="kb-window" checked={listenWindow} onCheckedChange={setListenWindow} />
          <Label htmlFor="kb-window" className="text-sm">
            Listen on the whole window
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="kb-prevent" checked={prevent} onCheckedChange={setPrevent} />
          <Label htmlFor="kb-prevent" className="text-sm">
            Prevent default (Tab, Space, Ctrl+K…)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="kb-repeat" checked={logRepeats} onCheckedChange={setLogRepeats} />
          <Label htmlFor="kb-repeat" className="text-sm">
            Log auto-repeat
          </Label>
        </div>
        <Field label="Shortcut style" className="ml-auto w-44">
          <Select value={platformSetting} onValueChange={(v) => setPlatformSetting(v as 'auto' | HotkeyPlatform)}>
            <SelectTrigger className="w-full" aria-label="Platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto ({detected === 'mac' ? 'macOS' : 'Windows / Linux'})</SelectItem>
              <SelectItem value="mac">macOS (Mod = Cmd)</SelectItem>
              <SelectItem value="win">Windows / Linux (Mod = Ctrl)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Last key">
          {upText && <span className="mr-1 font-mono text-2xs text-muted-foreground">{upText}</span>}
          <Badge variant={focused || listenWindow ? 'success' : 'muted'}>{listenWindow ? 'listening on window' : focused ? 'listening' : 'click to focus'}</Badge>
        </PanelHeader>
        <div
          ref={areaRef}
          tabIndex={0}
          role="group"
          aria-label="Key capture area. Focus here and press any key."
          data-testid="capture-area"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            'grid grid-cols-1 gap-4 p-4 outline-none transition-colors md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]',
            focused ? 'bg-primary/5 ring-2 ring-inset ring-primary/40' : 'cursor-pointer'
          )}
        >
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 p-3 text-center">
            {last && glyph ? (
              <>
                <div className="max-w-full truncate font-mono text-6xl font-semibold leading-none" data-testid="key-glyph">
                  {glyph.glyph}
                </div>
                <div className="text-xs text-muted-foreground">{glyph.name}</div>
              </>
            ) : (
              <>
                <KeyboardIcon className="size-8 text-muted-foreground" />
                <div className="text-sm font-medium">Press any key</div>
                <div className="text-xs text-muted-foreground">Click this box first, then type</div>
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <Tile label="event.key" value={last ? keyLiteral(last.key) : '–'} testid="val-key" copy={!!last} />
              <Tile label="event.code" value={last ? keyLiteral(last.code) : '–'} testid="val-code" copy={!!last} />
              <Tile label="event.location" value={last ? `${last.location} (${locationName(last.location)})` : '–'} testid="val-location" />
              <Tile label="keyCode" value={last ? String(last.keyCode) : '–'} testid="val-keycode" note="deprecated" />
              <Tile label="which" value={last ? String(last.which) : '–'} testid="val-which" note="deprecated" />
              <Tile
                label="charCode"
                value={last ? (last.charCode === null ? '– (no keypress)' : String(last.charCode)) : '–'}
                testid="val-charcode"
                note="keypress, deprecated"
              />
              <Tile label="repeat" value={last ? String(last.repeat) : '–'} testid="val-repeat" />
              <Tile label="isComposing" value={last ? String(last.isComposing) : '–'} testid="val-composing" />
              <Tile label="type" value={last ? last.type : '–'} testid="val-type" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5" data-testid="modifier-chips">
              <span className="mr-1 text-2xs uppercase tracking-wide text-muted-foreground">Modifiers</span>
              <Chip on={!!last?.ctrlKey} testid="mod-ctrl">Ctrl</Chip>
              <Chip on={!!last?.shiftKey} testid="mod-shift">Shift</Chip>
              <Chip on={!!last?.altKey} testid="mod-alt">Alt</Chip>
              <Chip on={!!last?.metaKey} testid="mod-meta">Meta</Chip>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" data-testid="state-chips">
              <span className="mr-1 text-2xs uppercase tracking-wide text-muted-foreground">getModifierState</span>
              {STATE_KEYS.map((k) => (
                <Chip key={k} on={!!states[k]} testid={`state-${k}`}>
                  {k}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t bg-muted/30 px-3 py-1.5 text-2xs leading-relaxed text-muted-foreground">
          keyCode, which and charCode are deprecated - prefer key and code · Esc twice releases focus (and turns off Prevent default in window mode)
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Generated snippets" />
          <div className="space-y-3 p-3">
            {snippets && last ? (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Switch id="kb-by" checked={matchBy === 'code'} onCheckedChange={(c) => setMatchBy(c ? 'code' : 'key')} />
                    <Label htmlFor="kb-by" className="text-xs">
                      Match physical key (<code className="font-mono">e.code</code>)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="kb-cross" checked={crossPlatform} onCheckedChange={setCrossPlatform} />
                    <Label htmlFor="kb-cross" className="text-xs">
                      Ctrl or Cmd
                    </Label>
                  </div>
                </div>
                <CodeBlock title="Condition" code={snippets.condition} testid="snippet-condition" />
                <CodeBlock title="Listener" code={snippets.listener} testid="snippet-listener" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Normalised hotkey ({platform === 'mac' ? 'macOS' : 'Win/Linux'})</div>
                    <div className="flex items-center gap-1 rounded-md border bg-muted/30 px-2.5 py-1.5">
                      <code className="flex-1 font-mono text-sm" data-testid="hotkey">
                        {hotkey}
                      </code>
                      <CopyButton value={hotkey} size="icon-sm" label="Copy hotkey" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Display</div>
                    <div className="space-y-0.5 rounded-md border bg-muted/30 px-2.5 py-1.5 font-mono text-sm">
                      <div>
                        <span className="mr-2 text-2xs text-muted-foreground">Mac</span>
                        <span data-testid="display-mac">{snippets.mac}</span>
                      </div>
                      <div>
                        <span className="mr-2 text-2xs text-muted-foreground">Win</span>
                        <span data-testid="display-win">{snippets.win}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <CodeBlock title="Playwright / Puppeteer" code={snippets.playwright} testid="snippet-playwright" />
              </>
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">Press a key combination to generate a handler condition, a normalised hotkey string and a test-runner snippet.</div>
            )}
          </div>
          <StatBar items={['Mod = Cmd on macOS, Ctrl elsewhere', 'Order: Mod+Ctrl+Alt+Shift+Meta+Key']} />
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Text field (beforeinput + IME)" />
            <div className="space-y-2 p-3">
              <Input ref={imeRef} placeholder="Type or compose text here (try an IME, dead keys, emoji picker)…" aria-label="IME test field" data-testid="ime-field" />
              <p className="text-xs text-muted-foreground">
                Logs <code className="font-mono">beforeinput</code> (inputType, data) and <code className="font-mono">composition*</code> events. Key events from this field appear too.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Keyboard layout (navigator.keyboard)" />
            <div className="p-3">
              {layout === null && <div className="text-xs text-muted-foreground">Reading layout…</div>}
              {layout === 'unsupported' && (
                <div className="text-xs text-muted-foreground" data-testid="layout-unsupported">
                  Not available: <code className="font-mono">navigator.keyboard.getLayoutMap()</code> is a Chromium-only API (and needs a secure context).
                </div>
              )}
              {layout === 'error' && <div className="text-xs text-muted-foreground">The browser refused to expose the keyboard layout (permissions policy).</div>}
              {Array.isArray(layout) && (
                <div className="space-y-1 overflow-x-auto pb-1" data-testid="layout-map">
                  {layout.map((row, i) => (
                    <div key={i} className="flex w-max gap-1" style={{ paddingLeft: `${i * 0.9}rem` }}>
                      {row.map((c) => (
                        <div
                          key={c.code}
                          title={c.code}
                          className={cn(
                            'flex h-10 w-8 flex-col items-center justify-center rounded-md border bg-muted/30 leading-none',
                            last?.code === c.code && 'border-primary bg-primary/15'
                          )}
                        >
                          <span className="font-mono text-sm">{c.char ?? '–'}</span>
                          <span className="mt-0.5 text-[9px] text-muted-foreground">{shortCode(c.code).slice(0, 5)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <p className="pt-1 text-2xs text-muted-foreground">Character each physical key (event.code) produces in your current layout; the key you last pressed is highlighted.</p>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader title={`Event log (${rows.length}${rows.length >= MAX_ROWS ? '+' : ''})`}>
          <CopyButton value={() => rowsToJson([...rows].reverse())} label="Copy JSON" disabled={rows.length === 0} />
          <CopyButton value={() => rowsToMarkdown([...rows].reverse())} label="Copy Markdown" disabled={rows.length === 0} />
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={rows.length === 0}>
            <Eraser className="size-3.5" /> Clear
          </Button>
        </PanelHeader>
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left font-mono text-xs" data-testid="log-table">
            <thead className="sticky top-0 bg-muted/80 text-2xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                {['#', 't (ms)', 'event', 'key', 'code', 'keyCode', 'mods', 'flags', 'inputType / data'].map((h) => (
                  <th key={h} className="px-2 py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center font-sans text-sm text-muted-foreground">
                    Events appear here as you type.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.n} className={cn(r.type === 'keyup' && 'text-muted-foreground')}>
                  <td className="px-2 py-1 tabular-nums text-muted-foreground">{r.n}</td>
                  <td className="px-2 py-1 tabular-nums">{r.t.toFixed(1)}</td>
                  <td className="px-2 py-1">{r.type}</td>
                  <td className="max-w-32 truncate px-2 py-1">{r.key === undefined ? '' : keyLiteral(r.key)}</td>
                  <td className="px-2 py-1">{r.code ?? ''}</td>
                  <td className="px-2 py-1 tabular-nums">{r.keyCode ?? ''}</td>
                  <td className="px-2 py-1">{r.mods}</td>
                  <td className="px-2 py-1">{[r.repeat && 'repeat', r.composing && 'composing'].filter(Boolean).join(' ')}</td>
                  <td className="max-w-48 truncate px-2 py-1">{[r.inputType, r.data === undefined || r.data === null ? '' : JSON.stringify(r.data)].filter(Boolean).join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <StatBar items={[`${MAX_ROWS} most recent events kept`, 'newest first']} />
      </Panel>

      <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">What a web page cannot capture:</strong> browsers and operating systems reserve some shortcuts (Ctrl/Cmd+T, W, N, Shift+N, Ctrl+Tab,
        Alt+F4, Cmd+Q, Cmd+Tab, the Windows/Super key, PrintScreen, …). Those never reach the page and <code className="font-mono">preventDefault()</code> cannot cancel them. Chromium&apos;s
        Keyboard Lock API (<code className="font-mono">navigator.keyboard.lock()</code>) can capture some of them, but only in fullscreen. Key events are dispatched to the focused
        element, so click the capture box first - or switch on &quot;Listen on the whole window&quot;.
      </div>
    </div>
  );
}
