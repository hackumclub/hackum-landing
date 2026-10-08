export const metadata = { title: "Sign in | Hackum" };

export default function Page() {
  return (
    <section className="mx-auto max-w-sm px-4 py-20">
      <h1 className="mb-2 font-display text-3xl font-black">Sign in</h1>
      <p className="mb-6 text-faint">The best way to predict the future is to invent it.</p>
      {/* UI only: no auth backend is wired up. */}
      <form className="grid gap-3">
        <input type="email" required placeholder="Email" aria-label="Email" autoComplete="email" className="rounded-[8px] bg-chip px-4 py-3 outline-none focus:ring-2 focus:ring-brand" />
        <button type="button" className="rounded-[8px] bg-brand py-3 font-semibold text-white">Continue with email</button>
        <button type="button" className="rounded-[8px] bg-lav py-3 font-bold text-brand">Continue with GitHub</button>
      </form>
    </section>
  );
}
