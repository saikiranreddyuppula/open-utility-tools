'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeTag(key: string): string {
  return /^[a-zA-Z_][\w.-]*$/.test(key) ? key : 'item';
}

function toXml(value: unknown, key: string, indent: number): string {
  const pad = '  '.repeat(indent);
  const tag = safeTag(key);
  if (value === null || value === undefined) return `${pad}<${tag}/>`;
  if (Array.isArray(value)) {
    return value.map((v) => toXml(v, key, indent)).join('\n');
  }
  if (typeof value === 'object') {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => toXml(v, k, indent + 1))
      .join('\n');
    return `${pad}<${tag}>\n${inner}\n${pad}</${tag}>`;
  }
  return `${pad}<${tag}>${esc(String(value))}</${tag}>`;
}

export default function JsonToXmlTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    let data: unknown;
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
    }
    const body =
      typeof data === 'object' && data !== null && !Array.isArray(data)
        ? Object.entries(data as Record<string, unknown>)
            .map(([k, v]) => toXml(v, k, 1))
            .join('\n')
        : toXml(data, 'item', 1);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${body}\n</root>`;
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="JSON"
      outputLabel="XML"
      sample={'{\n  "user": { "id": 1, "name": "Ada", "roles": ["admin", "dev"] }\n}'}
      downloadName="data.xml"
      downloadMime="application/xml"
    />
  );
}
