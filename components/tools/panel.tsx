'use client';

import { cn } from '@/lib/utils';

/** A bordered workspace panel; structure via hairlines, not whitespace. */
export function Panel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col overflow-hidden rounded-lg border bg-card', className)}
      {...props}
    />
  );
}

/** Panel section header bar (e.g. "INPUT" with action buttons on the right). */
export function PanelHeader({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center gap-1 border-b bg-muted/40 px-2',
        className
      )}
    >
      {title && (
        <span className="px-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      )}
      <div className="ml-auto flex items-center gap-0.5">{children}</div>
    </div>
  );
}

/** The options toolbar that spans the top of a tool workspace. */
export function OptionsBar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border bg-muted/40 p-3',
        className
      )}
      {...props}
    />
  );
}

/** A labeled field for the options bar. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={htmlFor}
        className="text-2xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint && <span className="text-2xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** The live stat footer: mono, tabular numbers. */
export function StatBar({
  items,
  className,
}: {
  items: (string | null | undefined | false)[];
  className?: string;
}) {
  const shown = items.filter(Boolean) as string[];
  return (
    <div
      className={cn(
        'flex h-7 shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-t bg-muted/30 px-3 font-mono text-2xs text-muted-foreground tabular',
        className
      )}
    >
      {shown.map((s, i) => (
        <span key={i} className="whitespace-nowrap">
          {s}
        </span>
      ))}
    </div>
  );
}
