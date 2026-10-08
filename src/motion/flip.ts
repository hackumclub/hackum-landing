// Flip: animated re-layout of the members grid and the events results.
import { Flip } from "gsap/Flip";
import { gsap } from "./gsap";

if (typeof window !== "undefined") gsap.registerPlugin(Flip);
export { Flip };
