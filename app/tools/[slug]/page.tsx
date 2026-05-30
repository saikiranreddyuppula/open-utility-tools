import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ToolHost } from '@/components/tools/tool-host';
import { JsonLd } from '@/components/seo/json-ld';
import { getAllSlugs, getToolMeta, CATEGORY_META } from '@/lib/registry';
import { toolTitle, toolDescription } from '@/lib/seo/meta';
import { buildToolGraph } from '@/lib/seo/jsonld';
import { SITE_NAME, OG_WIDTH, OG_HEIGHT, X_HANDLE, toolOgImage } from '@/lib/seo/site';

/** Every tool becomes a prebuilt static page under out/tools/<slug>/. */
export function generateStaticParams(): { slug: string }[] {
  return getAllSlugs().map((slug) => ({ slug }));
}

// Unknown slugs 404 at build instead of attempting on-demand rendering.
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolMeta(slug);
  if (!tool) return {};
  const cat = CATEGORY_META[tool.category];
  const title = toolTitle(tool.name, tool.category);
  const description = toolDescription(tool.description, tool.category);
  const ogImage = toolOgImage(slug);
  const alt = `${tool.name} — ${cat.name} | ${SITE_NAME}`;
  // Hidden/deferred tools stay routable but must not be indexed (they're also
  // excluded from the sitemap) — keep build and sitemap in lock-step.
  const indexable = !tool.hidden;
  return {
    title,
    description,
    // keywords meta intentionally omitted — Google ignores it and it leaks the
    // target-keyword list. tags/keywords stay in the registry for on-page use.
    alternates: { canonical: `/tools/${slug}/` },
    robots: {
      index: indexable,
      follow: indexable,
      googleBot: {
        index: indexable,
        follow: indexable,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    // A page-level openGraph REPLACES the layout's (shallow merge), so re-state
    // type/siteName/locale here or they'd be dropped for tool pages.
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: `/tools/${slug}/`,
      title: tool.name,
      description,
      images: [{ url: ogImage, width: OG_WIDTH, height: OG_HEIGHT, type: 'image/png', alt }],
    },
    twitter: {
      card: 'summary_large_image',
      site: X_HANDLE,
      creator: X_HANDLE,
      title: tool.name,
      description,
      images: [ogImage],
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = getToolMeta(slug);
  if (!tool) notFound();
  return (
    <>
      <JsonLd graph={buildToolGraph(tool)} />
      <ToolHost slug={slug} />
    </>
  );
}
