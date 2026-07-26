import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  qc_pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  packed: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  archived: "bg-gray-100 text-gray-600 border-gray-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  passed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  on_hold: "bg-orange-100 text-orange-700 border-orange-200",
  generated: "bg-sky-100 text-sky-700 border-sky-200",
  printed: "bg-indigo-100 text-indigo-700 border-indigo-200",
  verified: "bg-teal-100 text-teal-700 border-teal-200",
  dispatched: "bg-cyan-100 text-cyan-700 border-cyan-200",
  sold: "bg-green-100 text-green-700 border-green-200",
  recalled: "bg-red-100 text-red-700 border-red-200",
  voided: "bg-gray-100 text-gray-600 border-gray-200",
  counterfeit: "bg-red-200 text-red-900 border-red-300",
  queued: "bg-blue-100 text-blue-700 border-blue-200",
  printing: "bg-indigo-100 text-indigo-700 border-indigo-200",
  paused: "bg-orange-100 text-orange-700 border-orange-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
  genuine: "bg-green-100 text-green-700 border-green-200",
  invalid: "bg-red-100 text-red-700 border-red-200",
  duplicate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  suspicious: "bg-amber-100 text-amber-800 border-amber-200",
  open: "bg-red-100 text-red-700 border-red-200",
  investigating: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-red-200 text-red-900 border-red-300",
  dismissed: "bg-gray-100 text-gray-600 border-gray-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-200 text-red-900 border-red-300",
  in_production: "bg-blue-100 text-blue-700 border-blue-200",
  in_warehouse: "bg-emerald-100 text-emerald-700 border-emerald-200",
  in_transit: "bg-cyan-100 text-cyan-700 border-cyan-200",
  at_distributor: "bg-purple-100 text-purple-700 border-purple-200",
  at_retailer: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const label = status.replace(/_/g, " ");
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize font-medium",
        statusColors[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {label}
    </Badge>
  );
}
