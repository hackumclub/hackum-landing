export const metadata = { title: "Changelog | Hackum" };

const ENTRIES = [
  ["Organizer dashboard", "Review applications, profiles and answers in one place."],
  ["Hackathon search", "Filter open hackathons by name, theme and online/offline mode."],
  ["Blog posts", "Post previews with individual pages."],
];

export default function Page() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-black">Changelog</h1>
      <ul className="mt-8 space-y-6">
        {ENTRIES.map(([t, d]) => <li key={t}><h2 className="font-semibold">{t}</h2><p className="text-muted">{d}</p></li>)}
      </ul>
    </section>
  );
}
