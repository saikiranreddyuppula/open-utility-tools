'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Display = 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
type Orientation = 'any' | 'portrait' | 'landscape' | 'portrait-primary' | 'landscape-primary';
type Purpose = 'any' | 'maskable' | 'monochrome' | 'any maskable';

interface IconRow {
  id: number;
  src: string;
  sizes: string;
  type: string;
  purpose: Purpose;
}

let nextId = 10;

export default function ManifestGeneratorTool() {
  const [name, setName] = useState('My Progressive Web App');
  const [shortName, setShortName] = useState('MyPWA');
  const [description, setDescription] = useState('An installable, offline-capable web app.');
  const [startUrl, setStartUrl] = useState('/');
  const [scope, setScope] = useState('/');
  const [display, setDisplay] = useState<Display>('standalone');
  const [orientation, setOrientation] = useState<Orientation>('any');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [themeColor, setThemeColor] = useState('#0ea5e9');
  const [lang, setLang] = useState('en');
  const [dir, setDir] = useState('ltr');
  const [icons, setIcons] = useState<IconRow[]>([
    { id: 1, src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { id: 2, src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { id: 3, src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);

  const addIcon = () =>
    setIcons((i) => [...i, { id: nextId++, src: '', sizes: '', type: 'image/png', purpose: 'any' }]);

  const { json, warnings } = useMemo(() => {
    const obj: Record<string, unknown> = {};
    const put = (k: string, v: string) => {
      if (v.trim()) obj[k] = v.trim();
    };
    put('name', name);
    put('short_name', shortName);
    put('description', description);
    put('start_url', startUrl);
    put('scope', scope);
    obj['display'] = display;
    if (orientation !== 'any') obj['orientation'] = orientation;
    put('background_color', bgColor);
    put('theme_color', themeColor);
    put('lang', lang);
    if (dir.trim()) obj['dir'] = dir.trim();

    const validIcons = icons
      .filter((ic) => ic.src.trim() && ic.sizes.trim())
      .map((ic) => {
        const o: Record<string, string> = {
          src: ic.src.trim(),
          sizes: ic.sizes.trim(),
        };
        if (ic.type.trim()) o['type'] = ic.type.trim();
        if (ic.purpose !== 'any') o['purpose'] = ic.purpose;
        return o;
      });
    if (validIcons.length > 0) obj['icons'] = validIcons;

    const w: string[] = [];
    if (!name.trim()) w.push('"name" is required.');
    if (!startUrl.trim()) w.push('"start_url" is required.');
    if (validIcons.length === 0) w.push('At least one icon (with src and sizes) is recommended.');
    const has512 = validIcons.some((ic) => /512x512/.test(ic.sizes ?? ''));
    if (validIcons.length > 0 && !has512)
      w.push('Add a 512x512 icon for the best install experience.');

    return { json: JSON.stringify(obj, null, 2), warnings: w };
  }, [name, shortName, description, startUrl, scope, display, orientation, bgColor, themeColor, lang, dir, icons]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Manifest fields" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Name" className="flex-1 min-w-[220px]">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Short name">
              <Input value={shortName} onChange={(e) => setShortName(e.target.value)} className="w-40" />
            </Field>
            <Field label="Language">
              <Input value={lang} onChange={(e) => setLang(e.target.value)} className="w-20 font-mono" />
            </Field>
            <Field label="Direction">
              <Select value={dir} onValueChange={setDir}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ltr">ltr</SelectItem>
                  <SelectItem value="rtl">rtl</SelectItem>
                  <SelectItem value="auto">auto</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Description" className="flex-1 min-w-[260px]">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} spellCheck={false} />
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Start URL">
              <Input value={startUrl} onChange={(e) => setStartUrl(e.target.value)} className="w-40 font-mono" />
            </Field>
            <Field label="Scope">
              <Input value={scope} onChange={(e) => setScope(e.target.value)} className="w-40 font-mono" />
            </Field>
            <Field label="Display">
              <Select value={display} onValueChange={(v) => setDisplay(v as Display)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['standalone', 'fullscreen', 'minimal-ui', 'browser'] as Display[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Orientation">
              <Select value={orientation} onValueChange={(v) => setOrientation(v as Orientation)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    ['any', 'portrait', 'landscape', 'portrait-primary', 'landscape-primary'] as Orientation[]
                  ).map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>

          <OptionsBar>
            <Field label="Background color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(bgColor) ? bgColor : '#ffffff'}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border bg-transparent"
                  aria-label="Background color"
                />
                <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-28 font-mono" />
              </div>
            </Field>
            <Field label="Theme color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '#0ea5e9'}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border bg-transparent"
                  aria-label="Theme color"
                />
                <Input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-28 font-mono" />
              </div>
            </Field>
          </OptionsBar>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Icon src</span>
              <span className="w-28">Sizes</span>
              <span className="w-32">Type</span>
              <span className="w-40">Purpose</span>
              <span className="w-8" />
            </div>
            {icons.map((ic) => (
              <div key={ic.id} className="flex items-center gap-2">
                <Input
                  value={ic.src}
                  onChange={(e) =>
                    setIcons((arr) => arr.map((x) => (x.id === ic.id ? { ...x, src: e.target.value } : x)))
                  }
                  placeholder="/icons/icon.png"
                  className="flex-1 font-mono"
                />
                <Input
                  value={ic.sizes}
                  onChange={(e) =>
                    setIcons((arr) => arr.map((x) => (x.id === ic.id ? { ...x, sizes: e.target.value } : x)))
                  }
                  placeholder="192x192"
                  className="w-28 font-mono"
                />
                <Input
                  value={ic.type}
                  onChange={(e) =>
                    setIcons((arr) => arr.map((x) => (x.id === ic.id ? { ...x, type: e.target.value } : x)))
                  }
                  className="w-32 font-mono"
                />
                <Select
                  value={ic.purpose}
                  onValueChange={(v) =>
                    setIcons((arr) => arr.map((x) => (x.id === ic.id ? { ...x, purpose: v as Purpose } : x)))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['any', 'maskable', 'monochrome', 'any maskable'] as Purpose[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIcons((arr) => arr.filter((x) => x.id !== ic.id))}
                  aria-label="Remove icon"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <div>
              <Button variant="secondary" size="sm" onClick={addIcon}>
                <Plus className="size-3.5" /> Add icon
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      <Panel>
        <PanelHeader title="manifest.json">
          <CopyButton value={() => json} label="Copy" />
          <DownloadButton data={() => json} filename="manifest.json" />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
          {json}
        </pre>
        <StatBar items={[`display: ${display}`, `${icons.filter((i) => i.src.trim()).length} icons`]} />
      </Panel>
    </div>
  );
}
