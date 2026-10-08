import Link from "next/link";
import posts from "@/data/blog.json";

export const metadata = { title: "Blog | Hackum" };

export default function Page() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-8 font-display text-5xl font-black">Never stop building</h1>
      <ul className="divide-y divide-lav">
        {posts.map((p) => (
          <li key={p.slug} className="py-6">
            <Link href={`/blog/${p.slug}`} className="font-display text-xl font-extrabold hover:text-brand">{p.title}</Link>
            <p className="mt-2 line-clamp-2 text-muted">{p.excerpt}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
