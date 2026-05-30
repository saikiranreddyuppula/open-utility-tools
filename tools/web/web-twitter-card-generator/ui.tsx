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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Card = 'summary' | 'summary_large_image' | 'app' | 'player';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normHandle(h: string): string {
  const t = h.trim();
  if (!t) return '';
  return t.startsWith('@') ? t : `@${t}`;
}

function metaTag(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeHtml(content)}">`;
}

export default function TwitterCardGeneratorTool() {
  const [card, setCard] = useState<Card>('summary_large_image');
  const [title, setTitle] = useState('How to ship faster with utility tools');
  const [description, setDescription] = useState(
    'A privacy-first toolbox that runs entirely in your browser.',
  );
  const [image, setImage] = useState('https://example.com/preview.png');
  const [imageAlt, setImageAlt] = useState('Screenshot of the toolbox');
  const [site, setSite] = useState('@example');
  const [creator, setCreator] = useState('@jane');

  const [playerUrl, setPlayerUrl] = useState('https://example.com/player.html');
  const [playerW, setPlayerW] = useState('480');
  const [playerH, setPlayerH] = useState('480');

  const tags = useMemo(() => {
    const out: string[] = [metaTag('twitter:card', card)];
    const siteH = normHandle(site);
    const creatorH = normHandle(creator);
    if (siteH) out.push(metaTag('twitter:site', siteH));
    if (creatorH && card !== 'player') out.push(metaTag('twitter:creator', creatorH));

    if (title.trim()) out.push(metaTag('twitter:title', title.trim()));
    if (description.trim() && card !== 'app') {
      out.push(metaTag('twitter:description', description.trim()));
    }

    // Image is valid for summary, summary_large_image, and player.
    if (card !== 'app' && image.trim()) {
      out.push(metaTag('twitter:image', image.trim()));
      if (imageAlt.trim()) out.push(metaTag('twitter:image:alt', imageAlt.trim()));
    }

    if (card === 'player') {
      if (playerUrl.trim()) out.push(metaTag('twitter:player', playerUrl.trim()));
      const w = Number(playerW);
      const h = Number(playerH);
      if (Number.isFinite(w) && w > 0) out.push(metaTag('twitter:player:width', String(Math.round(w))));
      if (Number.isFinite(h) && h > 0) out.push(metaTag('twitter:player:height', String(Math.round(h))));
    }

    if (card === 'app') {
      out.push('<!-- App card: add platform IDs below -->');
      out.push(metaTag('twitter:app:id:iphone', '0000000000'));
      out.push(metaTag('twitter:app:id:googleplay', 'com.example.app'));
      out.push(metaTag('twitter:app:name:iphone', title.trim() || 'App'));
    }

    return out.join('\n');
  }, [card, title, description, image, imageAlt, site, creator, playerUrl, playerW, playerH]);

  const isLarge = card === 'summary_large_image';
  const showImage = card !== 'app';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Card type" className="min-w-[220px]">
            <Select value={card} onValueChange={(v) => setCard(v as Card)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">summary</SelectItem>
                <SelectItem value="summary_large_image">summary_large_image</SelectItem>
                <SelectItem value="app">app</SelectItem>
                <SelectItem value="player">player</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Site @handle" className="min-w-[140px]">
            <Input value={site} onChange={(e) => setSite(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Creator @handle" className="min-w-[140px]">
            <Input
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              className="font-mono"
              disabled={card === 'player'}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <OptionsBar>
          <Field label="Title" className="min-w-[260px] flex-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </OptionsBar>
        {card !== 'app' && (
          <div className="p-3 pt-0">
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                spellCheck={false}
                rows={2}
              />
            </Field>
          </div>
        )}
        {showImage && (
          <OptionsBar className="rounded-none border-0 border-t">
            <Field label="Image URL" className="min-w-[260px] flex-1">
              <Input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Image alt" className="min-w-[200px] flex-1">
              <Input value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />
            </Field>
          </OptionsBar>
        )}
        {card === 'player' && (
          <OptionsBar className="rounded-none border-0 border-t">
            <Field label="Player URL (https)" className="min-w-[260px] flex-1">
              <Input
                value={playerUrl}
                onChange={(e) => setPlayerUrl(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="Width" className="min-w-[100px]">
              <Input
                value={playerW}
                onChange={(e) => setPlayerW(e.target.value)}
                inputMode="numeric"
                className="w-24 font-mono"
              />
            </Field>
            <Field label="Height" className="min-w-[100px]">
              <Input
                value={playerH}
                onChange={(e) => setPlayerH(e.target.value)}
                inputMode="numeric"
                className="w-24 font-mono"
              />
            </Field>
          </OptionsBar>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Card preview" />
        <div className="flex justify-center p-6">
          <div className="w-full max-w-md overflow-hidden rounded-xl border bg-card">
            {showImage && (
              <div
                className={`flex w-full items-center justify-center bg-muted text-2xs text-muted-foreground ${
                  isLarge ? 'aspect-[1.91/1]' : 'aspect-square max-h-32'
                }`}
              >
                {image.trim() ? 'image preview' : 'no image'}
              </div>
            )}
            <div className="space-y-1 p-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                example.com
              </div>
              <div className="font-semibold leading-snug">{title || 'Title'}</div>
              {card !== 'app' && (
                <div className="line-clamp-2 text-sm text-muted-foreground">
                  {description || 'Description'}
                </div>
              )}
              {card === 'player' && (
                <div className="text-2xs text-muted-foreground">▶ embedded player</div>
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Meta tags">
          <CopyButton value={() => tags} />
        </PanelHeader>
        <pre className="max-h-[360px] overflow-auto p-3 font-mono text-xs leading-relaxed">
          {tags}
        </pre>
        <StatBar items={[card, `${tags.split('\n').length} lines`]} />
      </Panel>
    </div>
  );
}
