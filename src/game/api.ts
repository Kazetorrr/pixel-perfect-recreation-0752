import type { Tier } from "@/game/config";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Resource } from "./config";

export type City = {
  id: string; name: string; lat: number; lng: number; special: string | null; tier: Tier;
  eff_blue: number; eff_green: number; eff_yellow: number; eff_red: number;
};
export type Poi = { id: string; osm_id: string; name: string; category: Category; lat: number; lng: number; elevation: number | null; osm_tags: string | null };
export type Inv = Partial<Record<Resource, number>>;
export type PlayerCity = { city_id: string; warehouse_level: number; market_level: number; capacity?: number; buildings: Partial<Record<Resource, number>>; inventory: Inv };
export type GameConfig = {
  dev_mode: boolean; steps_per_sp: number; max_level: number; prod_per_level: number[]; build_cost: number; upgrade_cost: number[];
  warehouse_capacity_per_level: number; warehouse_upgrade_cost: number[]; market_upgrade_cost: number[];
  travel_multiplier: number; sp_per_km: number; transport_sp_per_unit_km: number; market_discount_per_level: number;
  expedition_capacity: number; poi_cost: Record<Category, number>; gps_radius_m: number; gps_max_accuracy_m: number; guild_max_members: number;
  tier_bonus: Record<Tier, { production?: number; warehouse?: number; logistics?: number }>; player_colors: string[];
};
export type GameState = {
  onboarded: boolean;
  profile: { id: string; username: string; home_city_id: string; current_city_id: string; color: string; guild_id: string | null; steps_total: number; sp_balance: number; sp_spent: number; time_offset_seconds: number };
  cities: PlayerCity[];
  expedition: Inv;
  travel: { id: string; from_city: string; to_city: string; distance_km: number; sp_required: number; sp_paid: number } | null;
  transactions: { kind: string; steps: number; sp: number; note: string; simulated: boolean; created_at: string }[];
  shipments: { id: string; from_city: string; to_city: string; resource: Resource; qty: number; sp_cost: number; created_at: string; direction: "in" | "out" | "internal"; sender: string; recipient: string }[];
  my_claims: string[];
  guild_claims: string[];
  season: { name: string; starts_at: string; ends_at: string } | null;
  config: GameConfig;
};
export type Guild = {
  id: string; name: string; invite_code: string; owner_id: string;
  members: { id: string; username: string; home_city_id: string; current_city_id: string; cities: string[]; claims: number }[];
  stats: { total: number; spent: number; verified: number; peak: number; ruin: number; tower: number; monument: number };
  activity: { type: "claim" | "shipment"; user: string; poi?: string; to?: string; qty?: number; resource?: Resource; verification?: string; at: string }[];
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") qc.invalidateQueries();
    });
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return { session, ready };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args ?? {});
  if (error) throw new Error(error.message);
  return data as T;
}

export const useCities = () =>
  useQuery({ queryKey: ["cities"], staleTime: Infinity, queryFn: async () => {
    const { data, error } = await supabase.from("cities").select("*").order("name");
    if (error) throw error; return data as unknown as City[];
  } });
export const usePois = () =>
  useQuery({ queryKey: ["pois"], staleTime: Infinity, queryFn: async () => {
    const { data, error } = await supabase.from("pois").select("*");
    if (error) throw error; return data as unknown as Poi[];
  } });
export const useGameState = (enabled: boolean) =>
  useQuery({ queryKey: ["state"], enabled, queryFn: () => rpc<GameState | { onboarded: false }>("get_state") });
export type SettlementOwner = { id: string; username: string; color: string; market_level: number; warehouse_level: number; buildings: Partial<Record<Resource, number>> };
export type Settlement = { city_id: string; owners: SettlementOwner[] };
/** Settlements with real infrastructure of me + my guild mates. Current player always first. */
export const useSettlements = (enabled: boolean) =>
  useQuery({ queryKey: ["settlements"], enabled, refetchInterval: 20_000, refetchOnWindowFocus: true, queryFn: async () => (await rpc<Settlement[] | null>("get_guild_settlements")) ?? [] });
export const useGuild = (enabled: boolean) => useQuery({ queryKey: ["guild"], enabled, queryFn: () => rpc<Guild | null>("get_guild") });
export const useLeaderboards = (category: string, verification: string) =>
  useQuery({ queryKey: ["lb", category, verification], queryFn: () => rpc<{
    guilds: { name: string; score: number; members: number }[];
    explorers: { name: string; guild: string | null; score: number }[];
    economists: { name: string; guild: string | null; score: number }[];
  }>("get_leaderboards", { p_category: category, p_verification: verification }) });
export const usePoiDetail = (poi: string | null) =>
  useQuery({ queryKey: ["poi", poi], enabled: !!poi, queryFn: () => rpc<{
    claims: { username: string; guild: string | null; verification: string; created_at: string }[];
    guild_visitors: { username: string; verification: string; created_at: string }[];
  }>("get_poi_detail", { p_poi: poi }) });
export const quoteShipment = (from: string, to: string, qty: number) => rpc<number>("quote_shipment", { p_from: from, p_to: to, p_qty: qty });

/** Generic game action: calls the server function, toasts result, refreshes state. */
export function useAction<A extends Record<string, unknown>>(fn: string, success?: string | ((data: unknown, args: A) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => rpc<unknown>(fn, args),
    onSuccess: (data, args) => {
      const msg = typeof success === "function" ? success(data, args) : success;
      if (msg) toast.success(msg);
      qc.invalidateQueries({ queryKey: ["state"] });
      qc.invalidateQueries({ queryKey: ["guild"] });
      qc.invalidateQueries({ queryKey: ["settlements"] });
      qc.invalidateQueries({ queryKey: ["lb"] });
      qc.invalidateQueries({ queryKey: ["poi"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
