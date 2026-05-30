import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ToolHost } from '@/components/tools/tool-host';
import { getAllSlugs, getToolMeta, CATEGORY_META } from '@/lib/registry';

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
  return {
    title: tool.name,
    description: tool.description,
    keywords: [...tool.tags, ...tool.keywords, cat.name],
    openGraph: { title: `${tool.name} — Open Utility Tools`, description: tool.description },
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
  return <ToolHost slug={slug} />;
}
