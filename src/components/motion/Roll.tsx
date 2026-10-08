/** Roll-over label for links/buttons (CSS in globals.css `.roll`). The copy is aria-hidden so it's read once. */
export default function Roll({ children }: { children: React.ReactNode }) {
  return (
    <span className="roll">
      <span>{children}</span>
      <span aria-hidden>{children}</span>
    </span>
  );
}
