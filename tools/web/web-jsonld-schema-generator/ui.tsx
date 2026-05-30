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

type SchemaType =
  | 'Article'
  | 'Product'
  | 'Organization'
  | 'LocalBusiness'
  | 'FAQPage'
  | 'BreadcrumbList'
  | 'Event'
  | 'Recipe'
  | 'Person';

type Json = Record<string, unknown>;

let nextId = 100;

interface Pair {
  id: number;
  a: string;
  b: string;
}

function clean(obj: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

export default function JsonLdGeneratorTool() {
  const [type, setType] = useState<SchemaType>('Product');

  // shared common fields
  const [name, setName] = useState('Acme Wireless Headphones');
  const [description, setDescription] = useState(
    'Over-ear noise-cancelling Bluetooth headphones with 40h battery.',
  );
  const [url, setUrl] = useState('https://example.com/headphones');
  const [image, setImage] = useState('https://example.com/img/headphones.jpg');

  // Product
  const [brand, setBrand] = useState('Acme');
  const [sku, setSku] = useState('ACM-HP-100');
  const [price, setPrice] = useState('199.99');
  const [currency, setCurrency] = useState('USD');
  const [availability, setAvailability] = useState('InStock');

  // Article / Person / Org
  const [author, setAuthor] = useState('Jane Doe');
  const [datePublished, setDatePublished] = useState('2026-01-15');

  // Event
  const [startDate, setStartDate] = useState('2026-06-01T19:00');
  const [endDate, setEndDate] = useState('2026-06-01T22:00');
  const [location, setLocation] = useState('Madison Square Garden, New York');

  // FAQ
  const [faqs, setFaqs] = useState<Pair[]>([
    { id: 1, a: 'What is the battery life?', b: 'Up to 40 hours on a single charge.' },
    { id: 2, a: 'Is it noise cancelling?', b: 'Yes, active noise cancellation is included.' },
  ]);

  // Breadcrumb
  const [crumbs, setCrumbs] = useState<Pair[]>([
    { id: 11, a: 'Home', b: 'https://example.com/' },
    { id: 12, a: 'Audio', b: 'https://example.com/audio' },
    { id: 13, a: 'Headphones', b: 'https://example.com/audio/headphones' },
  ]);

  // Recipe
  const [recipeIngredients, setRecipeIngredients] = useState(
    '2 cups flour\n1 tsp salt\n1 cup water',
  );
  const [recipeInstructions, setRecipeInstructions] = useState(
    'Mix dry ingredients.\nAdd water and knead.\nBake at 200C for 30 minutes.',
  );

  const addFaq = () =>
    setFaqs((f) => [...f, { id: nextId++, a: '', b: '' }]);
  const addCrumb = () =>
    setCrumbs((c) => [...c, { id: nextId++, a: '', b: '' }]);

  const jsonObject = useMemo<Json>(() => {
    const base: Json = { '@context': 'https://schema.org', '@type': type };
    switch (type) {
      case 'Article':
        return clean({
          ...base,
          headline: name,
          description,
          url,
          image: image || undefined,
          author: author ? { '@type': 'Person', name: author } : undefined,
          datePublished: datePublished || undefined,
        });
      case 'Product': {
        const offers = clean({
          '@type': 'Offer',
          price,
          priceCurrency: currency,
          availability: availability ? `https://schema.org/${availability}` : undefined,
          url,
        });
        return clean({
          ...base,
          name,
          image: image || undefined,
          description,
          sku: sku || undefined,
          brand: brand ? { '@type': 'Brand', name: brand } : undefined,
          offers: Object.keys(offers).length > 1 ? offers : undefined,
        });
      }
      case 'Organization':
        return clean({
          ...base,
          name,
          url,
          logo: image || undefined,
          description,
        });
      case 'LocalBusiness':
        return clean({
          ...base,
          name,
          url,
          image: image || undefined,
          description,
          address: location ? { '@type': 'PostalAddress', name: location } : undefined,
        });
      case 'Person':
        return clean({
          ...base,
          name: author || name,
          url,
          image: image || undefined,
          description,
        });
      case 'Event':
        return clean({
          ...base,
          name,
          description,
          url,
          image: image || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          location: location
            ? { '@type': 'Place', name: location }
            : undefined,
        });
      case 'FAQPage': {
        const mainEntity = faqs
          .filter((q) => q.a.trim() && q.b.trim())
          .map((q) => ({
            '@type': 'Question',
            name: q.a.trim(),
            acceptedAnswer: { '@type': 'Answer', text: q.b.trim() },
          }));
        return clean({ ...base, mainEntity });
      }
      case 'BreadcrumbList': {
        const itemListElement = crumbs
          .filter((c) => c.a.trim())
          .map((c, i) =>
            clean({
              '@type': 'ListItem',
              position: i + 1,
              name: c.a.trim(),
              item: c.b.trim() || undefined,
            }),
          );
        return clean({ ...base, itemListElement });
      }
      case 'Recipe': {
        const ing = recipeIngredients
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        const steps = recipeInstructions
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => ({ '@type': 'HowToStep', text: s }));
        return clean({
          ...base,
          name,
          image: image || undefined,
          description,
          author: author ? { '@type': 'Person', name: author } : undefined,
          recipeIngredient: ing,
          recipeInstructions: steps,
        });
      }
      default:
        return base;
    }
  }, [
    type,
    name,
    description,
    url,
    image,
    brand,
    sku,
    price,
    currency,
    availability,
    author,
    datePublished,
    startDate,
    endDate,
    location,
    faqs,
    crumbs,
    recipeIngredients,
    recipeInstructions,
  ]);

  const jsonStr = useMemo(() => JSON.stringify(jsonObject, null, 2), [jsonObject]);
  const scriptBlock = useMemo(
    () => `<script type="application/ld+json">\n${jsonStr}\n</script>`,
    [jsonStr],
  );

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (type === 'FAQPage' && faqs.every((q) => !q.a.trim() || !q.b.trim()))
      w.push('Add at least one complete question/answer pair.');
    if (type === 'BreadcrumbList' && crumbs.every((c) => !c.a.trim()))
      w.push('Add at least one breadcrumb item.');
    return w;
  }, [type, faqs, crumbs]);

  const commonFields = (
    <>
      <Field label="Name / Title" className="flex-1 min-w-[220px]">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="URL" className="flex-1 min-w-[220px]">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" />
      </Field>
      <Field label="Image URL" className="flex-1 min-w-[220px]">
        <Input value={image} onChange={(e) => setImage(e.target.value)} className="font-mono" />
      </Field>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Fields" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="Schema type">
              <Select value={type} onValueChange={(v) => setType(v as SchemaType)}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      'Article',
                      'Product',
                      'Organization',
                      'LocalBusiness',
                      'FAQPage',
                      'BreadcrumbList',
                      'Event',
                      'Recipe',
                      'Person',
                    ] as SchemaType[]
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {commonFields}
          </OptionsBar>

          {(type === 'Article' ||
            type === 'Product' ||
            type === 'Organization' ||
            type === 'LocalBusiness' ||
            type === 'Event' ||
            type === 'Recipe' ||
            type === 'Person') && (
            <OptionsBar>
              <Field label="Description" className="flex-1 min-w-[280px]">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  spellCheck={false}
                  rows={2}
                />
              </Field>
            </OptionsBar>
          )}

          {type === 'Product' && (
            <OptionsBar>
              <Field label="Brand">
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-40" />
              </Field>
              <Field label="SKU">
                <Input value={sku} onChange={(e) => setSku(e.target.value)} className="w-40 font-mono" />
              </Field>
              <Field label="Price">
                <Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-28 font-mono" inputMode="decimal" />
              </Field>
              <Field label="Currency">
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-24 font-mono" />
              </Field>
              <Field label="Availability">
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="InStock">InStock</SelectItem>
                    <SelectItem value="OutOfStock">OutOfStock</SelectItem>
                    <SelectItem value="PreOrder">PreOrder</SelectItem>
                    <SelectItem value="Discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </OptionsBar>
          )}

          {(type === 'Article' || type === 'Recipe' || type === 'Person') && (
            <OptionsBar>
              <Field label="Author">
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} className="w-48" />
              </Field>
              {type === 'Article' && (
                <Field label="Date published">
                  <Input
                    type="date"
                    value={datePublished}
                    onChange={(e) => setDatePublished(e.target.value)}
                    className="w-44 font-mono"
                  />
                </Field>
              )}
            </OptionsBar>
          )}

          {type === 'Event' && (
            <OptionsBar>
              <Field label="Start date">
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-56 font-mono"
                />
              </Field>
              <Field label="End date">
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-56 font-mono"
                />
              </Field>
              <Field label="Location" className="flex-1 min-w-[200px]">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
            </OptionsBar>
          )}

          {type === 'LocalBusiness' && (
            <OptionsBar>
              <Field label="Address" className="flex-1 min-w-[260px]">
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </Field>
            </OptionsBar>
          )}

          {type === 'FAQPage' && (
            <div className="flex flex-col gap-2">
              {faqs.map((q) => (
                <div key={q.id} className="flex items-start gap-2">
                  <Input
                    value={q.a}
                    onChange={(e) =>
                      setFaqs((f) => f.map((x) => (x.id === q.id ? { ...x, a: e.target.value } : x)))
                    }
                    placeholder="Question"
                    className="flex-1"
                  />
                  <Input
                    value={q.b}
                    onChange={(e) =>
                      setFaqs((f) => f.map((x) => (x.id === q.id ? { ...x, b: e.target.value } : x)))
                    }
                    placeholder="Answer"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setFaqs((f) => f.filter((x) => x.id !== q.id))}
                    aria-label="Remove FAQ"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div>
                <Button variant="secondary" size="sm" onClick={addFaq}>
                  <Plus className="size-3.5" /> Add Q&amp;A
                </Button>
              </div>
            </div>
          )}

          {type === 'BreadcrumbList' && (
            <div className="flex flex-col gap-2">
              {crumbs.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Input
                    value={c.a}
                    onChange={(e) =>
                      setCrumbs((cs) => cs.map((x) => (x.id === c.id ? { ...x, a: e.target.value } : x)))
                    }
                    placeholder="Name"
                    className="flex-1"
                  />
                  <Input
                    value={c.b}
                    onChange={(e) =>
                      setCrumbs((cs) => cs.map((x) => (x.id === c.id ? { ...x, b: e.target.value } : x)))
                    }
                    placeholder="URL"
                    className="flex-1 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCrumbs((cs) => cs.filter((x) => x.id !== c.id))}
                    aria-label="Remove crumb"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div>
                <Button variant="secondary" size="sm" onClick={addCrumb}>
                  <Plus className="size-3.5" /> Add breadcrumb
                </Button>
              </div>
            </div>
          )}

          {type === 'Recipe' && (
            <OptionsBar>
              <Field label="Ingredients (one per line)" className="flex-1 min-w-[220px]">
                <Textarea
                  value={recipeIngredients}
                  onChange={(e) => setRecipeIngredients(e.target.value)}
                  spellCheck={false}
                  rows={4}
                />
              </Field>
              <Field label="Instructions (one step per line)" className="flex-1 min-w-[220px]">
                <Textarea
                  value={recipeInstructions}
                  onChange={(e) => setRecipeInstructions(e.target.value)}
                  spellCheck={false}
                  rows={4}
                />
              </Field>
            </OptionsBar>
          )}
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
        <PanelHeader title="JSON-LD">
          <CopyButton value={() => scriptBlock} label="Copy script" />
          <CopyButton value={() => jsonStr} label="Copy JSON" />
          <DownloadButton data={() => scriptBlock} filename="schema.html" />
        </PanelHeader>
        <pre className="max-h-[460px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
          {scriptBlock}
        </pre>
        <StatBar items={[`type: ${type}`, `${jsonStr.length} chars`]} />
      </Panel>
    </div>
  );
}
