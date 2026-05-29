/**
 * Minimal YAML <-> JSON support for common configuration shapes (maps, lists,
 * scalars, nesting via indentation, inline flow collections). Not a full YAML 1.2
 * implementation, but covers the vast majority of hand-written config files with
 * zero dependencies. For anything exotic, the error is surfaced to the user.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function parseScalar(raw: string): Json {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  // inline flow
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlow(inner).map(parseScalar);
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    const obj: { [k: string]: Json } = {};
    if (inner) {
      for (const pair of splitFlow(inner)) {
        const idx = pair.indexOf(':');
        if (idx === -1) continue;
        obj[parseScalar(pair.slice(0, idx)) as string] = parseScalar(pair.slice(idx + 1));
      }
    }
    return obj;
  }
  return s;
}

function splitFlow(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let q: string | null = null;
  let cur = '';
  for (const ch of s) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface Line {
  indent: number;
  content: string;
}

export function yamlToJson(text: string): Json {
  const lines: Line[] = text
    .split('\n')
    .map((l) => l.replace(/\t/g, '  '))
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l))
    .map((l) => ({ indent: l.length - l.trimStart().length, content: l.trim() }));

  let pos = 0;

  function parseBlock(minIndent: number): Json {
    if (pos >= lines.length) return null;
    const first = lines[pos]!;
    const isList = first.content.startsWith('- ');
    if (isList) {
      const arr: Json[] = [];
      while (pos < lines.length && lines[pos]!.indent >= minIndent && lines[pos]!.content.startsWith('- ')) {
        if (lines[pos]!.indent !== first.indent) break;
        const item = lines[pos]!.content.slice(2).trim();
        pos++;
        if (item.includes(':') && !item.startsWith('{') && !item.startsWith('[')) {
          // inline map starting on the dash line: treat as nested map
          pos--;
          lines[pos] = { indent: first.indent + 2, content: lines[pos]!.content.slice(2).trim() };
          arr.push(parseBlock(first.indent + 2));
        } else {
          arr.push(parseScalar(item));
        }
      }
      return arr;
    }
    // map
    const obj: { [k: string]: Json } = {};
    while (pos < lines.length && lines[pos]!.indent >= minIndent) {
      const line = lines[pos]!;
      if (line.indent !== first.indent) break;
      const idx = line.content.indexOf(':');
      if (idx === -1) {
        pos++;
        continue;
      }
      const key = parseScalar(line.content.slice(0, idx)) as string;
      const rest = line.content.slice(idx + 1).trim();
      pos++;
      if (rest === '') {
        // nested block
        if (pos < lines.length && lines[pos]!.indent > line.indent) {
          obj[key] = parseBlock(line.indent + 1);
        } else {
          obj[key] = null;
        }
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    return obj;
  }

  return parseBlock(0);
}

export function jsonToYaml(value: Json, indent = 0): string {
  const pad = '  '.repeat(indent);
  if (value === null) return 'null';
  if (typeof value !== 'object') return formatScalar(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object' && Object.keys(item).length) {
          const block = jsonToYaml(item, indent + 1);
          return `${pad}-\n${block}`;
        }
        return `${pad}- ${jsonToYaml(item, 0)}`;
      })
      .join('\n');
  }
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';
  return keys
    .map((k) => {
      const v = value[k]!;
      if (v !== null && typeof v === 'object' && (Array.isArray(v) ? v.length : Object.keys(v).length)) {
        return `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`;
      }
      return `${pad}${k}: ${jsonToYaml(v as Json, 0)}`;
    })
    .join('\n');
}

function formatScalar(v: Json): string {
  if (v === null) return 'null';
  if (typeof v === 'string') {
    if (v === '' || /[:#\-?,[\]{}&*!|>'"%@`]/.test(v) || /^\s|\s$/.test(v) || /^(true|false|null|\d)/.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  return String(v);
}
