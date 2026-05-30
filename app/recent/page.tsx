import { SavedToolsView } from '@/components/saved-tools-view';

export const metadata = { title: 'Recent', robots: { index: false, follow: false } };

export default function RecentPage() {
  return <SavedToolsView kind="recent" />;
}
