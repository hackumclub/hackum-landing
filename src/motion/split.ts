// SplitText: text reveals (components/motion/Split).
import { SplitText } from "gsap/SplitText";
import { gsap } from "./gsap";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText);
export { SplitText };
