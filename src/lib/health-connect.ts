import { supabase } from "@/integrations/supabase/client";

/** True only inside the native Android/iOS shell (Capacitor). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

function pragueDay(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(d);
}

/** Reads today's + yesterday's step totals from Health Connect and sends them to the server. */
export async function syncHealthSteps(): Promise<number> {
  if (!isNativeApp()) return 0;
  const { Health } = await import("@capgo/capacitor-health");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const H = Health as any;
  const avail = await H.isAvailable?.();
  if (avail && avail.available === false) return 0;
  await H.requestAuthorization({ read: ["steps"], write: [] });
  let credited = 0;
  for (const offset of [1, 0]) {
    const day = new Date(Date.now() - offset * 86400000);
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = offset === 0 ? new Date() : new Date(start.getTime() + 86400000);
    const res = await H.queryAggregated({ dataType: "steps", startDate: start.toISOString(), endDate: end.toISOString(), bucket: "day", aggregation: "sum" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const steps = Math.round(((res?.samples ?? []) as any[]).reduce((s, x) => s + (Number(x.value) || 0), 0));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("sync_my_steps", { p_day: pragueDay(start), p_steps: steps });
    if (error) throw new Error(error.message);
    credited += Number(data) || 0;
  }
  return credited;
}
