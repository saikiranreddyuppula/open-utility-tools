'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Crosshair, Eraser, Eye } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { cn } from '@/lib/utils';

import {
  MAX_NODES,
  QueryError,
  autoNamespaceText,
  collectNamespaces,
  collectNamespacesFromText,
  describeNode,
  detectDocType,
  evaluateCss,
  evaluateXPath,
  makeResolver,
  parseNamespaceText,
  parseXmlErrorText,
  prettyPrintDoc,
  resultsToCsv,
  resultsToJson,
  sourceFrame,
  type CssDocLike,
  type DocKind,
  type NodeInfo,
  type NodeLike,
  type NsDecl,
  type ParseIssue,
  type PrettyLine,
  type QueryOutcome,
  type SegClass,
  type XPathDocLike,
} from './logic';

type Mode = 'xpath' | 'css';
type DocChoice = 'auto' | 'xml' | 'html';
type DocView = 'source' | 'view';

const MAX_DESCRIBE = 1500;
const PAGE = 100;
const MAX_INPUT = 1_500_000;

interface Sample {
  id: string;
  label: string;
  text: string;
  xpath: string[];
  css: string[];
}

const BOOKSTORE = `<?xml version="1.0" encoding="UTF-8"?>
<bookstore>
  <book category="cooking">
    <title lang="en">Everyday Italian</title>
    <author>Giada De Laurentiis</author>
    <year>2005</year>
    <price>30.00</price>
  </book>
  <book category="children">
    <title lang="en">Harry Potter</title>
    <author>J K. Rowling</author>
    <year>2005</year>
    <price>29.99</price>
  </book>
  <book category="web">
    <title lang="en">XQuery Kick Start</title>
    <author>James McGovern</author>
    <author>Per Bothner</author>
    <author>Kurt Cagle</author>
    <year>2003</year>
    <price>49.99</price>
  </book>
  <book category="web" cover="paperback">
    <title lang="en">Learning XML</title>
    <author>Erik T. Ray</author>
    <year>2003</year>
    <price>39.95</price>
  </book>
</bookstore>
`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Example Feed</title>
  <link href="http://example.org/" rel="alternate"/>
  <updated>2024-05-01T12:00:00Z</updated>
  <entry>
    <title>Atom-Powered Robots Run Amok</title>
    <link href="http://example.org/2024/05/robots" rel="alternate"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
    <updated>2024-05-01T12:00:00Z</updated>
    <media:thumbnail url="http://example.org/robots.png" width="640"/>
  </entry>
  <entry>
    <title>Second Post</title>
    <link href="http://example.org/2024/04/second" rel="alternate"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6b</id>
    <updated>2024-04-20T08:30:00Z</updated>
  </entry>
</feed>
`;

const SHOP = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Gadget Shop</title>
</head>
<body>
  <nav>
    <ul id="menu">
      <li class="active"><a href="/">Home</a></li>
      <li><a href="/products">Products</a></li>
      <li><a href="https://blog.example.com">Blog</a></li>
    </ul>
  </nav>
  <main>
    <div class="banner"><p class="promo">Free shipping on orders over $50</p></div>
    <div class="product" data-id="101">
      <h2>Mechanical Keyboard</h2>
      <img src="/img/kb.jpg" alt="Keyboard">
      <p class="desc">Hot-swappable switches, <b>RGB</b> lighting.</p>
      <span class="price">$89.00</span>
    </div>
    <div class="product sale" data-id="102">
      <h2>USB-C Hub</h2>
      <img src="/img/hub.jpg" alt="Hub">
      <p class="desc">7-in-1 hub with HDMI.</p>
      <span class="price">$39.50</span>
    </div>
    <div class="product" data-id="103">
      <h2>Webcam</h2>
      <p class="desc">1080p with privacy shutter.</p>
      <span class="price">$54.90</span>
    </div>
  </main>
</body>
</html>
`;

const SAMPLES: Sample[] = [
  {
    id: 'bookstore',
    label: 'Bookstore (XML)',
    text: BOOKSTORE,
    xpath: ['//book[price>35]/title', 'count(//book)', '//book/@category', "//title[@lang='en']/text()", 'sum(//price)', '//book[last()]/title', "//book[author='James McGovern']", '//book[count(author)>1]'],
    css: ['book > title', 'book[category="web"]', 'book:nth-of-type(2) price', 'title[lang]'],
  },
  {
    id: 'atom',
    label: 'Atom feed (namespaces)',
    text: ATOM,
    xpath: ['//d:entry/d:title', '//d:link/@href', '//media:thumbnail/@url', 'count(//d:entry)', "//*[local-name()='entry']/*[local-name()='id']"],
    css: ['entry > title', 'link[rel="alternate"]', 'thumbnail'],
  },
  {
    id: 'shop',
    label: 'Product page (HTML)',
    text: SHOP,
    xpath: ['//a/@href', "//div[contains(@class,'product')]//span[@class='price']", "//li[contains(@class,'active')]/a", '//img/@alt', '//div[@data-id]/h2/text()', "//a[starts-with(@href,'https')]"],
    css: ['div > p:first-child', '[data-id]', 'a[href^="https"]', 'li:nth-child(2n+1) > a', '.product.sale h2', 'ul#menu li:first-child'],
  },
];

const XPATH_CHEATS: { expr: string; hint: string }[] = [
  { expr: '//a/@href', hint: 'All link targets' },
  { expr: 'count(//item)', hint: 'Number of items' },
  { expr: '//book[price>35]/title', hint: 'Filter on a child value' },
  { expr: '//*[@id]', hint: 'Any element with an id' },
  { expr: "//div[@class='x']", hint: 'Exact attribute match' },
  { expr: "//*[contains(@class,'btn')]", hint: 'Class contains' },
  { expr: '(//li)[last()]', hint: 'Last of all matches' },
  { expr: '//li[position()<=3]', hint: 'First three' },
  { expr: '//p/text()', hint: 'Text nodes' },
  { expr: 'string(//title)', hint: 'First title as a string' },
  { expr: "normalize-space(//h1)", hint: 'Collapse whitespace' },
  { expr: '//a[not(@href)]', hint: 'Anchors without href' },
  { expr: '//td[1] | //th[1]', hint: 'Union of two paths' },
  { expr: '//h2/following-sibling::p[1]', hint: 'Axis: next sibling' },
  { expr: '//span/ancestor::div[1]', hint: 'Axis: nearest ancestor' },
  { expr: "//*[local-name()='entry']", hint: 'Ignore namespaces' },
];

const CSS_CHEATS: { expr: string; hint: string }[] = [
  { expr: 'div > p:first-child', hint: 'First-child paragraphs directly in a div' },
  { expr: '[data-id]', hint: 'Has attribute' },
  { expr: 'a[href^="http"]', hint: 'Attribute starts with' },
  { expr: 'a[href$=".pdf"]', hint: 'Attribute ends with' },
  { expr: 'img[alt*="logo" i]', hint: 'Contains, case-insensitive' },
  { expr: 'li:nth-child(2n+1)', hint: 'Odd items' },
  { expr: 'ul > li:last-child', hint: 'Last item' },
  { expr: 'p:not(.note)', hint: 'Negation' },
  { expr: 'h1, h2, h3', hint: 'Several selectors' },
  { expr: 'label + input', hint: 'Adjacent sibling' },
  { expr: 'h2 ~ p', hint: 'General sibling' },
  { expr: 'div:has(> img)', hint: 'Parent selector' },
  { expr: ':is(h1,h2) > a', hint: 'Matches any of' },
  { expr: 'td:empty', hint: 'Empty elements' },
];

interface Parsed {
  doc: Document;
  kind: DocKind;
  issue: ParseIssue | null;
  frame: string | null;
  decls: NsDecl[];
}

function parseDocument(text: string, choice: DocChoice): Parsed {
  const kind: DocKind = choice === 'auto' ? detectDocType(text) : choice;
  const doc = new DOMParser().parseFromString(text, kind === 'xml' ? 'application/xml' : 'text/html');
  let issue: ParseIssue | null = null;
  if (kind === 'xml') {
    const err = doc.getElementsByTagName('parsererror')[0] ?? doc.getElementsByTagNameNS('*', 'parsererror')[0];
    if (err) issue = parseXmlErrorText(err.textContent ?? '');
  }
  const decls = kind === 'xml' ? (issue ? collectNamespacesFromText(text) : collectNamespaces(doc as unknown as NodeLike)) : [];
  return { doc, kind, issue, frame: issue ? sourceFrame(text, issue.line, issue.column) : null, decls };
}

interface Evaluation {
  outcome: QueryOutcome | null;
  error: QueryError | null;
  infos: NodeInfo[];
  nsProblems: string[];
}

function evaluate(p: Parsed, mode: Mode, query: string, nsText: string, normalize: boolean): Evaluation {
  const { map, problems } = parseNamespaceText(nsText);
  if (!query.trim()) return { outcome: null, error: null, infos: [], nsProblems: problems };
  try {
    const outcome =
      mode === 'xpath'
        ? evaluateXPath(p.doc as unknown as XPathDocLike, query, makeResolver(map))
        : evaluateCss(p.doc as unknown as CssDocLike, query);
    if (outcome.kind !== 'nodes') return { outcome, error: null, infos: [], nsProblems: problems };
    const prefixByUri = new Map<string, string>();
    for (const [prefix, uri] of map) if (!prefixByUri.has(uri)) prefixByUri.set(uri, prefix);
    const countId = (id: string): number => {
      try {
        return p.doc.querySelectorAll(`[id="${id.replace(/["\\]/g, '\\$&')}"]`).length;
      } catch {
        return 0;
      }
    };
    const infos = outcome.nodes
      .slice(0, MAX_DESCRIBE)
      .map((n) => describeNode(n, { html: p.kind === 'html', prefixByUri, countId, normalizeWhitespace: normalize }));
    return { outcome, error: null, infos, nsProblems: problems };
  } catch (e) {
    return {
      outcome: null,
      error: e instanceof QueryError ? e : new QueryError(e instanceof Error ? e.message : String(e)),
      infos: [],
      nsProblems: problems,
    };
  }
}

const SEG_CLASS: Record<SegClass, string> = {
  punct: 'text-muted-foreground',
  tag: 'text-sky-700 dark:text-sky-300',
  attr: 'text-amber-700 dark:text-amber-300',
  val: 'text-emerald-700 dark:text-emerald-300',
  text: 'text-foreground',
  comment: 'text-muted-foreground italic',
  pi: 'text-fuchsia-700 dark:text-fuchsia-300',
  cdata: 'text-teal-700 dark:text-teal-300',
  doctype: 'text-muted-foreground',
};

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function ResultCard({ index, info, onShow }: { index: number; info: NodeInfo; onShow: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const longMarkup = info.markup.length > 300;
  const longText = info.text.length > 240;
  return (
    <div className="space-y-2 px-3 py-2.5 text-sm" data-testid="result-card" data-index={index}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
        <Badge variant="secondary" className="font-mono text-[10px] uppercase">
          {info.kind === 'processing-instruction' ? 'pi' : info.kind}
        </Badge>
        <span className="font-mono text-xs font-semibold">
          {info.kind === 'element' ? `<${info.name}>` : info.kind === 'attribute' ? `@${info.name}` : info.name}
        </span>
        <Button variant="ghost" size="sm" className="ml-auto h-6 px-1.5 text-xs" onClick={() => onShow(index)} title="Scroll to this match in the highlighted document">
          <Eye className="size-3" /> Show
        </Button>
      </div>
      <div className="grid gap-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-9 shrink-0 text-muted-foreground">XPath</span>
          <code className="min-w-0 flex-1 break-all font-mono" data-testid="result-xpath">{info.xpath}</code>
          <CopyButton value={info.xpath} size="icon-sm" label="Copy XPath" />
        </div>
        {info.css && (
          <div className="flex items-center gap-1.5">
            <span className="w-9 shrink-0 text-muted-foreground">CSS</span>
            <code className="min-w-0 flex-1 break-all font-mono" data-testid="result-css">{info.css}</code>
            <CopyButton value={info.css} size="icon-sm" label="Copy CSS path" />
          </div>
        )}
      </div>
      {info.text !== '' && (
        <div className="rounded border bg-muted/30 px-2 py-1 font-mono text-xs">
          <span className="text-muted-foreground">{info.kind === 'attribute' ? 'value ' : 'text '}</span>
          <span data-testid="result-text" className="whitespace-pre-wrap break-words">{open || !longText ? info.text : truncate(info.text, 240)}</span>
        </div>
      )}
      {info.attrs.length > 0 && (
        <table className="w-full border-collapse text-xs" data-testid="attr-table">
          <tbody>
            {info.attrs.map((a) => (
              <tr key={a.name} className="border-t">
                <td className="w-1/4 py-0.5 pr-2 font-mono text-amber-700 dark:text-amber-300">{a.name}</td>
                <td className="py-0.5 font-mono break-all">{a.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(info.kind === 'element' || info.kind === 'comment') && (
        <div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border bg-muted/30 p-2 font-mono text-[11px] leading-snug">
            {open || !longMarkup ? info.markup : truncate(info.markup, 300)}
          </pre>
        </div>
      )}
      {(longMarkup || longText) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          data-testid="expand"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {open ? 'Show less' : 'Show full markup / text'}
        </button>
      )}
    </div>
  );
}

export default function XPathCssSelectorTester() {
  const [sampleId, setSampleId] = useState('bookstore');
  const [docText, setDocText] = useState(BOOKSTORE);
  const [choice, setChoice] = useState<DocChoice>('auto');
  const [mode, setMode] = useState<Mode>('xpath');
  const [queryX, setQueryX] = useState('//book[price>35]/title');
  const [queryC, setQueryC] = useState('book > title');
  const [nsText, setNsText] = useState('');
  const nsTouched = useRef(false);
  const [normalize, setNormalize] = useState(true);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [docView, setDocView] = useState<DocView>('source');
  const [shown, setShown] = useState(PAGE);
  const viewRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const query = mode === 'xpath' ? queryX : queryC;
  const setQuery = mode === 'xpath' ? setQueryX : setQueryC;

  // Parse in an effect: DOMParser only exists in the browser.
  useEffect(() => {
    const t = setTimeout(() => {
      if (docText.length > MAX_INPUT) {
        setParsed(null);
        return;
      }
      const p = parseDocument(docText, choice);
      setParsed(p);
      if (!nsTouched.current) setNsText(autoNamespaceText(p.decls));
    }, 150);
    return () => clearTimeout(t);
  }, [docText, choice]);

  const evaluation = useMemo<Evaluation | null>(() => {
    if (!parsed || parsed.issue) return null;
    return evaluate(parsed, mode, query, nsText, normalize);
  }, [parsed, mode, query, nsText, normalize]);

  const count = evaluation?.outcome?.kind === 'nodes' ? evaluation.outcome.total : null;

  const matchIndex = useMemo(() => {
    const m = new Map<unknown, number>();
    if (evaluation?.outcome?.kind === 'nodes') evaluation.outcome.nodes.slice(0, MAX_DESCRIBE).forEach((n, i) => m.set(n, i));
    return m;
  }, [evaluation]);

  const pretty = useMemo<{ lines: PrettyLine[]; truncated: boolean } | null>(() => {
    if (!parsed || parsed.issue || docView !== 'view') return null;
    return prettyPrintDoc(parsed.doc as unknown as NodeLike, matchIndex, { html: parsed.kind === 'html', maxNodes: 2500 });
  }, [parsed, matchIndex, docView]);

  useEffect(() => setShown(PAGE), [evaluation]);

  const scrollToMatch = useCallback((i: number) => {
    setDocView('view');
    setTimeout(() => {
      const el = viewRef.current?.querySelector<HTMLElement>(`[data-match="${i}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }, []);

  const scrollToCard = useCallback((i: number) => {
    const el = resultsRef.current?.querySelector<HTMLElement>(`[data-index="${i}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const loadSample = (s: Sample) => {
    setSampleId(s.id);
    setDocText(s.text);
    setChoice('auto');
    nsTouched.current = false;
    setQueryX(s.xpath[0] ?? '');
    setQueryC(s.css[0] ?? '');
  };

  const current = SAMPLES.find((s) => s.id === sampleId);
  const examples = mode === 'xpath' ? current?.xpath ?? [] : current?.css ?? [];
  const kind = parsed?.kind ?? (choice === 'auto' ? 'xml' : choice);
  const infos = evaluation?.infos ?? [];
  const outcome = evaluation?.outcome ?? null;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Query language">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="xpath" data-testid="mode-xpath">XPath 1.0</TabsTrigger>
              <TabsTrigger value="css" data-testid="mode-css">CSS selector</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Document type">
          <Tabs value={choice} onValueChange={(v) => setChoice(v as DocChoice)}>
            <TabsList>
              <TabsTrigger value="auto" data-testid="doc-auto">Auto</TabsTrigger>
              <TabsTrigger value="xml" data-testid="doc-xml">XML</TabsTrigger>
              <TabsTrigger value="html" data-testid="doc-html">HTML</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Sample">
          <div className="flex flex-wrap gap-1">
            {SAMPLES.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={sampleId === s.id && docText === s.text ? 'secondary' : 'outline'}
                onClick={() => loadSample(s)}
                data-testid={`sample-${s.id}`}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Normalize whitespace in text">
          <Switch checked={normalize} onCheckedChange={setNormalize} aria-label="Normalize whitespace in extracted text" />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title={mode === 'xpath' ? 'XPath 1.0 (browser engine)' : 'CSS selector (querySelectorAll)'}>
          <span className="px-2 font-mono text-xs text-muted-foreground" data-testid="match-count">
            {evaluation?.error
              ? 'error'
              : outcome?.kind === 'nodes'
                ? `${count} match${count === 1 ? '' : 'es'}`
                : outcome
                  ? outcome.kind
                  : '—'}
          </span>
        </PanelHeader>
        <div className="space-y-2 p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'xpath' ? '//book[price>35]/title' : 'div > p:first-child'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="font-mono"
            aria-label={mode === 'xpath' ? 'XPath expression' : 'CSS selector'}
            data-testid="query-input"
          />
          {examples.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Try</span>
              {examples.map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setQuery(x)}
                  className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted"
                  data-testid="example-chip"
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          <details className="rounded border text-sm">
            <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium">Cheat sheet ({mode === 'xpath' ? 'XPath' : 'CSS'})</summary>
            <div className="grid gap-x-4 gap-y-1 border-t p-2 sm:grid-cols-2">
              {(mode === 'xpath' ? XPATH_CHEATS : CSS_CHEATS).map((c) => (
                <button
                  key={c.expr}
                  type="button"
                  onClick={() => setQuery(c.expr)}
                  className="flex items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-muted"
                >
                  <code className="shrink-0 font-mono text-xs">{c.expr}</code>
                  <span className="truncate text-xs text-muted-foreground">{c.hint}</span>
                </button>
              ))}
            </div>
          </details>
          {mode === 'xpath' && (
            <details className="rounded border text-sm" open={kind === 'xml' && (parsed?.decls.length ?? 0) > 0}>
              <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium">
                Namespace prefixes {parsed && parsed.decls.length > 0 ? `(${parsed.decls.length} declared in the document)` : ''}
              </summary>
              <div className="space-y-1.5 border-t p-2">
                <Textarea
                  value={nsText}
                  onChange={(e) => {
                    nsTouched.current = true;
                    setNsText(e.target.value);
                  }}
                  placeholder={'one per line: prefix=namespace-uri\nd=http://www.w3.org/2005/Atom'}
                  spellCheck={false}
                  rows={5}
                  className="min-h-0 font-mono text-xs field-sizing-fixed"
                  aria-label="Namespace prefixes"
                  data-testid="ns-input"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      nsTouched.current = false;
                      setNsText(autoNamespaceText(parsed?.decls ?? []));
                    }}
                  >
                    Collect from document
                  </Button>
                  <span>XPath 1.0 cannot match a default namespace without a prefix: give it one here (e.g. d) and write //d:item.</span>
                </div>
                {evaluation?.nsProblems.map((p) => (
                  <p key={p} className="text-xs text-destructive">{p}</p>
                ))}
              </div>
            </details>
          )}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* ---------------- document ---------------- */}
        <Panel>
          <PanelHeader title="Document">
            <Tabs value={docView} onValueChange={(v) => setDocView(v as DocView)}>
              <TabsList className="h-7">
                <TabsTrigger value="source" className="h-6 px-2 text-xs" data-testid="view-source">Source</TabsTrigger>
                <TabsTrigger value="view" className="h-6 px-2 text-xs" data-testid="view-highlight">Highlighted</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="icon-sm" title="Clear" disabled={!docText} onClick={() => setDocText('')}>
              <Eraser className="size-3.5" />
            </Button>
          </PanelHeader>
          {docView === 'source' || !parsed || parsed.issue ? (
            <Textarea
              value={docText}
              onChange={(e) => {
                setDocText(e.target.value);
                setSampleId('');
              }}
              placeholder="Paste XML or HTML here…"
              spellCheck={false}
              wrap="off"
              aria-label="Document"
              className="h-[30rem] resize-y rounded-none border-0 bg-transparent font-mono text-[13px] leading-5 shadow-none field-sizing-fixed focus-visible:ring-0 dark:bg-transparent"
              style={{ whiteSpace: 'pre', overflow: 'auto' }}
              data-testid="doc-input"
            />
          ) : (
            <div ref={viewRef} className="h-[30rem] overflow-auto p-3 font-mono text-[13px] leading-5" data-testid="highlight-view">
              {pretty?.lines.map((l, i) => (
                <div key={i} style={{ paddingLeft: `${l.indent * 2}ch` }} className="whitespace-pre">
                  {l.segs.map((s, j) => (
                    <span
                      key={j}
                      className={cn(
                        SEG_CLASS[s.cls],
                        s.match !== undefined && 'cursor-pointer rounded-sm bg-yellow-300/50 dark:bg-yellow-400/25'
                      )}
                      data-match={s.match}
                      onClick={s.match !== undefined ? () => scrollToCard(s.match as number) : undefined}
                    >
                      {s.text}
                    </span>
                  ))}
                </div>
              ))}
              {pretty?.truncated && <div className="pt-2 text-xs text-muted-foreground">… document truncated for display (the query still runs on all of it)</div>}
            </div>
          )}
          <StatBar
            items={[
              `${docText.length.toLocaleString()} chars`,
              parsed && `parsed as ${parsed.kind.toUpperCase()}${choice === 'auto' ? ' (auto)' : ''}`,
              parsed && parsed.decls.length > 0 && `${parsed.decls.length} xmlns`,
            ]}
          />
          {docText.length > MAX_INPUT && (
            <div className="p-3">
              <ErrorBanner error={`The document is too large (${docText.length.toLocaleString()} characters; limit ${MAX_INPUT.toLocaleString()}).`} />
            </div>
          )}
        </Panel>

        {/* ---------------- results ---------------- */}
        <Panel>
          <PanelHeader title="Results">
            <CopyButton
              value={() => (outcome ? resultsToJson(outcome, infos) : '')}
              label="Copy JSON"
              disabled={!outcome}
            />
            <CopyButton
              value={() => (outcome ? resultsToCsv(outcome, infos) : '')}
              label="Copy CSV"
              disabled={!outcome}
            />
            <DownloadButton
              data={() => (outcome ? resultsToCsv(outcome, infos) : '')}
              filename="results.csv"
              mime="text/csv"
              label="CSV"
              disabled={!outcome}
            />
            <DownloadButton
              data={() => (outcome ? resultsToJson(outcome, infos) : '')}
              filename="results.json"
              mime="application/json"
              label="JSON"
              disabled={!outcome}
            />
          </PanelHeader>
          <div ref={resultsRef} className="max-h-[30rem] min-h-[12rem] flex-1 divide-y overflow-auto" data-testid="results">
            {parsed?.issue ? (
              <div className="space-y-2 p-3" data-testid="parse-error">
                <ErrorBanner
                  error={`The document is not well-formed XML${parsed.issue.line ? ` (line ${parsed.issue.line}${parsed.issue.column ? `, column ${parsed.issue.column}` : ''})` : ''}: ${parsed.issue.message}`}
                />
                {parsed.frame && (
                  <pre className="overflow-x-auto rounded-md border bg-muted/30 p-2 font-mono text-xs text-muted-foreground">{parsed.frame}</pre>
                )}
                <p className="text-xs text-muted-foreground">
                  Fix the document, or switch <strong>Document type</strong> to HTML to parse it leniently.
                </p>
              </div>
            ) : evaluation?.error ? (
              <div className="space-y-2 p-3" data-testid="query-error">
                <ErrorBanner error={evaluation.error.message} />
                {evaluation.error.hint && <p className="text-xs text-muted-foreground">{evaluation.error.hint}</p>}
              </div>
            ) : !parsed ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{docText.trim() ? 'Parsing…' : 'Paste a document to start.'}</div>
            ) : !query.trim() ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Enter an {mode === 'xpath' ? 'XPath expression' : 'CSS selector'} above.</div>
            ) : outcome && outcome.kind !== 'nodes' ? (
              <div className="space-y-1 p-4" data-testid="scalar-result">
                <Badge variant="secondary" className="font-mono text-[10px] uppercase">{outcome.kind}</Badge>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-lg" data-testid="scalar-value">
                    {outcome.kind === 'string' ? JSON.stringify(outcome.value) : String(outcome.value)}
                  </code>
                  <CopyButton value={String(outcome.value)} size="icon-sm" label="Copy value" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {outcome.kind === 'string' ? 'The expression returned a string value.' : outcome.kind === 'number' ? 'The expression returned a number.' : 'The expression returned a boolean.'}
                </p>
              </div>
            ) : outcome && outcome.kind === 'nodes' && outcome.total === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground" data-testid="no-matches">
                No nodes match.
                {mode === 'xpath' && kind === 'xml' && (parsed.decls.length > 0) && (
                  <span className="mt-1 block text-xs">The document declares namespaces: unprefixed names in XPath only match elements that have no namespace.</span>
                )}
              </div>
            ) : (
              infos.slice(0, shown).map((info, i) => <ResultCard key={i} index={i} info={info} onShow={scrollToMatch} />)
            )}
            {outcome && outcome.kind === 'nodes' && infos.length > shown && (
              <div className="p-3 text-center">
                <Button variant="outline" size="sm" onClick={() => setShown((s) => s + PAGE)}>
                  Show {Math.min(PAGE, infos.length - shown)} more
                </Button>
              </div>
            )}
          </div>
          <StatBar
            items={[
              outcome?.kind === 'nodes' && `${outcome.total.toLocaleString()} node${outcome.total === 1 ? '' : 's'}`,
              outcome?.kind === 'nodes' && outcome.truncated && `first ${MAX_NODES.toLocaleString()} only`,
              outcome?.kind === 'nodes' && infos.length < outcome.total && `exports/cards: first ${infos.length.toLocaleString()}`,
            ]}
          />
        </Panel>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Crosshair className="mt-0.5 size-3.5 shrink-0" />
        <p>
          XPath 1.0 is evaluated by your browser&apos;s own engine (<code className="font-mono">document.evaluate</code>), CSS by{' '}
          <code className="font-mono">querySelectorAll</code>. XML is parsed strictly; HTML is parsed like a browser would (missing{' '}
          <code className="font-mono">html</code>/<code className="font-mono">body</code> are added, tag names are lower-cased). Scripts in the document are never
          executed. Generated paths are absolute XPath with positions and a CSS path using <code className="font-mono">#id</code> /{' '}
          <code className="font-mono">:nth-of-type</code>; exports contain whitespace-normalised text and attributes. In the Highlighted view, click a
          highlight to jump to its result, or use Show on a result to jump to it in the document.
        </p>
      </div>
      {!parsed && docText.trim() === '' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5" /> The document is empty.
        </div>
      )}
    </div>
  );
}
