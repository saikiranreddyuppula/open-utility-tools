'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE =
  '<div class="card promo" id="hero" style="color:red" data-track="a" onclick="go()">\n' +
  '  <p class="lead" empty="">Hello <b style="font-weight:700">world</b></p>\n' +
  '  <script>alert(1)</script>\n' +
  '  <iframe src="x"></iframe>\n' +
  '</div>';

interface Token {
  kind: 'tag' | 'text';
  value: string;
}

/** Split HTML into tag and text tokens. Comments/CDATA kept as text. */
function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const ch = html[i];
    if (ch === '<') {
      if (html.startsWith('<!--', i)) {
        const end = html.indexOf('-->', i);
        const stop = end === -1 ? n : end + 3;
        tokens.push({ kind: 'text', value: html.slice(i, stop) });
        i = stop;
        continue;
      }
      const end = html.indexOf('>', i);
      if (end === -1) {
        tokens.push({ kind: 'text', value: html.slice(i) });
        break;
      }
      tokens.push({ kind: 'tag', value: html.slice(i, end + 1) });
      i = end + 1;
      continue;
    }
    const next = html.indexOf('<', i);
    const stop = next === -1 ? n : next;
    tokens.push({ kind: 'text', value: html.slice(i, stop) });
    i = stop;
  }
  return tokens;
}

interface Attr {
  name: string;
  raw: string;
  hasValue: boolean;
  value: string;
}

/** Parse the attribute list portion of a tag's inner text. */
function parseAttrs(inner: string): Attr[] {
  const attrs: Attr[] = [];
  const re = /([^\s=/>]+)(\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    const name = m[1] ?? '';
    if (!name) continue;
    const hasValue = m[2] !== undefined;
    const dq = m[4];
    const sq = m[5];
    let value = '';
    if (dq !== undefined) value = dq;
    else if (sq !== undefined) value = sq;
    else if (hasValue) {
      const eq = m[2] ?? '';
      value = eq.replace(/^\s*=\s*/, '');
    }
    attrs.push({ name, raw: m[0] ?? '', hasValue, value });
  }
  return attrs;
}

interface Options {
  style: boolean;
  cls: boolean;
  id: boolean;
  events: boolean;
  data: boolean;
  empty: boolean;
  removeTags: string;
  keepInner: boolean;
}

function shouldDropAttr(name: string, hasValue: boolean, value: string, o: Options): boolean {
  const lower = name.toLowerCase();
  if (o.style && lower === 'style') return true;
  if (o.cls && lower === 'class') return true;
  if (o.id && lower === 'id') return true;
  if (o.events && lower.startsWith('on')) return true;
  if (o.data && lower.startsWith('data-')) return true;
  if (o.empty && hasValue && value.trim() === '') return true;
  return false;
}

function rewriteTag(tag: string, o: Options, removeSet: Set<string>): string {
  // Leave declarations/PIs untouched.
  if (tag.startsWith('<!') || tag.startsWith('<?')) return tag;
  const isClose = tag[1] === '/';
  const inner = tag.slice(isClose ? 2 : 1, tag.length - 1);
  const selfClose = inner.endsWith('/');
  const body = selfClose ? inner.slice(0, -1) : inner;

  const nameMatch = /^[a-zA-Z][\w:-]*/.exec(body.trimStart());
  const tagName = (nameMatch?.[0] ?? '').toLowerCase();
  if (!tagName) return tag;
  if (removeSet.has(tagName)) return ''; // tag removal handled by caller too

  if (isClose) return tag;

  const afterName = body.trimStart().slice(tagName.length);
  const attrs = parseAttrs(afterName);
  const kept = attrs.filter((a) => !shouldDropAttr(a.name, a.hasValue, a.value, o));
  const attrStr = kept.map((a) => a.raw.trim()).filter(Boolean).join(' ');
  const space = attrStr ? ' ' : '';
  return `<${tagName}${space}${attrStr}${selfClose ? ' /' : ''}>`;
}

function clean(html: string, o: Options): string {
  if (!html.trim()) return '';
  const removeSet = new Set(
    o.removeTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  const tokens = tokenize(html);
  const out: string[] = [];
  // Track depth of removed tags whose inner content we discard.
  let skipDepth = 0;
  let skipTag = '';

  for (const tok of tokens) {
    if (skipDepth > 0) {
      if (tok.kind === 'tag') {
        const isClose = tok.value[1] === '/';
        const nm = /^<\/?\s*([a-zA-Z][\w:-]*)/.exec(tok.value);
        const tn = (nm?.[1] ?? '').toLowerCase();
        if (tn === skipTag) {
          if (isClose) skipDepth--;
          else skipDepth++;
        }
      }
      continue;
    }

    if (tok.kind === 'text') {
      out.push(tok.value);
      continue;
    }

    const isClose = tok.value[1] === '/';
    const nm = /^<\/?\s*([a-zA-Z][\w:-]*)/.exec(tok.value);
    const tn = (nm?.[1] ?? '').toLowerCase();
    const selfClose = tok.value.endsWith('/>');

    if (tn && removeSet.has(tn)) {
      if (isClose || selfClose) continue;
      if (!o.keepInner) {
        skipDepth = 1;
        skipTag = tn;
      }
      // keepInner: drop only the tag, leave inner tokens.
      continue;
    }

    out.push(rewriteTag(tok.value, o, removeSet));
  }
  return out.join('');
}

export default function HtmlAttributeStripperTool() {
  const [style, setStyle] = useState(true);
  const [cls, setCls] = useState(false);
  const [id, setId] = useState(false);
  const [events, setEvents] = useState(true);
  const [data, setData] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [removeTags, setRemoveTags] = useState('script,style,iframe');
  const [keepInner, setKeepInner] = useState(false);

  const transform = useCallback(
    (input: string) =>
      clean(input, { style, cls, id, events, data, empty, removeTags, keepInner }),
    [style, cls, id, events, data, empty, removeTags, keepInner],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[style, cls, id, events, data, empty, removeTags, keepInner]}
      inputLabel="HTML"
      outputLabel="Cleaned HTML"
      inputPlaceholder="Paste HTML…"
      sample={SAMPLE}
      downloadName="cleaned.html"
      downloadMime="text/html"
      options={
        <>
          <Field label="Strip style">
            <Switch checked={style} onCheckedChange={setStyle} />
          </Field>
          <Field label="Strip class">
            <Switch checked={cls} onCheckedChange={setCls} />
          </Field>
          <Field label="Strip id">
            <Switch checked={id} onCheckedChange={setId} />
          </Field>
          <Field label="Strip on* events">
            <Switch checked={events} onCheckedChange={setEvents} />
          </Field>
          <Field label="Strip data-*">
            <Switch checked={data} onCheckedChange={setData} />
          </Field>
          <Field label="Strip empty attrs">
            <Switch checked={empty} onCheckedChange={setEmpty} />
          </Field>
          <Field label="Remove tags (comma)" className="min-w-[200px]">
            <Input
              value={removeTags}
              onChange={(e) => setRemoveTags(e.target.value)}
              placeholder="script,style,iframe"
            />
          </Field>
          <Field label="">
            <Label className="flex items-center gap-2 text-xs">
              <Switch checked={keepInner} onCheckedChange={setKeepInner} />
              Keep inner content of removed tags
            </Label>
          </Field>
        </>
      }
    />
  );
}
