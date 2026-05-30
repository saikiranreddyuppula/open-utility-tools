import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CategoryView } from '@/components/category-view';
import { JsonLd } from '@/components/seo/json-ld';
import { CATEGORIES, CATEGORY_META, type ToolCategory } from '@/lib/registry';
import { buildCategoryGraph } from '@/lib/seo/jsonld';
import { clampToWord } from '@/lib/seo/meta';
import { SITE_NAME, OG_WIDTH, OG_HEIGHT, X_HANDLE, categoryOgImage } from '@/lib/seo/site';

export function generateStaticParams(): { id: string }[] {
  return CATEGORIES.map((id) => ({ id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = CATEGORY_META[id as ToolCategory];
  if (!meta) return {};
  const title = `${meta.name} Tools - Free Online`;
  const description = clampToWord(
    `${meta.description}. Free, privacy-first ${meta.name.toLowerCase()} utilities that run entirely in your browser — no upload, works offline.`
  );
  const ogImage = categoryOgImage(id);
  return {
    title,
    description,
    alternates: { canonical: `/categories/${id}/` },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: `/categories/${id}/`,
      title: `${meta.name} Tools`,
      description,
      images: [
        {
          url: ogImage,
          width: OG_WIDTH,
          height: OG_HEIGHT,
          type: 'image/png',
          alt: `${meta.name} tools | ${SITE_NAME}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      site: X_HANDLE,
      creator: X_HANDLE,
      title: `${meta.name} Tools`,
      description,
      images: [ogImage],
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!CATEGORIES.includes(id as ToolCategory)) notFound();
  const meta = CATEGORY_META[id as ToolCategory];
  return (
    <>
      <JsonLd graph={buildCategoryGraph(meta)} />
      <CategoryView category={id as ToolCategory} />
    </>
  );
}
