import { SavedToolsView } from '@/components/saved-tools-view';

export const metadata = { title: 'Favorites', robots: { index: false, follow: false } };

export default function FavoritesPage() {
  return <SavedToolsView kind="favorites" />;
}
