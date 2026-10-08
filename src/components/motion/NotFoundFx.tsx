"use client";
import { gsap, useGSAP } from "@/motion/gsap";
import { EASE, MQ } from "@/motion/config";

/** Motion for the 404 page (renders nothing): content rises in, the Manul and 3D icons bob gently. */
export default function NotFoundFx() {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MQ.motion, () => {
      gsap.from("[data-nf] [data-in]", { y: 28, opacity: 0, duration: 0.7, ease: EASE.ui, stagger: 0.09 });
      gsap.to("[data-nf] [data-bob]", { y: -10, rotation: 3, duration: 2.8, ease: EASE.float, yoyo: true, repeat: -1, stagger: 0.4 });
    });
    return () => mm.revert();
  });
  return null;
}
