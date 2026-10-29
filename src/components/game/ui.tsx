import { RESOURCE_META, RESOURCES, fmt, type Resource } from "@/game/config";
import type { Inv } from "@/game/api";
import { cn } from "@/lib/utils";
import { Footprints } from "lucide-react";

export function StepAmount({ value }: { value: number }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums"><Footprints aria-label="kroky" className="size-3.5 shrink-0" />{fmt(value)}</span>;
}

export function MissingSteps({ cost, balance }: { cost: number; balance: number }) {
  return cost > balance ? <p className="mt-1 text-xs text-destructive">Chybí <StepAmount value={cost - balance} /></p> : null;
}

export function ResDot({ r, className }: { r: Resource; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ background: RESOURCE_META[r].color }} />;
}

export function ResCounters({ inv, className }: { inv: Inv; className?: string }) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {RESOURCES.map((r) => (
        <div key={r} className="flex items-center gap-1.5 rounded-lg border bg-panel-2 px-2 py-1.5 text-sm font-semibold tabular-nums">
          <ResDot r={r} /> {fmt(inv[r] ?? 0)}
        </div>
      ))}
    </div>
  );
}

export function SimBadge({ children = "Simulace" }: { children?: React.ReactNode }) {
  return <span className="sim-badge">{children}</span>;
}

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/60 p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>{title}</span>
        {right && <span className="text-xs font-normal text-muted-foreground">{right}</span>}
      </div>
      {children}
    </div>
  );
}
