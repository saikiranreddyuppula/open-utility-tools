'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';

const OG_TYPES = ['website', 'article', 'book', 'profile', 'video.movie', 'music.song'] as const;
const TWITTER_CARDS = ['summary', 'summary_large_image', 'app', 'player'] as const;

type OgType = (typeof OG_TYPES)[number];
type TwitterCard = (typeof TWITTER_CARDS)[number];

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function metaProperty(property: string, content: string): string {
  return `<meta property="${property}" content="${escapeAttr(content)}" />`;
}

function metaName(name: string, content: string): string {
  return `<meta name="${name}" content="${escapeAttr(content)}" />`;
}

export default function OpenGraphGeneratorTool() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState('');
  const [siteName, setSiteName] = useState('');
  const [ogType, setOgType] = useState<OgType>('website');
  const [twitterCard, setTwitterCard] = useState<TwitterCard>('summary_large_image');
  const [twitterSite, setTwitterSite] = useState('');

  const output = useMemo(() => {
    const lines: string[] = [];

    // Standard tags.
    if (title.trim()) lines.push(`<title>${escapeAttr(title.trim())}</title>`);
    if (description.trim()) lines.push(metaName('description', description.trim()));

    // Open Graph.
    lines.push('');
    lines.push('<!-- Open Graph / Facebook -->');
    lines.push(metaProperty('og:type', ogType));
    if (title.trim()) lines.push(metaProperty('og:title', title.trim()));
    if (description.trim()) lines.push(metaProperty('og:description', description.trim()));
    if (url.trim()) lines.push(metaProperty('og:url', url.trim()));
    if (image.trim()) lines.push(metaProperty('og:image', image.trim()));
    if (siteName.trim()) lines.push(metaProperty('og:site_name', siteName.trim()));

    // Twitter.
    lines.push('');
    lines.push('<!-- Twitter -->');
    lines.push(metaName('twitter:card', twitterCard));
    if (twitterSite.trim()) lines.push(metaName('twitter:site', twitterSite.trim()));
    if (title.trim()) lines.push(metaName('twitter:title', title.trim()));
    if (description.trim()) lines.push(metaName('twitter:description', description.trim()));
    if (image.trim()) lines.push(metaName('twitter:image', image.trim()));
    if (url.trim()) lines.push(metaName('twitter:url', url.trim()));

    return lines.join('\n');
  }, [title, description, url, image, siteName, ogType, twitterCard, twitterSite]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Page details" />
        <OptionsBar>
          <Field label="Title" className="w-full">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Page"
            />
          </Field>
          <Field label="Description" className="w-full">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short, compelling summary for social previews."
              className="min-h-[80px] resize-y"
            />
          </Field>
          <Field label="Canonical URL" className="w-full">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
            />
          </Field>
          <Field label="Image URL" className="w-full" hint="Recommended 1200×630px, absolute URL.">
            <Input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://example.com/preview.png"
            />
          </Field>
          <Field label="Site name" className="w-full">
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Example Inc."
            />
          </Field>
          <Field label="OG type">
            <Select value={ogType} onValueChange={(v) => setOgType(v as OgType)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OG_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Twitter card">
            <Select
              value={twitterCard}
              onValueChange={(v) => setTwitterCard(v as TwitterCard)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TWITTER_CARDS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Twitter @site">
            <Input
              value={twitterSite}
              onChange={(e) => setTwitterSite(e.target.value)}
              placeholder="@example"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Meta tags">
          <div className="flex gap-1">
            <CopyButton value={output} />
            <DownloadButton data={output} filename="meta-tags.html" mime="text/html" />
          </div>
        </PanelHeader>
        <Textarea
          value={output}
          readOnly
          className="min-h-[360px] resize-y border-0 bg-muted/20 font-mono text-sm focus-visible:ring-0"
        />
      </Panel>
    </div>
  );
}
