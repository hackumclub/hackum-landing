import Prose from "@/components/Prose";
import lines from "@/data/terms.json";

export const metadata = { title: "Terms of Use | Hackum" };
export default function Page() { return <Prose title="Terms of Use" lines={lines} />; }
