import { badge } from "@/lib/styles";
import type { DocStatus } from "@/types";

const LABELS: Record<DocStatus, string> = {
  pending:  "● Pending",
  signed:   "✓ Signed",
  draft:    "○ Draft",
  archived: "— Archived",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span style={badge(status)}>
      {LABELS[status] ?? status}
    </span>
  );
}
