"use client";
import { useRef } from "react";
import { gsap, useGSAP } from "@/motion/gsap";
import { MQ } from "@/motion/config";

const INTERACTIVE = "a, button, [role='button'], label, summary, [data-cursor]";
type Kind = "view" | "drag" | "open";

// Icon per cursor state: eye for previews, ↔ for draggable areas, ↗ for cards that open a page.
const ICONS: Record<Kind, React.ReactNode> = {
  view: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  drag: <><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /><path d="M3 12h18" /></>,
  open: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
};

/**
 * Custom cursor driven by gsap.quickTo: a precise dot and an eased ring. Over interactive elements the ring
 * grows; elements with data-cursor="view|drag|open" turn it into a filled #0085CA disc with an icon.
 * Elements with data-cursor-magnetic lean toward the pointer. Desktop hover pointers with motion only.
 */
export default function Cursor() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MQ.full, () => {
      const html = document.documentElement;
      const d = root.current!.querySelector<HTMLElement>("[data-dot]")!;
      const r = root.current!.querySelector<HTMLElement>("[data-ring]")!;
      const icons = gsap.utils.toArray<HTMLElement>("[data-cursor-icon]", root.current!);
      html.classList.add("has-cursor");
      gsap.set([d, r], { xPercent: -50, yPercent: -50, opacity: 0 });
      const dx = gsap.quickTo(d, "x", { duration: 0.1, ease: "power3" }), dy = gsap.quickTo(d, "y", { duration: 0.1, ease: "power3" });
      const rx = gsap.quickTo(r, "x", { duration: 0.45, ease: "power3" }), ry = gsap.quickTo(r, "y", { duration: 0.45, ease: "power3" });
      let magnet: HTMLElement | null = null;
      let mx: ((v: number) => void) | null = null, my: ((v: number) => void) | null = null;
      let kind: Kind | "link" | null = null;
      let shown = false;

      const setKind = (k: Kind | "link" | null) => {
        if (k === kind) return;
        kind = k;
        icons.forEach((el) => gsap.to(el, { opacity: el.dataset.cursorIcon === k ? 1 : 0, scale: el.dataset.cursorIcon === k ? 1 : 0.4, duration: 0.25 }));
        if (k === "view" || k === "drag" || k === "open") {
          gsap.to(r, { width: 64, height: 64, backgroundColor: "rgba(0,133,202,0.95)", borderColor: "rgba(0,133,202,0)", duration: 0.3, ease: "power3" });
          gsap.to(d, { scale: 0, duration: 0.2 });
        } else if (k === "link") {
          gsap.to(r, { width: 52, height: 52, backgroundColor: "rgba(0,133,202,0.12)", borderColor: "rgba(0,133,202,0.55)", duration: 0.3 });
          gsap.to(d, { scale: 0.6, duration: 0.2 });
        } else {
          gsap.to(r, { width: 32, height: 32, backgroundColor: "rgba(0,133,202,0)", borderColor: "rgba(0,133,202,0.45)", duration: 0.3 });
          gsap.to(d, { scale: 1, duration: 0.2 });
        }
      };

      // Subtle magnetic pull: a small fraction of the offset, capped at 5px so elements never drift far.
      const pull = (v: number) => gsap.utils.clamp(-5, 5, v * 0.1);
      const move = (e: PointerEvent) => {
        // Fade in once (not a new tween on every move); `leave` resets the flag.
        if (!shown) { shown = true; gsap.to([d, r], { opacity: 1, duration: 0.2, overwrite: "auto" }); }
        dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
        if (magnet && mx && my) {
          const b = magnet.getBoundingClientRect();
          mx(pull(e.clientX - (b.left + b.width / 2))); my(pull(e.clientY - (b.top + b.height / 2)));
        }
      };
      const over = (e: PointerEvent) => {
        const t = e.target as Element | null;
        const el = t?.closest<HTMLElement>(INTERACTIVE);
        const k = el?.dataset.cursor as Kind | undefined;
        setKind(k && k in ICONS ? k : el ? "link" : null);
        const m = t?.closest<HTMLElement>("[data-cursor-magnetic]") ?? null;
        if (m !== magnet) {
          if (magnet) gsap.to(magnet, { x: 0, y: 0, duration: 0.4, ease: "power3.out", overwrite: true });
          magnet = m;
          mx = m ? gsap.quickTo(m, "x", { duration: 0.4, ease: "power3" }) : null;
          my = m ? gsap.quickTo(m, "y", { duration: 0.4, ease: "power3" }) : null;
        }
      };
      const leave = () => { shown = false; gsap.to([d, r], { opacity: 0, duration: 0.2, overwrite: "auto" }); };
      const down = () => gsap.to(r, { scale: 0.85, duration: 0.15 });
      const up = () => gsap.to(r, { scale: 1, duration: 0.3, ease: "back.out(3)" });

      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("pointerover", over, { passive: true });
      html.addEventListener("pointerleave", leave);
      window.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", up);
      return () => {
        html.classList.remove("has-cursor");
        window.removeEventListener("pointermove", move);
        document.removeEventListener("pointerover", over);
        html.removeEventListener("pointerleave", leave);
        window.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
      };
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} data-cursor-root aria-hidden className="pointer-events-none fixed inset-0 z-[100] hidden [@media(pointer:fine)]:block">
      <div data-ring className="fixed left-0 top-0 grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-brand/45 opacity-0">
        {(Object.keys(ICONS) as Kind[]).map((k) => (
          <svg key={k} data-cursor-icon={k} viewBox="0 0 24 24" className="col-start-1 row-start-1 h-6 w-6 fill-none stroke-white stroke-2 opacity-0 [stroke-linecap:round] [stroke-linejoin:round]">{ICONS[k]}</svg>
        ))}
      </div>
      <div data-dot className="fixed left-0 top-0 h-2 w-2 rounded-full bg-brand opacity-0" />
    </div>
  );
}
