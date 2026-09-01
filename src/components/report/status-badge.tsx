import { normalizeStatus, STATUS_META } from "@/lib/status-config";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeStatus(status);
  const meta = STATUS_META[normalized];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.badgeClassName,
      )}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dotClassName)}
      />
      {meta.label}
    </span>
  );
}
