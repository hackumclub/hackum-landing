"use client";
import SegmentedTabs from "./SegmentedTabs";

/** Route-based tabs (each tab is a URL, so deep links and Back work). Active tab gets aria-current="page". Thin wrapper over SegmentedTabs. */
export default function TabNav({ label, tabs, className }: { label: string; tabs: { href: string; label: string; count?: number }[]; className?: string }) {
  return (
    <SegmentedTabs
      ariaLabel={label}
      className={className}
      items={tabs.map((t) => ({ key: t.href, label: t.label, count: t.count }))}
      hrefs={Object.fromEntries(tabs.map((t) => [t.href, t.href]))}
    />
  );
}
