import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CategoryView } from '@/components/category-view';
import { CATEGORIES, CATEGORY_META, type ToolCategory } from '@/lib/registry';

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
  return { title: meta.name, description: meta.description };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!CATEGORIES.includes(id as ToolCategory)) notFound();
  return <CategoryView category={id as ToolCategory} />;
}
