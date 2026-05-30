import { HomeView } from '@/components/home-view';
import { JsonLd } from '@/components/seo/json-ld';
import { TOTAL_TOOL_COUNT } from '@/lib/registry';
import { buildHomeGraph } from '@/lib/seo/jsonld';

export default function HomePage() {
  return (
    <>
      <JsonLd graph={buildHomeGraph(TOTAL_TOOL_COUNT)} />
      <HomeView />
    </>
  );
}
