'use client';

import { useEffect, useState } from 'react';
import { File as FileIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';

export interface ResultPreviewProps {
  data: Blob | null;
  mime?: string;
  filename?: string;
  className?: string;
}

/** Render an image result from a blob (object URL revoked on unmount), or a
 * compact binary card with size for non-image data. */
export function ResultPreview({ data, mime, filename, className }: ResultPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data]);

  if (!data || !url) {
    return (
      <div
        className={cn(
          'bg-grid flex min-h-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground',
          className
        )}
      >
        No preview
      </div>
    );
  }

  const isImage = (mime ?? data.type).startsWith('image/');

  if (isImage) {
    return (
      <div
        className={cn(
          'bg-grid flex min-h-40 items-center justify-center overflow-hidden rounded-md border p-2',
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename ?? 'result'}
          className="max-h-[320px] max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-24 items-center gap-3 rounded-md border bg-muted/30 p-4',
        className
      )}
    >
      <FileIcon className="size-6 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate font-mono text-xs">{filename ?? 'result'}</p>
        <p className="text-2xs text-muted-foreground">{formatBytes(data.size)}</p>
      </div>
    </div>
  );
}
