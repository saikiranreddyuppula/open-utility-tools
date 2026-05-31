'use client';

import Link from 'next/link';
import { Wrench, Code2 } from 'lucide-react';

import { Icon } from '@/components/icon';
import { CATEGORIES, CATEGORY_META, getToolsByCategory, TOTAL_TOOL_COUNT } from '@/lib/registry';

const GITHUB_URL = 'https://github.com/saikiranreddyuppula/open-utility-tools';

export function SiteFooter() {
  const cats = CATEGORIES.filter((c) => getToolsByCategory(c).length > 0);
  const year = 2026;

  return (
    <footer className="mt-20 border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2fr]">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Wrench className="size-4" />
              </span>
              <span className="text-sm font-semibold tracking-tight">Open Utility Tools</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              {TOTAL_TOOL_COUNT}+ developer &amp; file utilities that run entirely in your
              browser. No uploads, no tracking — works fully offline.
            </p>
            <p className="mt-4 flex items-center gap-1.5 text-2xs text-muted-foreground">
              <span className="inline-block size-1.5 rounded-full bg-success" />
              All processing happens locally. No data leaves your device.
            </p>
          </div>

          {/* Category columns */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {cats.map((c) => {
              const meta = CATEGORY_META[c];
              return (
                <Link
                  key={c}
                  href={`/categories/${c}/`}
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon name={meta.icon} className="size-3.5" style={{ color: `var(${meta.accentVar})` }} />
                  {meta.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-2xs text-muted-foreground sm:flex-row">
          <span>© {year} Open Utility Tools · MIT licensed</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Code2 className="size-3.5" /> Source on GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
