"use client";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";

export type VoterRow = { id: string; name: string; choices: string };

export default function VotersTable({ rows, caption, cols, empty }: { rows: VoterRow[]; caption: string; cols: { voter: string; choice: string }; empty: { title: string; line: string } }) {
  const columns: Column<VoterRow>[] = [
    { key: "voter", header: cols.voter, primary: true, sortValue: (r) => r.name, cell: (r) => <span className="text-sm font-semibold text-fg [overflow-wrap:anywhere]">{r.name}</span> },
    { key: "choice", header: cols.choice, wide: true, cell: (r) => <span className="text-sm text-fg [overflow-wrap:anywhere]">{r.choices}</span> },
  ];
  return <DataTable rows={rows} columns={columns} getId={(r) => r.id} caption={caption} pageSize={10} empty={<EmptyState sticker="queue" title={empty.title} line={empty.line} />} />;
}
