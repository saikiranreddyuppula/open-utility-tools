/** Tiny forgiving XML parser (no DOM needed, works in tests and in the browser). */

export interface XNode {
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
  /** Concatenated direct text content (untrimmed). */
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, g: string) => {
    if (g.startsWith('#x') || g.startsWith('#X')) {
      const cp = parseInt(g.slice(2), 16);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    if (g.startsWith('#')) {
      const cp = parseInt(g.slice(1), 10);
      return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[g] ?? m;
  });
}

const ATTR_RE = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/y;

/** Parse an XML document; returns the root element (or null when none was found). */
export function parseXml(src: string, maxNodes = 300000): XNode | null {
  const root: XNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XNode[] = [root];
  const n = src.length;
  let i = 0;
  let count = 0;
  const top = (): XNode => stack[stack.length - 1] ?? root;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) {
      top().text += decodeEntities(src.slice(i));
      break;
    }
    if (lt > i) top().text += decodeEntities(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const e = src.indexOf('-->', lt + 4);
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', lt)) {
      const e = src.indexOf(']]>', lt + 9);
      top().text += src.slice(lt + 9, e < 0 ? n : e);
      i = e < 0 ? n : e + 3;
      continue;
    }
    if (src.startsWith('<?', lt)) {
      const e = src.indexOf('?>', lt + 2);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (src.startsWith('<!', lt)) {
      // DOCTYPE with optional [internal subset]
      let depth = 0;
      let j = lt + 2;
      for (; j < n; j++) {
        const ch = src[j];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === '>' && depth <= 0) break;
      }
      i = j + 1;
      continue;
    }
    if (src[lt + 1] === '/') {
      const e = src.indexOf('>', lt + 2);
      if (stack.length > 1) stack.pop();
      i = e < 0 ? n : e + 1;
      continue;
    }
    // start tag
    let j = lt + 1;
    while (j < n && !/[\s/>]/.test(src[j] ?? '')) j++;
    const name = src.slice(lt + 1, j);
    const node: XNode = { name, attrs: {}, children: [], text: '' };
    let selfClose = false;
    for (;;) {
      while (j < n && /\s/.test(src[j] ?? '')) j++;
      const ch = src[j];
      if (j >= n) break;
      if (ch === '>') {
        j++;
        break;
      }
      if (ch === '/' && src[j + 1] === '>') {
        selfClose = true;
        j += 2;
        break;
      }
      ATTR_RE.lastIndex = j;
      const m = ATTR_RE.exec(src);
      if (!m || m[0].length === 0) {
        j++;
        continue;
      }
      node.attrs[m[1] ?? ''] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
      j = ATTR_RE.lastIndex;
    }
    top().children.push(node);
    if (!selfClose) stack.push(node);
    i = j;
    if (++count > maxNodes) break;
  }
  return root.children[0] ?? null;
}

export function localName(name: string): string {
  const i = name.indexOf(':');
  return i < 0 ? name : name.slice(i + 1);
}

/** Match by qualified name ("dc:title") or local name ("title"). */
export function nameMatches(node: XNode, name: string): boolean {
  return node.name === name || localName(node.name) === name;
}

export function xChildren(node: XNode, name: string): XNode[] {
  return node.children.filter((c) => nameMatches(c, name));
}

export function xChild(node: XNode, name: string): XNode | undefined {
  return node.children.find((c) => nameMatches(c, name));
}

export function xFindAll(node: XNode, name: string, out: XNode[] = [], limit = 100000): XNode[] {
  for (const c of node.children) {
    if (out.length >= limit) break;
    if (nameMatches(c, name)) out.push(c);
    xFindAll(c, name, out, limit);
  }
  return out;
}

export function xFind(node: XNode, name: string): XNode | undefined {
  for (const c of node.children) {
    if (nameMatches(c, name)) return c;
    const f = xFind(c, name);
    if (f) return f;
  }
  return undefined;
}

/** Deep text content. */
export function xText(node: XNode): string {
  let s = node.text;
  for (const c of node.children) s += xText(c);
  return s;
}

export function xTextOf(node: XNode | undefined, name: string): string {
  if (!node) return '';
  const c = xChild(node, name);
  return c ? xText(c).trim() : '';
}

/** Attribute lookup by qualified or local name. */
export function attr(node: XNode, name: string): string | undefined {
  const direct = node.attrs[name];
  if (direct !== undefined) return direct;
  for (const k of Object.keys(node.attrs)) if (localName(k) === name) return node.attrs[k];
  return undefined;
}
