'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ViewportPreset = 'responsive' | 'no-scale' | 'cover';

const VIEWPORTS: Record<ViewportPreset, string> = {
  responsive: 'width=device-width, initial-scale=1',
  'no-scale': 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  cover: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function MetaTagsGenerator() {
  const [title, setTitle] = useState('My Awesome Page — Brand Name');
  const [description, setDescription] = useState(
    'A concise, compelling summary of the page that appears in search results and entices clicks.',
  );
  const [canonical, setCanonical] = useState('https://example.com/page');
  const [index, setIndex] = useState(true);
  const [follow, setFollow] = useState(true);
  const [viewport, setViewport] = useState<ViewportPreset>('responsive');
  const [charset, setCharset] = useState('UTF-8');
  const [themeColor, setThemeColor] = useState('#0f172a');
  const [author, setAuthor] = useState('');
  const [keywords, setKeywords] = useState('');
  const [language, setLanguage] = useState('en');
  const [favicon, setFavicon] = useState('/favicon.ico');

  const output = useMemo(() => {
    const lines: string[] = [];
    if (charset.trim()) lines.push(`<meta charset="${escapeHtml(charset.trim())}">`);
    lines.push(
      `<meta name="viewport" content="${escapeHtml(VIEWPORTS[viewport])}">`,
    );
    if (language.trim())
      lines.push(`<meta http-equiv="content-language" content="${escapeHtml(language.trim())}">`);
    if (title.trim()) lines.push(`<title>${escapeHtml(title.trim())}</title>`);
    if (description.trim())
      lines.push(
        `<meta name="description" content="${escapeHtml(description.trim())}">`,
      );
    if (keywords.trim())
      lines.push(`<meta name="keywords" content="${escapeHtml(keywords.trim())}">`);
    if (author.trim())
      lines.push(`<meta name="author" content="${escapeHtml(author.trim())}">`);

    const robots = `${index ? 'index' : 'noindex'}, ${follow ? 'follow' : 'nofollow'}`;
    lines.push(`<meta name="robots" content="${robots}">`);

    if (canonical.trim())
      lines.push(`<link rel="canonical" href="${escapeHtml(canonical.trim())}">`);
    if (themeColor.trim())
      lines.push(`<meta name="theme-color" content="${escapeHtml(themeColor.trim())}">`);
    if (favicon.trim())
      lines.push(`<link rel="icon" href="${escapeHtml(favicon.trim())}">`);

    return lines.join('\n');
  }, [
    charset,
    viewport,
    language,
    title,
    description,
    keywords,
    author,
    index,
    follow,
    canonical,
    themeColor,
    favicon,
  ]);

  const titleLen = title.trim().length;
  const descLen = description.trim().length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Page details" />
        <div className="flex flex-col gap-4 p-3">
          <Field
            label="Title"
            hint={
              <span className={titleLen > 60 ? 'text-amber-600' : ''}>
                {titleLen} chars (recommend ≤ 60)
              </span>
            }
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              spellCheck={false}
            />
          </Field>
          <Field
            label="Description"
            hint={
              <span className={descLen > 160 ? 'text-amber-600' : ''}>
                {descLen} chars (recommend ≤ 160)
              </span>
            }
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              spellCheck={false}
              rows={3}
            />
          </Field>
          <Field label="Canonical URL">
            <Input
              value={canonical}
              onChange={(e) => setCanonical(e.target.value)}
              spellCheck={false}
              className="font-mono text-sm"
            />
          </Field>
          <OptionsBar>
            <Field label="Indexing">
              <div className="flex items-center gap-2">
                <Switch checked={index} onCheckedChange={setIndex} />
                <span className="text-sm">{index ? 'index' : 'noindex'}</span>
              </div>
            </Field>
            <Field label="Following">
              <div className="flex items-center gap-2">
                <Switch checked={follow} onCheckedChange={setFollow} />
                <span className="text-sm">{follow ? 'follow' : 'nofollow'}</span>
              </div>
            </Field>
            <Field label="Viewport">
              <Select
                value={viewport}
                onValueChange={(v) => setViewport(v as ViewportPreset)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsive">responsive</SelectItem>
                  <SelectItem value="no-scale">no zoom</SelectItem>
                  <SelectItem value="cover">notch cover</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </OptionsBar>
          <OptionsBar>
            <Field label="Charset">
              <Input
                value={charset}
                onChange={(e) => setCharset(e.target.value)}
                className="w-28 font-mono"
              />
            </Field>
            <Field label="Theme color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : '#000000'}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded border bg-transparent"
                  aria-label="Theme color"
                />
                <Input
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-24 font-mono"
                />
              </div>
            </Field>
            <Field label="Language">
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-20 font-mono"
              />
            </Field>
          </OptionsBar>
          <OptionsBar>
            <Field label="Author" className="min-w-[160px] flex-1">
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                spellCheck={false}
              />
            </Field>
            <Field label="Favicon path">
              <Input
                value={favicon}
                onChange={(e) => setFavicon(e.target.value)}
                className="w-40 font-mono"
              />
            </Field>
          </OptionsBar>
          <Field label="Keywords (comma separated)">
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              spellCheck={false}
              placeholder="optional"
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="<head> snippet">
          <CopyButton value={() => output} />
        </PanelHeader>
        <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
          {output}
        </pre>
        <StatBar
          items={[
            `title ${titleLen}`,
            `desc ${descLen}`,
            index ? 'indexable' : 'noindex',
          ]}
        />
      </Panel>
    </div>
  );
}
