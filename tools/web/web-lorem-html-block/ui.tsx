'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
  'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum', 'perspiciatis', 'unde',
  'omnis', 'iste', 'natus', 'error', 'voluptatem', 'accusantium', 'doloremque',
  'laudantium', 'totam', 'rem', 'aperiam', 'eaque', 'ipsa', 'quae', 'ab', 'illo',
  'inventore', 'veritatis', 'quasi', 'architecto', 'beatae', 'vitae', 'dicta',
];

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

function pick(rng: () => number): string {
  const i = Math.floor(rng() * WORDS.length);
  return WORDS[i] ?? 'lorem';
}

function cap(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function makeSentence(rng: () => number, words: number): string {
  const parts: string[] = [];
  for (let i = 0; i < words; i++) parts.push(pick(rng));
  let s = parts.join(' ');
  s = cap(s);
  // occasionally add a comma
  return s + '.';
}

export default function LoremHtmlBlockTool() {
  const [blocks, setBlocks] = useState(4);
  const [minWords, setMinWords] = useState(20);
  const [maxWords, setMaxWords] = useState(40);
  const [listItems, setListItems] = useState(4);
  const [seed, setSeed] = useState('42');
  const [includeHeadings, setIncludeHeadings] = useState(true);
  const [includeLists, setIncludeLists] = useState(true);
  const [includeQuote, setIncludeQuote] = useState(true);
  const [includeInline, setIncludeInline] = useState(true);
  const [startCanonical, setStartCanonical] = useState(true);

  const html = useMemo(() => {
    const seedNum = (() => {
      const n = Number(seed);
      if (Number.isFinite(n)) return Math.floor(n);
      // hash string seed
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
      return h;
    })();
    const rng = makeRng(seedNum);
    const lo = Math.max(3, Math.min(minWords, maxWords));
    const hi = Math.max(lo, Math.max(minWords, maxWords));

    const out: string[] = [];
    let first = true;

    const sentences = (count: number): string => {
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const wc = lo + Math.floor(rng() * (hi - lo + 1));
        let s = makeSentence(rng, wc);
        if (first && startCanonical) {
          s = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
          first = false;
        }
        // inline emphasis
        if (includeInline && i === 0) {
          s = s.replace(/(\w+) (\w+)/, '<strong>$1</strong> <em>$2</em>');
        }
        if (includeInline && i === count - 1) {
          s = s.replace(/(\w+)\.$/, '<a href="#">$1</a>.');
        }
        parts.push(s);
      }
      return parts.join(' ');
    };

    for (let b = 0; b < blocks; b++) {
      const r = rng();
      if (includeHeadings && (b === 0 || r < 0.3)) {
        const level = b === 0 ? 2 : rng() < 0.5 ? 2 : 3;
        const words = 3 + Math.floor(rng() * 3);
        const heading = Array.from({ length: words }, () => pick(rng)).map(cap).join(' ');
        out.push(`<h${level}>${heading}</h${level}>`);
      }

      if (includeLists && r >= 0.7 && r < 0.85) {
        const tag = rng() < 0.5 ? 'ul' : 'ol';
        const items: string[] = [];
        for (let i = 0; i < Math.max(1, listItems); i++) {
          const words = 4 + Math.floor(rng() * 5);
          const li = Array.from({ length: words }, () => pick(rng)).join(' ');
          items.push(`  <li>${cap(li)}</li>`);
        }
        out.push(`<${tag}>\n${items.join('\n')}\n</${tag}>`);
        continue;
      }

      if (includeQuote && r >= 0.85) {
        out.push(`<blockquote>\n  <p>${sentences(1)}</p>\n</blockquote>`);
        continue;
      }

      out.push(`<p>${sentences(2 + Math.floor(rng() * 2))}</p>`);
    }

    return out.join('\n');
  }, [
    blocks,
    minWords,
    maxWords,
    listItems,
    seed,
    includeHeadings,
    includeLists,
    includeQuote,
    includeInline,
    startCanonical,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label={`Blocks: ${blocks}`} className="min-w-[200px] flex-1">
              <Slider value={[blocks]} min={1} max={30} step={1} onValueChange={(v) => setBlocks(v[0] ?? 4)} />
            </Field>
            <Field label={`List items: ${listItems}`} className="min-w-[160px]">
              <Slider value={[listItems]} min={1} max={12} step={1} onValueChange={(v) => setListItems(v[0] ?? 4)} />
            </Field>
            <Field label="Seed">
              <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="w-28 font-mono" />
            </Field>
          </OptionsBar>
          <OptionsBar>
            <Field label={`Min words/sentence: ${minWords}`} className="min-w-[200px] flex-1">
              <Slider value={[minWords]} min={3} max={60} step={1} onValueChange={(v) => setMinWords(v[0] ?? 20)} />
            </Field>
            <Field label={`Max words/sentence: ${maxWords}`} className="min-w-[200px] flex-1">
              <Slider value={[maxWords]} min={3} max={80} step={1} onValueChange={(v) => setMaxWords(v[0] ?? 40)} />
            </Field>
          </OptionsBar>
          <OptionsBar>
            <Field label="Headings">
              <Switch checked={includeHeadings} onCheckedChange={setIncludeHeadings} />
            </Field>
            <Field label="Lists">
              <Switch checked={includeLists} onCheckedChange={setIncludeLists} />
            </Field>
            <Field label="Blockquotes">
              <Switch checked={includeQuote} onCheckedChange={setIncludeQuote} />
            </Field>
            <Field label="Inline tags">
              <Switch checked={includeInline} onCheckedChange={setIncludeInline} />
            </Field>
            <Field label="Start canonical">
              <Switch checked={startCanonical} onCheckedChange={setStartCanonical} />
            </Field>
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="HTML">
          <CopyButton value={() => html} label="Copy" />
          <DownloadButton data={() => html} filename="lorem.html" />
        </PanelHeader>
        <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
          {html}
        </pre>
        <StatBar items={[`${blocks} blocks`, `seed ${seed}`, `${html.length} chars`]} />
      </Panel>
    </div>
  );
}
