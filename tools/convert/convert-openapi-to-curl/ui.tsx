'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `{
  "openapi": "3.0.0",
  "servers": [{ "url": "https://api.example.com/v1" }],
  "paths": {
    "/users/{id}": {
      "get": {
        "operationId": "getUser",
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "integer" } },
          { "name": "verbose", "in": "query", "schema": { "type": "boolean" } }
        ]
      }
    },
    "/users": {
      "post": {
        "operationId": "createUser",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "age": { "type": "integer" }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

type Json = unknown;

function shellSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, `'\\''`) + "'";
}

/** Minimal YAML parser for the subset used by OpenAPI docs (maps, lists, scalars). */
function parseYaml(text: string): Json {
  interface Line {
    indent: number;
    content: string;
  }
  const rawLines = text.split('\n');
  const lines: Line[] = [];
  for (const raw of rawLines) {
    const noComment = stripComment(raw);
    if (noComment.trim() === '') continue;
    const indent = noComment.length - noComment.trimStart().length;
    lines.push({ indent, content: noComment.trim() });
  }

  let pos = 0;

  function scalar(token: string): Json {
    const t = token.trim();
    if (t === '' ) return null;
    if (t === 'null' || t === '~') return null;
    if (t === 'true') return true;
    if (t === 'false') return false;
    if (/^-?\d+$/.test(t)) return Number(t);
    if (/^-?\d*\.\d+$/.test(t)) return Number(t);
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  }

  function parseBlock(minIndent: number): Json {
    const first = lines[pos];
    if (!first) return null;
    const indent = first.indent;
    if (indent < minIndent) return null;

    if (first.content.startsWith('- ') || first.content === '-') {
      // sequence
      const arr: Json[] = [];
      while (pos < lines.length) {
        const ln = lines[pos];
        if (!ln || ln.indent !== indent || !(ln.content === '-' || ln.content.startsWith('- '))) break;
        const rest = ln.content === '-' ? '' : ln.content.slice(2);
        pos += 1;
        if (rest === '') {
          arr.push(parseBlock(indent + 1));
        } else if (rest.includes(': ') || rest.endsWith(':')) {
          // inline key starts a map item; rewind by treating rest as a virtual line
          lines.splice(pos, 0, { indent: indent + 2, content: rest });
          arr.push(parseBlock(indent + 2));
        } else {
          arr.push(scalar(rest));
        }
      }
      return arr;
    }

    // mapping
    const map: Record<string, Json> = {};
    while (pos < lines.length) {
      const ln = lines[pos];
      if (!ln || ln.indent !== indent) break;
      const colonIdx = ln.content.indexOf(':');
      if (colonIdx === -1) break;
      const key = scalarKey(ln.content.slice(0, colonIdx));
      const valuePart = ln.content.slice(colonIdx + 1).trim();
      pos += 1;
      if (valuePart === '') {
        const next = lines[pos];
        if (next && next.indent > indent) {
          map[key] = parseBlock(next.indent);
        } else {
          map[key] = null;
        }
      } else {
        map[key] = scalar(valuePart);
      }
    }
    return map;
  }

  function scalarKey(token: string): string {
    const t = token.trim();
    if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  }

  return parseBlock(0);
}

function stripComment(line: string): string {
  // remove # comments that are not inside quotes (best-effort)
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) {
      const prev = line[i - 1];
      if (i === 0 || prev === ' ' || prev === '\t') return line.slice(0, i);
    }
  }
  return line;
}

function asObj(v: Json): Record<string, Json> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, Json>;
  return null;
}

/** Build a sample value for a schema node. */
function sampleForSchema(schema: Json, depth: number): Json {
  const s = asObj(schema);
  if (!s || depth > 5) return 'string';
  if (s.example !== undefined) return s.example;
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0] ?? null;
  const type = typeof s.type === 'string' ? s.type : undefined;
  switch (type) {
    case 'integer':
      return 0;
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'array': {
      return [sampleForSchema(s.items, depth + 1)];
    }
    case 'object': {
      const props = asObj(s.properties);
      const obj: Record<string, Json> = {};
      if (props) for (const key of Object.keys(props)) obj[key] = sampleForSchema(props[key], depth + 1);
      return obj;
    }
    case 'string':
      return 'string';
    default: {
      // no explicit type: infer from properties
      const props = asObj(s.properties);
      if (props) {
        const obj: Record<string, Json> = {};
        for (const key of Object.keys(props)) obj[key] = sampleForSchema(props[key], depth + 1);
        return obj;
      }
      return 'string';
    }
  }
}

function sampleForParam(schema: Json): string {
  const v = sampleForSchema(schema, 0);
  if (typeof v === 'string') return v;
  return String(v);
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

export default function OpenApiToCurlTool() {
  const [multiline, setMultiline] = useState(true);

  return (
    <TextToolLayout
      deps={[multiline]}
      transform={(input) => {
        const text = input.trim();
        if (!text) return '';

        let doc: Json;
        try {
          doc = JSON.parse(text);
        } catch {
          try {
            doc = parseYaml(text);
          } catch {
            throw new Error('Input is not valid JSON or YAML.');
          }
        }

        const root = asObj(doc);
        if (!root) throw new Error('Document must be an object.');

        // base URL
        let base = '';
        const servers = root.servers;
        if (Array.isArray(servers) && servers.length > 0) {
          const first = asObj(servers[0]);
          if (first && typeof first.url === 'string') base = first.url;
        }
        if (!base && typeof root.host === 'string') {
          const scheme = Array.isArray(root.schemes) && root.schemes[0] === 'https' ? 'https' : 'http';
          base = `${scheme}://${root.host}${typeof root.basePath === 'string' ? root.basePath : ''}`;
        }
        base = base.replace(/\/$/, '');

        const paths = asObj(root.paths);
        if (!paths) throw new Error('No "paths" object found.');

        const sep = multiline ? ' \\\n  ' : ' ';
        const blocks: string[] = [];

        for (const pathKey of Object.keys(paths)) {
          const item = asObj(paths[pathKey]);
          if (!item) continue;
          for (const method of METHODS) {
            const op = asObj(item[method]);
            if (!op) continue;

            const opId = typeof op.operationId === 'string' ? op.operationId : `${method.toUpperCase()} ${pathKey}`;

            // gather params (operation-level + path-level)
            const params: Record<string, Json>[] = [];
            const collect = (arr: Json) => {
              if (Array.isArray(arr)) for (const p of arr) { const o = asObj(p); if (o) params.push(o); }
            };
            collect(item.parameters);
            collect(op.parameters);

            // build path with substituted placeholders
            let urlPath = pathKey;
            const query: string[] = [];
            const headerParams: Array<[string, string]> = [];
            for (const p of params) {
              const name = typeof p.name === 'string' ? p.name : '';
              const where = typeof p.in === 'string' ? p.in : '';
              if (!name) continue;
              const val = sampleForParam(p.schema);
              if (where === 'path') {
                urlPath = urlPath.replace(`{${name}}`, encodeURIComponent(val));
              } else if (where === 'query') {
                if (p.required === true) query.push(`${encodeURIComponent(name)}=${encodeURIComponent(val)}`);
              } else if (where === 'header') {
                if (p.required === true) headerParams.push([name, val]);
              }
            }

            const fullUrl = base + urlPath + (query.length ? '?' + query.join('&') : '');

            const parts: string[] = ['curl'];
            if (method !== 'get') parts.push(`-X ${method.toUpperCase()}`);
            parts.push(shellSingleQuote(fullUrl));
            for (const [hName, hVal] of headerParams) {
              parts.push(`-H ${shellSingleQuote(`${hName}: ${hVal}`)}`);
            }

            // request body skeleton (JSON)
            const reqBody = asObj(op.requestBody);
            if (reqBody) {
              const content = asObj(reqBody.content);
              const jsonMedia = content ? asObj(content['application/json']) : null;
              if (jsonMedia) {
                const skeleton = sampleForSchema(jsonMedia.schema, 0);
                parts.push(`-H ${shellSingleQuote('Content-Type: application/json')}`);
                parts.push(`-d ${shellSingleQuote(JSON.stringify(skeleton))}`);
              }
            }

            blocks.push(`# ${opId}\n${parts.join(sep)}`);
          }
        }

        if (blocks.length === 0) throw new Error('No operations found under paths.');
        return blocks.join('\n\n');
      }}
      inputLabel="OpenAPI (JSON or YAML)"
      outputLabel="cURL"
      sample={SAMPLE}
      downloadName="openapi-curl.sh"
      downloadMime="text/plain"
      options={
        <Field label="Line continuation">
          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch checked={multiline} onCheckedChange={setMultiline} />
            {multiline ? 'Multi-line' : 'Single line'}
          </label>
        </Field>
      }
    />
  );
}
