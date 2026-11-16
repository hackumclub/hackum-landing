import { notFound } from "next/navigation";

// Any path under /[lang] that no other route matches ends up here and renders app/[lang]/not-found.tsx,
// inside the normal header/footer, in the visitor's language, with a real 404 status.
export default function CatchAll() {
  notFound();
}
