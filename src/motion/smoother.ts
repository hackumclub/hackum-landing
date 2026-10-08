// ScrollSmoother: used by the layout-level SmoothScroll/RouteSync, so it loads on every page.
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { gsap } from "./gsap";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollSmoother);
export { ScrollSmoother };
