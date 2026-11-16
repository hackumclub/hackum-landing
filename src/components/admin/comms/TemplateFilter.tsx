"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import FilterBar, { type FilterOption } from "@/components/ui/FilterBar";
import FilterDisclosure from "@/components/ui/FilterDisclosure";

/** Template chips. The selection lives in the URL (`?template=a,b`), so it survives reloads and is shareable. */
export default function TemplateFilter({ label, filtersLabel, options, value, base }: { label: string; filtersLabel: string; options: FilterOption[]; value: string[]; base: { path: string; status: string } }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const go = (next: string[]) => {
    const p = new URLSearchParams();
    if (base.status !== "all") p.set("status", base.status);
    if (next.length) p.set("template", next.join(","));
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${base.path}?${qs}` : base.path, { scroll: false }));
  };
  return <FilterDisclosure label={filtersLabel} activeCount={value.length}><FilterBar label={label} options={options} value={value} onChange={go} /></FilterDisclosure>;
}
