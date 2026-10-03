import { redirect } from "next/navigation";

export default async function ProductSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/products/${slug}`);
}
