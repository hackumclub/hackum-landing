"use client";
import { useState, type ReactNode } from "react";
import { Plus, Trash2, Download } from "lucide-react";
import type { Dict } from "@/i18n";
import type { L } from "@/i18n/config";
import { ALL_STATUSES } from "@/lib/status";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Field, { Input, Select, Textarea } from "@/components/ui/Field";
import BilingualField from "@/components/ui/BilingualField";
import DateTimeField from "@/components/ui/DateTimeField";
import StatusPill from "@/components/ui/StatusPill";
import KpiCard from "@/components/ui/KpiCard";
import CapacityBar from "@/components/ui/CapacityBar";
import DataTable, { type Column } from "@/components/ui/DataTable";
import FilterBar from "@/components/ui/FilterBar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Drawer from "@/components/ui/Drawer";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import Avatar, { AvatarStack } from "@/components/ui/Avatar";

// Internal design-system gallery (dev/preview only, like the rest of /admin). Sample content is illustrative.
type Row = { id: string; name: string; school: string; events: number; status: "guest" | "member" | "alumni" };
const ROWS: Row[] = [
  { id: "1", name: "Анужин Батболд", school: "МУИС · ХШУИС", events: 9, status: "member" },
  { id: "2", name: "Тэмүүлэн Ганзориг", school: "ШУТИС", events: 2, status: "guest" },
  { id: "3", name: "Сараа Энхбаяр", school: "МУИС · ХШУИС", events: 23, status: "alumni" },
  { id: "4", name: "Билгүүн Отгон", school: "МУИС · ШУС", events: 5, status: "member" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-6">
      <h2 className="font-display text-lg font-bold text-fg">{title}</h2>
      {children}
    </section>
  );
}

export default function KitGallery({ d }: { d: Dict }) {
  const [title, setTitle] = useState<L>({ mn: "Knowledge Day #6: RAG чатбот бүтээх", en: "" });
  const [start, setStart] = useState<Date | null>(new Date("2026-11-20T10:30:00Z"));
  const [filters, setFilters] = useState<string[]>(["published"]);
  const [drawer, setDrawer] = useState(false);
  const cols: Column<Row>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="inline-flex items-center gap-2"><Avatar name={r.name} size={28} />{r.name}</span>, sortValue: (r) => r.name },
    { key: "school", header: "School", cell: (r) => r.school, hideBelow: "md" },
    { key: "status", header: "Status", cell: (r) => <StatusPill status={r.status} label={d.status[r.status]} /> },
    { key: "events", header: "Events", cell: (r) => r.events, sortValue: (r) => r.events, numeric: true },
  ];
  return (
    <div className="grid grid-cols-1 gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-fg md:text-3xl">UI kit</h1>
        <p className="text-sm text-fg-muted">Every primitive in every state, in the current theme. Use the theme switch above to check dark mode.</p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Plus aria-hidden="true" size={16} />}>Create event</Button>
          <Button variant="secondary" icon={<Download aria-hidden="true" size={16} />}>Export CSV</Button>
          <Button variant="ghost">Preview</Button>
          <Button variant="danger" icon={<Trash2 aria-hidden="true" size={16} />}>Delete draft</Button>
          <Button disabled>Disabled</Button>
          <Button size="lg">I’m going (44px)</Button>
          <IconButton label="Delete row" icon={<Trash2 size={18} />} />
        </div>
      </Section>

      <Section title="Status pills">
        <div className="flex flex-wrap gap-2">{ALL_STATUSES.map((s) => <StatusPill key={s} status={s} label={d.status[s]} />)}</div>
      </Section>

      <Section title="Fields">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Event slug" hint="Lowercase letters, numbers and dashes. Used in the public URL." required>
            {(c) => <Input {...c} defaultValue="knowledge-day-rag" />}
          </Field>
          <Field label="Capacity" error="Capacity must be between 1 and 5000." required>
            {(c) => <Input {...c} type="number" defaultValue={0} />}
          </Field>
          <Field label="Kind">{(c) => <Select {...c} defaultValue="workshop">{Object.entries(d.admin.kinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>}</Field>
          <Field label="Disabled">{(c) => <Input {...c} disabled defaultValue="Locked after publishing" />}</Field>
          <Field label="Notes for organizers" className="md:col-span-2">{(c) => <Textarea {...c} placeholder="Room 305 is booked until 21:00. Bring the HDMI adapter." />}</Field>
        </div>
        <BilingualField name="title" label="Event title" value={title} onChange={setTitle} labels={d.ui.bilingual} />
        <div className="max-w-sm"><DateTimeField name="starts_at" label="Starts" tzLabel={d.ui.tz} value={start} onChange={setStart} required /></div>
      </Section>

      <Section title="KPI cards">
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="RSVPs · 30 days" value="112" delta={{ text: "+51%", trend: "up", good: true, srLabel: "Up 51%" }} hint="vs previous 30 days" />
          <KpiCard label="No-shows" value="9" delta={{ text: "−12%", trend: "down", good: true, srLabel: "Down 12%" }} />
          <KpiCard label="Email bounces" value="4" delta={{ text: "+2", trend: "up", good: false, srLabel: "Up 2" }} />
          <KpiCard label="Upcoming events" value="4" delta={{ text: "0%", trend: "flat", good: true, srLabel: "Same" }} />
        </div>
      </Section>

      <Section title="Capacity">
        <div className="grid gap-4 md:grid-cols-3">
          <CapacityBar value={30} max={60} label="30 of 60 seats taken" />
          <CapacityBar value={52} max={60} label="52 of 60 seats taken" />
          <CapacityBar value={60} max={60} label="Full · 60 of 60 · waitlist open" />
        </div>
        <CapacityBar value={23} max={null} label="23 going · no seat limit" />
      </Section>

      <Section title="Table, filters, avatars">
        <FilterBar label="Status" value={filters} onChange={setFilters} options={[{ value: "draft", label: d.status.draft, count: 1 }, { value: "published", label: d.status.published, count: 3 }, { value: "completed", label: d.status.completed, count: 41 }]} />
        <DataTable rows={ROWS} columns={cols} getId={(r) => r.id} caption="Members" selectable selectLabel={d.ui.select} selectAllLabel={d.ui.selectAll}
          empty={<EmptyState sticker="wave" title="No members yet" line="Approved membership applications show up here." />} />
        <DataTable rows={[] as Row[]} columns={cols} getId={(r) => r.id} caption="Empty"
          empty={<EmptyState sticker="wave" title="No members match these filters" line="Clear a filter or search by name or school." action={<Button variant="secondary" onClick={() => setFilters([])}>Clear filters</Button>} />} />
        <AvatarStack people={ROWS.concat(ROWS).map((r) => ({ name: r.name }))} label="8 people going" />
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-2">
          <ConfirmDialog trigger={<Button variant="danger">Cancel event</Button>} title="Cancel “Knowledge Day #6”?" body="52 people will get a cancellation email and their calendar invite will be removed. This can’t be undone." confirmLabel="Cancel event and email 52" cancelLabel="Keep event" tone="danger" onConfirm={() => {}} />
          <Button variant="secondary" onClick={() => setDrawer(true)}>Open member drawer</Button>
        </div>
        <Drawer open={drawer} onOpenChange={setDrawer} title="Анужин Батболд" description="Member since 2024 · МУИС · ХШУИС" closeLabel={d.ui.close}>
          <p className="text-sm text-fg-muted">Season history, registrations and status changes appear here.</p>
        </Drawer>
      </Section>

      <Section title="Loading and empty">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid content-start gap-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4" /><Skeleton className="h-4 w-3/4" /></div>
          <EmptyState sticker="laptop" title={d.admin.dashboard.emptyUpcomingTitle} line={d.admin.dashboard.emptyUpcomingLine} />
        </div>
      </Section>
    </div>
  );
}
