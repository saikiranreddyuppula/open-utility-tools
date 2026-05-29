'use client';

import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/download';

export interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  /** Accept attribute, e.g. "image/*" or ".csv,.tsv". */
  accept?: string;
  multiple?: boolean;
  /** Soft max size per file in bytes (warns, does not hard-block). */
  maxSize?: number;
  className?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
}

export function FileDropzone({
  onFiles,
  accept,
  multiple = false,
  maxSize,
  className,
  label = 'Drop files here',
  hint,
  disabled,
  compact,
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list);
      onFiles(multiple ? files : files.slice(0, 1));
    },
    [onFiles, multiple]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      handle(e.dataTransfer.files);
    },
    [handle, disabled]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'group relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 text-center transition-colors outline-none',
        'hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/40',
        dragging && 'border-primary bg-accent/60',
        disabled && 'pointer-events-none opacity-50',
        compact ? 'p-4' : 'p-8',
        className
      )}
    >
      <UploadCloud
        className={cn(
          'text-muted-foreground transition-transform group-hover:-translate-y-0.5',
          compact ? 'size-5' : 'size-7'
        )}
      />
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-2xs text-muted-foreground">
          {hint ?? (
            <>
              or <span className="text-foreground">click to browse</span>
              {maxSize ? ` · up to ${formatBytes(maxSize)}` : ''}
            </>
          )}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
