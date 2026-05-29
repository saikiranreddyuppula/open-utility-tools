import { SavedToolsView } from '@/components/saved-tools-view';

export const metadata = { title: 'Favorites' };

export default function FavoritesPage() {
  return <SavedToolsView kind="favorites" />;
}
