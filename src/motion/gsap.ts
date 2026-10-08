// Core GSAP used on every page: gsap, ScrollTrigger and the React hook. Feature plugins live in their own modules
// (smoother.ts, split.ts, flip.ts, drag.ts) so a page only ships the plugins its components actually import.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };
