'use client';

import { useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';

const SAMPLE = `User-agent: *
Disallow: /private/
Disallow: /tmp/
Allow: /private/public.html
Crawl-delay: 10

User-agent: Googlebot
Disallow: /no-google/
Allow: /

Sitemap: https://example.com/sitemap.xml`;

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay: string | null;
}

interface Parsed {
  groups: Group[];
  sitemaps: string[];
}

function parseRobots(body: string): Parsed {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;

    if (field === 'sitemap') {
      sitemaps.push(value);
      continue;
    }
    if (!current) continue;
    if (field === 'disallow') {
      current.rules.push({ allow: false, pattern: value });
    } else if (field === 'allow') {
      current.rules.push({ allow: true, pattern: value });
    } else if (field === 'crawl-delay') {
      current.crawlDelay = value;
    }
  }

  return { groups, sitemaps };
}

/** Pick the most specific matching group for a user-agent (longest token, else *). */
function selectGroup(groups: Group[], ua: string): Group | null {
  const uaLower = ua.toLowerCase();
  let best: Group | null = null;
  let bestLen = -1;
  let star: Group | null = null;

  for (const g of groups) {
    for (const agent of g.agents) {
      if (agent === '*') {
        if (!star) star = g;
        continue;
      }
      if (uaLower.includes(agent) && agent.length > bestLen) {
        best = g;
        bestLen = agent.length;
      }
    }
  }
  return best ?? star;
}

/** Convert a robots path pattern (with * and $) to a RegExp, matching from start. */
function patternToRegex(pattern: string): RegExp {
  let re = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i] ?? '';
    if (ch === '*') {
      re += '.*';
    } else if (ch === '$') {
      re += '$';
    } else {
      re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(re);
}

interface MatchResult {
  allowed: boolean;
  rule: Rule | null;
}

function evaluate(group: Group, path: string): MatchResult {
  let best: Rule | null = null;
  let bestLen = -1;

  for (const rule of group.rules) {
    if (rule.pattern === '') continue;
    let matches: boolean;
    try {
      matches = patternToRegex(rule.pattern).test(path);
    } catch {
      matches = false;
    }
    if (!matches) continue;
    // Effective length = pattern length sans wildcard markers.
    const len = rule.pattern.replace(/[*$]/g, '').length;
    if (len > bestLen || (len === bestLen && rule.allow && best && !best.allow)) {
      best = rule;
      bestLen = len;
    }
  }

  // Empty Disallow or no rule = allowed.
  if (!best) return { allowed: true, rule: null };
  return { allowed: best.allow, rule: best };
}

export default function RobotsTxtTesterTool() {
  const [agent, setAgent] = useState('Googlebot');
  const [paths, setPaths] = useState('/private/public.html\n/private/secret.html\n/no-google/x\n/index.html');

  const transform = useMemo(
    () => (input: string) => {
      if (!input.trim()) return '';
      const parsed = parseRobots(input);
      const ua = agent.trim() || '*';
      const group = selectGroup(parsed.groups, ua);

      const out: string[] = [];
      out.push(`User-agent tested: ${ua}`);
      if (group) {
        out.push(`Matched group: ${group.agents.join(', ')}`);
        if (group.crawlDelay) out.push(`Crawl-delay: ${group.crawlDelay}`);
      } else {
        out.push('Matched group: (none — everything allowed)');
      }
      out.push('');

      const testPaths = paths.split('\n').map((p) => p.trim()).filter((p) => p !== '');
      if (testPaths.length === 0) {
        out.push('(enter one or more paths to test in the options)');
      }

      for (const p of testPaths) {
        let path = p;
        if (/^https?:\/\//i.test(p)) {
          try {
            const u = new URL(p);
            path = u.pathname + u.search;
          } catch {
            /* keep raw */
          }
        }
        if (!group) {
          out.push(`ALLOWED   ${p}\t(no matching group; default allow)`);
          continue;
        }
        const res = evaluate(group, path);
        const verdict = res.allowed ? 'ALLOWED  ' : 'DISALLOWED';
        const ruleStr = res.rule
          ? `${res.rule.allow ? 'Allow' : 'Disallow'}: ${res.rule.pattern}`
          : '(no rule matched → default allow)';
        out.push(`${verdict} ${p}\t${ruleStr}`);
      }

      if (parsed.sitemaps.length > 0) {
        out.push('');
        out.push('--- Sitemaps ---');
        for (const s of parsed.sitemaps) out.push(s);
      }

      return out.join('\n');
    },
    [agent, paths],
  );

  const options = (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="User-agent" className="min-w-[180px]">
        <Input
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          placeholder="Googlebot"
          className="font-mono"
          spellCheck={false}
        />
      </Field>
      <Field label="Paths to test (one per line)" className="min-w-[280px] flex-1">
        <textarea
          value={paths}
          onChange={(e) => setPaths(e.target.value)}
          rows={3}
          spellCheck={false}
          className="w-full resize-y rounded-md border bg-transparent px-2 py-1.5 font-mono text-xs"
          placeholder="/private/page.html"
        />
      </Field>
    </div>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[agent, paths]}
      inputLabel="robots.txt"
      outputLabel="Results"
      inputPlaceholder="Paste robots.txt contents…"
      sample={SAMPLE}
      downloadName="robots-test.txt"
      options={options}
    />
  );
}
