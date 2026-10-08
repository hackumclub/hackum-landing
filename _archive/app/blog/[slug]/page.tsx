import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import posts from "@/data/blog.json";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export default function Page({ params }: PageProps<"/blog/[slug]">) {
  return <Suspense fallback={<div className="min-h-[60vh]" />}><Content params={params} /></Suspense>;
}

async function Content({ params }: Pick<PageProps<"/blog/[slug]">, "params">) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/blog" className="text-sm text-brand">All posts</Link>
      <h1 className="mt-4 font-display text-4xl font-black">{post.title}</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">{post.excerpt}…</p>
      <p className="mt-8 text-sm text-faint">Preview only — full article text isn’t mirrored in this clone.</p>
    </article>
  );
}
