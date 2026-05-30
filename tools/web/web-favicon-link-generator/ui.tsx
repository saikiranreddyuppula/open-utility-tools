'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface Toggle {
  key: string;
  label: string;
}

const TOGGLES: Toggle[] = [
  { key: 'ico', label: 'Classic favicon.ico' },
  { key: 'png', label: 'PNG 16 / 32 / 48' },
  { key: 'apple', label: 'Apple touch icon (180)' },
  { key: 'android', label: 'Android / maskable (192 / 512)' },
  { key: 'manifest', label: 'Web app manifest link' },
  { key: 'mstile', label: 'Microsoft tile (browserconfig)' },
];

/** Join a path prefix and a filename, normalizing slashes. */
function joinPath(prefix: string, file: string): string {
  const p = prefix.trim();
  if (p === '') return `/${file}`;
  const noTrail = p.replace(/\/+$/, '');
  return `${noTrail}/${file}`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export default function FaviconLinkGeneratorTool() {
  const [prefix, setPrefix] = useState('/icons');
  const [themeColor, setThemeColor] = useState('#0f172a');
  const [tileColor, setTileColor] = useState('#0f172a');
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    ico: true,
    png: true,
    apple: true,
    android: true,
    manifest: true,
    mstile: true,
  });

  const toggle = (key: string) =>
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

  const html = useMemo(() => {
    const lines: string[] = [];
    const on = (k: string) => enabled[k] === true;

    if (on('ico')) {
      lines.push(`<link rel="icon" href="${escapeAttr(joinPath(prefix, 'favicon.ico'))}" sizes="any">`);
    }
    if (on('png')) {
      for (const sz of [16, 32, 48]) {
        lines.push(
          `<link rel="icon" type="image/png" sizes="${sz}x${sz}" href="${escapeAttr(
            joinPath(prefix, `favicon-${sz}x${sz}.png`),
          )}">`,
        );
      }
    }
    if (on('apple')) {
      lines.push(
        `<link rel="apple-touch-icon" sizes="180x180" href="${escapeAttr(
          joinPath(prefix, 'apple-touch-icon.png'),
        )}">`,
      );
    }
    if (on('android')) {
      lines.push(
        `<link rel="icon" type="image/png" sizes="192x192" href="${escapeAttr(
          joinPath(prefix, 'android-chrome-192x192.png'),
        )}">`,
      );
      lines.push(
        `<link rel="icon" type="image/png" sizes="512x512" href="${escapeAttr(
          joinPath(prefix, 'android-chrome-512x512.png'),
        )}">`,
      );
      lines.push(
        `<link rel="mask-icon" href="${escapeAttr(
          joinPath(prefix, 'safari-pinned-tab.svg'),
        )}" color="${escapeAttr(themeColor)}">`,
      );
    }
    if (on('manifest')) {
      lines.push(`<link rel="manifest" href="${escapeAttr(joinPath(prefix, 'site.webmanifest'))}">`);
    }
    lines.push(`<meta name="theme-color" content="${escapeAttr(themeColor)}">`);
    if (on('mstile')) {
      lines.push(
        `<meta name="msapplication-TileColor" content="${escapeAttr(tileColor)}">`,
      );
      lines.push(
        `<meta name="msapplication-config" content="${escapeAttr(
          joinPath(prefix, 'browserconfig.xml'),
        )}">`,
      );
    }
    return lines.join('\n');
  }, [prefix, themeColor, tileColor, enabled]);

  const enabledCount = TOGGLES.filter((t) => enabled[t.key] === true).length;

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Icon path prefix" className="min-w-[220px]">
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                spellCheck={false}
                placeholder="/icons"
                className="font-mono"
              />
            </Field>
            <Field label="Theme color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '#000000'}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  aria-label="Theme color"
                />
                <Input
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-28 font-mono"
                  spellCheck={false}
                />
              </div>
            </Field>
            <Field label="Tile color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(tileColor) ? tileColor : '#000000'}
                  onChange={(e) => setTileColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                  aria-label="Tile color"
                />
                <Input
                  value={tileColor}
                  onChange={(e) => setTileColor(e.target.value)}
                  className="w-28 font-mono"
                  spellCheck={false}
                />
              </div>
            </Field>
          </OptionsBar>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <Switch
                  id={`fav-${t.key}`}
                  checked={enabled[t.key] === true}
                  onCheckedChange={() => toggle(t.key)}
                />
                <Label htmlFor={`fav-${t.key}`} className="text-sm">
                  {t.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="HTML link tags">
          <CopyButton value={() => html} />
        </PanelHeader>
        <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-xs">
          {html}
        </pre>
        <StatBar
          items={[`${html.split('\n').length} tags`, `${enabledCount} platform group(s)`]}
        />
      </Panel>
    </div>
  );
}
