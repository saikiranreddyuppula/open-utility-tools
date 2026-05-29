import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold">You’re offline</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This page isn’t cached yet. Most tools work fully offline once visited —
        head back to a tool you’ve opened before.
      </p>
      <Button asChild>
        <Link href="/">All tools</Link>
      </Button>
    </div>
  );
}
