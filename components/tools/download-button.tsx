'use client';

import { useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { downloadFile, type DownloadData } from '@/lib/download';
import { cn } from '@/lib/utils';

export interface DownloadButtonProps {
  /** Data to download, or a function returning it (sync or async). */
  data: DownloadData | (() => DownloadData | Promise<DownloadData>);
  filename: string;
  mime?: string;
  label?: string;
  size?: 'sm' | 'default' | 'icon-sm' | 'icon';
  variant?: 'ghost' | 'outline' | 'secondary' | 'default';
  className?: string;
  disabled?: boolean;
}

export function DownloadButton({
  data,
  filename,
  mime,
  label = 'Download',
  size = 'sm',
  variant = 'ghost',
  className,
  disabled,
}: DownloadButtonProps) {
  const [busy, setBusy] = useState(false);

  const onClick = useCallback(async () => {
    setBusy(true);
    try {
      const resolved = typeof data === 'function' ? await data() : data;
      await downloadFile(resolved, filename, mime);
    } finally {
      setBusy(false);
    }
  }, [data, filename, mime]);

  const iconOnly = size === 'icon' || size === 'icon-sm';

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(className)}
      aria-label={label}
      title={label}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
}
