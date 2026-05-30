/**
 * schema.org JSON-LD builders, injected as <script type="application/ld+json">
 * from the server-rendered page components (baked into the static HTML).
 *
 * Guardrails (Google structured-data policy):
 *  - NO aggregateRating / review — there are no real user ratings; fabricating
 *    them risks a manual action across all pages.
 *  - NO WebSite.potentialAction SearchAction (Sitelinks Search Box was
 *    deprecated by Google in Nov 2024).
 *  - Every URL is absolute, https + www, trailing slash — matching canonical.
 */
import {
  CATEGORY_META,
  getToolsByCategory,
  type CategoryMeta,
  type ToolCategory,
  type ToolMetaStatic,
} from '@/lib/registry';
import {
  SITE_NAME,
  SITE_URL,
  SITE_TAGLINE,
  GITHUB_URL,
  X_URL,
  LOGO_URL,
  toolOgImage,
  categoryOgImage,
} from './site';

type JsonLdGraph = { '@context': 'https://schema.org'; '@graph': Record<string, unknown>[] };

const WEBSITE_ID = `${SITE_URL}/#website`;
const ORG_ID = `${SITE_URL}/#org`;

/** schema.org applicationCategory bucket per tool category. */
const APPLICATION_CATEGORY: Record<ToolCategory, string> = {
  crypto: 'DeveloperApplication',
  encoding: 'DeveloperApplication',
  data: 'DeveloperApplication',
  convert: 'DeveloperApplication',
  web: 'DeveloperApplication',
  generators: 'DeveloperApplication',
  color: 'DesignApplication',
  image: 'DesignApplication',
  pdf: 'UtilitiesApplication',
  text: 'UtilitiesApplication',
  time: 'UtilitiesApplication',
  math: 'UtilitiesApplication',
};

/** Sitewide WebSite + Organization nodes (rendered once, on the homepage). */
function organizationNode(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: LOGO_URL,
    description:
      'A privacy-first collection of free developer & file utilities that run entirely in your browser.',
    sameAs: [GITHUB_URL, X_URL],
  };
}

/**
 * Inline publisher carried on every tool/category page so the @id reference
 * resolves in-page (and stitches to the homepage Organization via the same @id),
 * rather than dangling.
 */
function publisherRef(): Record<string, unknown> {
  return { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME, url: `${SITE_URL}/`, logo: LOGO_URL };
}

export function buildHomeGraph(toolCount: number): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: SITE_NAME,
        alternateName: SITE_TAGLINE,
        url: `${SITE_URL}/`,
        description: `A fast, privacy-first collection of ${toolCount}+ developer & file utilities that run entirely in your browser.`,
        inLanguage: 'en',
        publisher: { '@id': ORG_ID },
      },
      organizationNode(),
    ],
  };
}

/** Per-tool: BreadcrumbList + WebApplication. */
export function buildToolGraph(tool: ToolMetaStatic): JsonLdGraph {
  const cat = CATEGORY_META[tool.category];
  const toolUrl = `${SITE_URL}/tools/${tool.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: cat.name,
            item: `${SITE_URL}/categories/${tool.category}/`,
          },
          { '@type': 'ListItem', position: 3, name: tool.name },
        ],
      },
      {
        '@type': 'WebApplication',
        name: tool.name,
        description: tool.description,
        url: toolUrl,
        image: toolOgImage(tool.slug),
        applicationCategory: APPLICATION_CATEGORY[tool.category],
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires a modern web browser with JavaScript.',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isAccessibleForFree: true,
        inLanguage: 'en',
        publisher: publisherRef(),
      },
    ],
  };
}

/** Per-category: BreadcrumbList + CollectionPage wrapping an ItemList of tools. */
export function buildCategoryGraph(meta: CategoryMeta): JsonLdGraph {
  const tools = getToolsByCategory(meta.id);
  const categoryUrl = `${SITE_URL}/categories/${meta.id}/`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: meta.name },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: `${meta.name} Tools`,
        description: meta.description,
        url: categoryUrl,
        image: categoryOgImage(meta.id),
        isPartOf: { '@type': 'WebSite', '@id': WEBSITE_ID, name: SITE_NAME, url: `${SITE_URL}/` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: tools.length,
          // 'item' is the canonical ListItem link property for a summary-page
          // ItemList (Google ignores a bare 'url' here).
          itemListElement: tools.map((t, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: t.name,
            item: `${SITE_URL}/tools/${t.slug}/`,
          })),
        },
      },
    ],
  };
}

/**
 * Serialize for dangerouslySetInnerHTML. Escaping `<` (and the `</script` case)
 * prevents the JSON-LD payload from breaking out of the <script> element — the
 * standard XSS guard Next.js documents for inline JSON.
 */
export function serializeJsonLd(graph: JsonLdGraph): string {
  return JSON.stringify(graph)
    .replace(/</g, '\\u003c')
    // U+2028/U+2029 are valid in JSON strings but terminate a line in some JS
    // parsers, which would break the inline <script>.
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
