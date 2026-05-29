'use client';

import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';

import { ToolShell } from '@/components/tools/tool-shell';
import { getToolMeta, getToolComponent } from '@/lib/registry';
import { useRecents } from '@/lib/hooks/use-tool-history';

function ToolSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

export function ToolHost({ slug }: { slug: string }) {
  const tool = getToolMeta(slug);
  const loader = getToolComponent(slug);
  const { push } = useRecents();

  useEffect(() => {
    if (tool) push(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const Lazy = useMemo(
    () => (loader ? lazy(loader) : null),
    [loader]
  );

  if (!tool || !Lazy) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        Tool not found.
      </div>
    );
  }

  return (
    <ToolShell tool={tool}>
      <Suspense fallback={<ToolSkeleton />}>
        <Lazy />
      </Suspense>
    </ToolShell>
  );
}
