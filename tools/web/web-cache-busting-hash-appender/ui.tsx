'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Strategy = 'manual' | 'date' | 'content';

const SAMPLE = `/assets/app.js
/assets/styles.css
https://cdn.example.com/img/logo.png?w=200
/vendor/lib.js?v=old#section`;

/** Stable 32-bit FNV-1a hash rendered as base36 — deterministic per content string. */
function hashContent(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force to unsigned and shorten.
  return (h >>> 0).toString(36);
}

function dateToken(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Rewrite one URL, preserving existing query params and fragment.
 * Works for both absolute and relative URLs by parsing against a dummy base.
 */
function rewriteUrl(
  raw: string,
  param: string,
  token: string,
  overwrite: boolean,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Separate fragment first (URL/URLSearchParams keep it, but we want full control).
  const hashIdx = trimmed.indexOf('#');
  const fragment = hashIdx === -1 ? '' : trimmed.slice(hashIdx);
  const noFragment = hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx);

  const qIdx = noFragment.indexOf('?');
  const base = qIdx === -1 ? noFragment : noFragment.slice(0, qIdx);
  const queryStr = qIdx === -1 ? '' : noFragment.slice(qIdx + 1);

  const params = new URLSearchParams(queryStr);
  const has = params.has(param);
  if (has && !overwrite) {
    // Leave the existing param untouched.
    return trimmed;
  }
  params.set(param, token);

  const newQuery = params.toString();
  return `${base}${newQuery ? `?${newQuery}` : ''}${fragment}`;
}

export default function CacheBustingUrlBuilder() {
  const [strategy, setStrategy] = useState<Strategy>('content');
  const [param, setParam] = useState('v');
  const [manualToken, setManualToken] = useState('1.0.0');
  const [content, setContent] = useState('');
  const [overwrite, setOverwrite] = useState(true);

  return (
    <TextToolLayout
      deps={[strategy, param, manualToken, content, overwrite]}
      transform={(input) => {
        const lines = input.split('\n');
        const cleanParam = param.trim() || 'v';

        let token: string;
        if (strategy === 'manual') {
          token = manualToken.trim();
          if (!token) throw new Error('Enter a manual version token.');
        } else if (strategy === 'date') {
          token = dateToken();
        } else {
          if (!content.trim()) {
            throw new Error(
              'Enter a content string in the options to derive a hash (e.g. paste the bundle source or a manifest).',
            );
          }
          token = hashContent(content);
        }

        const out: string[] = [];
        for (const line of lines) {
          if (!line.trim()) {
            out.push('');
            continue;
          }
          out.push(rewriteUrl(line, cleanParam, token, overwrite));
        }
        return out.join('\n');
      }}
      inputLabel="Asset URLs (one per line)"
      outputLabel="Rewritten URLs"
      inputPlaceholder={SAMPLE}
      sample={SAMPLE}
      downloadName="cache-busted-urls.txt"
      options={
        <>
          <Field label="Strategy">
            <Select value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual token</SelectItem>
                <SelectItem value="date">Current date</SelectItem>
                <SelectItem value="content">Content hash</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Param name">
            <Input
              value={param}
              onChange={(e) => setParam(e.target.value)}
              className="w-24"
              spellCheck={false}
            />
          </Field>
          {strategy === 'manual' && (
            <Field label="Version token">
              <Input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="w-40"
                spellCheck={false}
              />
            </Field>
          )}
          {strategy === 'content' && (
            <Field label="Content to hash" className="min-w-[240px] flex-1">
              <Input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="paste content / manifest string…"
                spellCheck={false}
              />
            </Field>
          )}
          <div className="flex items-center gap-2 self-end pb-1">
            <Switch id="overwrite" checked={overwrite} onCheckedChange={setOverwrite} />
            <Label htmlFor="overwrite" className="text-sm">
              Overwrite existing param
            </Label>
          </div>
        </>
      }
    />
  );
}
