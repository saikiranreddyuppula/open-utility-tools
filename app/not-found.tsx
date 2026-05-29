import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-5xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-lg font-semibold">Tool not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        That page doesn’t exist. Try searching with{' '}
        <kbd>⌘K</kbd>, or head back to all tools.
      </p>
      <Button asChild>
        <Link href="/">Browse all tools</Link>
      </Button>
    </div>
  );
}
