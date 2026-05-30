import { serializeJsonLd } from '@/lib/seo/jsonld';

type JsonLdGraph = Parameters<typeof serializeJsonLd>[0];

/**
 * Renders a structured-data block into the static HTML. Must be used from a
 * Server Component (all our page.tsx wrappers are) so it lands in the prerender.
 */
export function JsonLd({ graph }: { graph: JsonLdGraph }) {
  return (
    <script
      type="application/ld+json"
      // Pre-escaped (`<` -> <) in serializeJsonLd to prevent script-tag breakout.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
