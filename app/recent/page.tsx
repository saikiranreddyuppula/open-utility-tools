import { SavedToolsView } from '@/components/saved-tools-view';

export const metadata = { title: 'Recent' };

export default function RecentPage() {
  return <SavedToolsView kind="recent" />;
}
