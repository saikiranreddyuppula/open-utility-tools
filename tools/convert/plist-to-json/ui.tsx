'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Name</key>
  <string>Sample App</string>
  <key>Version</key>
  <integer>3</integer>
  <key>Ratio</key>
  <real>1.5</real>
  <key>Enabled</key>
  <true/>
  <key>Tags</key>
  <array>
    <string>fast</string>
    <string>free</string>
  </array>
  <key>Created</key>
  <date>2024-01-15T08:30:00Z</date>
</dict>
</plist>`;

function elementChildren(el: Element): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node && node.nodeType === 1) out.push(node as Element);
  }
  return out;
}

function decodeBase64Text(b64: string): string {
  const wc = (globalThis as unknown as { atob: (s: string) => string }).atob;
  const clean = b64.replace(/\s+/g, '');
  const binary = wc(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return new TextDecoder().decode(bytes);
}

function parseNode(el: Element, decodeData: boolean): unknown {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'dict': {
      const children = elementChildren(el);
      const obj: Record<string, unknown> = {};
      let i = 0;
      while (i < children.length) {
        const keyEl = children[i];
        if (!keyEl || keyEl.tagName.toLowerCase() !== 'key') {
          throw new Error('<dict> expects alternating <key> and value elements.');
        }
        const valEl = children[i + 1];
        if (!valEl) {
          throw new Error(`<key>${keyEl.textContent ?? ''}</key> has no matching value.`);
        }
        obj[keyEl.textContent ?? ''] = parseNode(valEl, decodeData);
        i += 2;
      }
      return obj;
    }
    case 'array': {
      return elementChildren(el).map((child) => parseNode(child, decodeData));
    }
    case 'string':
      return el.textContent ?? '';
    case 'integer': {
      const raw = (el.textContent ?? '').trim();
      const num = Number.parseInt(raw, 10);
      if (!Number.isFinite(num)) throw new Error(`Invalid <integer>: "${raw}".`);
      return num;
    }
    case 'real': {
      const raw = (el.textContent ?? '').trim();
      const num = Number.parseFloat(raw);
      if (!Number.isFinite(num)) throw new Error(`Invalid <real>: "${raw}".`);
      return num;
    }
    case 'true':
      return true;
    case 'false':
      return false;
    case 'date':
      return (el.textContent ?? '').trim();
    case 'data': {
      const raw = (el.textContent ?? '').trim();
      if (decodeData) {
        try {
          return decodeBase64Text(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    }
    default:
      throw new Error(`Unsupported plist element <${tag}>.`);
  }
}

export default function PlistToJsonTool() {
  const [pretty, setPretty] = useState(true);
  const [decodeData, setDecodeData] = useState(false);
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const parser = new DOMParser();
      const doc = parser.parseFromString(input, 'application/xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Invalid XML: ' + (parserError.textContent ?? 'parse error').trim());
      }
      const root = doc.documentElement;
      if (!root) throw new Error('Empty document.');
      let valueEl: Element | undefined;
      if (root.tagName.toLowerCase() === 'plist') {
        valueEl = elementChildren(root)[0];
      } else {
        valueEl = root;
      }
      if (!valueEl) throw new Error('No value element found inside <plist>.');
      const js = parseNode(valueEl, decodeData);
      if (!pretty) return JSON.stringify(js);
      const space = indent === 'tab' ? '\t' : Number(indent);
      return JSON.stringify(js, null, space);
    },
    [pretty, decodeData, indent],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[pretty, decodeData, indent]}
      inputLabel="XML plist"
      outputLabel="JSON"
      inputPlaceholder="<plist><dict>...</dict></plist>"
      sample={SAMPLE}
      downloadName="plist.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Output">
            <Switch checked={pretty} onCheckedChange={setPretty} />
            <span className="text-2xs text-muted-foreground">{pretty ? 'Pretty' : 'Minified'}</span>
          </Field>
          {pretty && (
            <Field label="Indent">
              <Select value={indent} onValueChange={(v) => setIndent(v as '2' | '4' | 'tab')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Decode <data>" hint="Base64 -> UTF-8 text">
            <Switch checked={decodeData} onCheckedChange={setDecodeData} />
          </Field>
        </>
      }
    />
  );
}
