'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE = `#nav .item a
.btn.btn-primary
ul li a:hover
div p
a::before
*
.menu :not(.active) span
[type="text"]`;

interface Scored {
  selector: string;
  a: number;
  b: number;
  c: number;
  score: number;
}

// Compute (a,b,c) specificity for a single (complex) selector string.
function specificity(selector: string): { a: number; b: number; c: number } {
  let s = selector;
  let a = 0;
  let b = 0;
  let c = 0;

  // Pull out :not(...), :is(...), :where(...), :has(...) arguments first so we can
  // recurse: :where() contributes 0, others contribute the max specificity of the
  // most-specific argument. We approximate by summing the inner selector's score.
  const funcRe = /:(not|is|matches|has|where)\(([^()]*)\)/gi;
  let match: RegExpExecArray | null;
  // Replace functional pseudo-classes iteratively to handle one nesting level.
  while ((match = funcRe.exec(s)) !== null) {
    const fnName = (match[1] ?? '').toLowerCase();
    const inner = match[2] ?? '';
    if (fnName !== 'where') {
      // Take the most specific argument among comma-separated alternatives.
      const alts = inner.split(',');
      let best = { a: 0, b: 0, c: 0 };
      let bestScore = -1;
      for (const alt of alts) {
        const sp = specificity(alt.trim());
        const sc = sp.a * 10000 + sp.b * 100 + sp.c;
        if (sc > bestScore) { bestScore = sc; best = sp; }
      }
      a += best.a; b += best.b; c += best.c;
    }
  }
  // Remove all functional pseudo-classes from the string before counting the rest.
  s = s.replace(funcRe, ' ');

  // Strings inside attribute selectors can contain symbols — neutralize them.
  const attrs = s.match(/\[[^\]]*\]/g);
  if (attrs) b += attrs.length; // each attribute selector counts as b
  s = s.replace(/\[[^\]]*\]/g, ' ');

  // ID selectors: #id
  const ids = s.match(/#[A-Za-z_][\w-]*/g);
  if (ids) a += ids.length;
  s = s.replace(/#[A-Za-z_][\w-]*/g, ' ');

  // Pseudo-elements (::before) count as c (type). Handle BEFORE pseudo-classes
  // since both start with ':'.
  const pseudoEls = s.match(/::[A-Za-z-]+/g);
  if (pseudoEls) c += pseudoEls.length;
  s = s.replace(/::[A-Za-z-]+/g, ' ');
  // Legacy single-colon pseudo-elements
  const legacyEls = s.match(/:(?:before|after|first-line|first-letter)\b/g);
  if (legacyEls) c += legacyEls.length;
  s = s.replace(/:(?:before|after|first-line|first-letter)\b/g, ' ');

  // Pseudo-classes (:hover) count as b
  const pseudoCls = s.match(/:[A-Za-z-]+/g);
  if (pseudoCls) b += pseudoCls.length;
  s = s.replace(/:[A-Za-z-]+/g, ' ');

  // Classes: .name
  const classes = s.match(/\.[A-Za-z_][\w-]*/g);
  if (classes) b += classes.length;
  s = s.replace(/\.[A-Za-z_][\w-]*/g, ' ');

  // Type selectors / element names — ignore universal '*' and combinators.
  s = s.replace(/[>+~*]/g, ' ');
  const types = s.match(/[A-Za-z_][\w-]*/g);
  if (types) c += types.length;

  return { a, b, c };
}

export default function CssSpecificitySorterTool() {
  const [text, setText] = useState(SAMPLE);

  const scored = useMemo(() => {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const rows: Scored[] = lines.map((sel) => {
      const { a, b, c } = specificity(sel);
      return { selector: sel, a, b, c, score: a * 10000 + b * 100 + c };
    });
    rows.sort((x, y) => y.score - x.score);
    return rows;
  }, [text]);

  const tieFlags = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of scored) counts.set(r.score, (counts.get(r.score) ?? 0) + 1);
    return counts;
  }, [scored]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Selectors (one per line)" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={8}
            className="font-mono text-sm"
            placeholder="#nav .item a"
          />
        </div>
      </Panel>

      {scored.length > 0 && (
        <Panel>
          <PanelHeader title="Ranked by specificity (highest wins)">
            <CopyButton
              value={() => scored.map((r) => `(${r.a},${r.b},${r.c})  ${r.selector}`).join('\n')}
            />
          </PanelHeader>
          <div className="divide-y">
            {scored.map((r, i) => {
              const tie = (tieFlags.get(r.score) ?? 0) > 1;
              return (
                <div key={`${r.selector}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <code className="w-24 shrink-0 font-mono text-sm">({r.a},{r.b},{r.c})</code>
                  <code className="min-w-0 flex-1 truncate font-mono text-sm">{r.selector}</code>
                  {tie && <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-2xs text-amber-600">tie</span>}
                  <CopyButton value={r.selector} size="icon-sm" />
                </div>
              );
            })}
          </div>
          <StatBar items={[`${scored.length} selector${scored.length === 1 ? '' : 's'}`, 'Format: (ID, class+attr+pseudo-class, type+pseudo-element)']} />
        </Panel>
      )}
    </div>
  );
}
