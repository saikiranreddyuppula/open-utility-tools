'use client';

import { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/download';
import { cn } from '@/lib/utils';

export interface CopyButtonProps {
  /** Text to copy, or a function returning it (sync or async). */
  value: string | (() => string | Promise<string>);
  label?: string;
  size?: 'sm' | 'default' | 'icon-sm' | 'icon';
  variant?: 'ghost' | 'outline' | 'secondary';
  className?: string;
  disabled?: boolean;
}

export function CopyButton({
  value,
  label = 'Copy',
  size = 'sm',
  variant = 'ghost',
  className,
  disabled,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    const text = typeof value === 'function' ? await value() : value;
    if (!text) return;
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  const iconOnly = size === 'icon' || size === 'icon-sm';

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={cn(className)}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {!iconOnly && <span>{copied ? 'Copied' : label}</span>}
    </Button>
  );
}
