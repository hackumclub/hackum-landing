// Draggable + InertiaPlugin: throwable hero stickers and the draggable poster wall (home page only).
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { gsap } from "./gsap";

if (typeof window !== "undefined") gsap.registerPlugin(Draggable, InertiaPlugin);
export { Draggable, InertiaPlugin };
