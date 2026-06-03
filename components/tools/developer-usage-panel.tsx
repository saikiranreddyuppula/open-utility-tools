'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, Clock3, Package, Terminal } from 'lucide-react';

import { CopyButton } from '@/components/tools/copy-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getToolUsageInfo } from '@/lib/npm-usage';
import type { ToolMetaStatic } from '@/lib/registry';

const NPM_URL = 'https://www.npmjs.com/package/@open-utility-tools/core';

export function DeveloperUsagePanel({ tool }: { tool: ToolMetaStatic }) {
  const usage = getToolUsageInfo(tool);
  const copyValue = `${usage.installCommand}\n\n${usage.snippet}`;

  return (
    <section className="mb-5 rounded-lg border bg-card">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Terminal className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Developer usage</h2>
              <UsageBadge status={usage.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{usage.note}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <CopyButton value={copyValue} label="Copy usage" variant="outline" />
          <Button size="sm" variant="ghost" asChild>
            <a href={NPM_URL} target="_blank" rel="noreferrer">
              npm
              <ArrowUpRight className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="border-b p-4 lg:border-b-0 lg:border-r">
          <p className="mb-2 text-2xs font-semibold uppercase text-muted-foreground">
            Install
          </p>
          <CodeBlock code={usage.installCommand} />
          {usage.importPath && (
            <>
              <p className="mb-2 mt-4 text-2xs font-semibold uppercase text-muted-foreground">
                Import path
              </p>
              <code className="block break-words rounded-md bg-muted px-3 py-2 font-mono text-xs">
                {usage.importPath}
              </code>
            </>
          )}
        </div>
        <div className="p-4">
          <p className="mb-2 text-2xs font-semibold uppercase text-muted-foreground">
            Usage
          </p>
          <CodeBlock code={usage.snippet} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/developers/">
                Developer docs
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            {usage.importName && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                <Package className="size-3.5" />
                {usage.importName}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function UsageBadge({ status }: { status: 'exact' | 'category' | 'planned' }) {
  if (status === 'exact') {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="size-3" />
        npm API
      </Badge>
    );
  }
  if (status === 'category') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Package className="size-3" />
        category API
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Clock3 className="size-3" />
      planned
    </Badge>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-6">
      <code>{code}</code>
    </pre>
  );
}
