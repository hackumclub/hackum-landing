// Policy pages: lines extracted as flat text; short lines w/o terminal punctuation render as headings.
export default function Prose({ title, note, lines }: { title: string; note?: string; lines: string[] }) {
  const isHeading = (l: string) => l.length < 60 && !/[.:;,]$/.test(l);
  return (
    <article lang="en" className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-4 font-display text-4xl font-black md:text-5xl">{title}</h1>
      {note ? <p className="glass mb-8 rounded-2xl px-5 py-3 text-sm font-semibold text-muted">{note}</p> : null}
      {lines.map((l, i) =>
        isHeading(l) ? <h2 key={i} className="mb-2 mt-8 font-display text-xl font-extrabold">{l}</h2>
          : <p key={i} className="mb-3 leading-relaxed text-muted">{l}</p>)}
    </article>
  );
}
