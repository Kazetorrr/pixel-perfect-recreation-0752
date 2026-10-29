// Presentation-only game metadata. Balance numbers live server-side in
// public.game_config() and are delivered to the client via get_state().config.

export const RESOURCES = ["blue", "green", "yellow", "red"] as const;
export type Resource = (typeof RESOURCES)[number];

export const RESOURCE_META: Record<Resource, { label: string; short: string; color: string; genitive: string }> = {
  blue: { label: "Modré zásoby", short: "Modré", color: "var(--res-blue)", genitive: "modrých" },
  green: { label: "Zelené zásoby", short: "Zelené", color: "var(--res-green)", genitive: "zelených" },
  yellow: { label: "Žluté zásoby", short: "Žluté", color: "var(--res-yellow)", genitive: "žlutých" },
  red: { label: "Červené zásoby", short: "Červené", color: "var(--res-red)", genitive: "červených" },
};

export const CATEGORIES = ["peak", "ruin", "tower", "monument"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { label: string; plural: string; resource: Resource }> = {
  peak: { label: "Vrchol", plural: "Vrcholy", resource: "blue" },
  ruin: { label: "Zřícenina", plural: "Zříceniny", resource: "green" },
  tower: { label: "Rozhledna", plural: "Rozhledny", resource: "yellow" },
  monument: { label: "Památník", plural: "Památníky", resource: "red" },
};

// Map style: configurable via VITE_MAP_STYLE_URL; falls back to OSM raster on failure.
export const MAP_STYLE_URL =
  (import.meta.env["VITE_MAP_STYLE_URL"] as string | undefined) || "https://tiles.openfreemap.org/styles/dark";
export const MAP_CENTER: [number, number] = [17.62, 49.22];

export const fmt = (n: number | null | undefined) => new Intl.NumberFormat("cs-CZ").format(Math.round(n ?? 0));

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Travel trail shown briefly on the map after arriving in a city (presentation only).
// The trail is drawn in the player's profile color; `color` is only the fallback
// used before the profile is loaded.
export const TRAVEL_TRAIL = {
  color: "#22d3ee",

  coreWidth: 3,
  glowWidth: 14,
  holdMs: 2500,
  fadeMs: 1200,
  routingProfile: "foot", // OSRM profile for real paths; falls back to an arc
};

// Settlement tiers (presentation only; bonus values come from game_config().tier_bonus).
export const TIERS = ["village", "town", "regional"] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_META: Record<Tier, { label: string }> = {
  village: { label: "Vesnice" },
  town: { label: "Město" },
  regional: { label: "Krajské město" },
};
export function tierBonusText(t: Tier, b: { production?: number; warehouse?: number; logistics?: number }) {
  const pct = (v?: number) => `+${Math.round((v ?? 0) * 100)} %`;
  if (t === "village") return `${pct(b.production)} základní produkce`;
  if (t === "town") return `${pct(b.warehouse)} kapacita získaná vylepšením skladu`;
  return `${pct(b.logistics)} denní odchozí kapacita tržiště`;
}
export const DEFAULT_PLAYER_COLOR = "#3b82f6";

// Neutral grey settlement pictograms (inner icon), 24x24 viewBox.
export const TIER_ICON: Record<Tier, string> = {
  village: `<path d="M4 20V11l8-6 8 6v9z"/><path d="M10 20v-5h4v5"/>`,
  town: `<path d="M3 20v-8l4-3 4 3v8M11 20V9l2-5 2 5v11M15 20v-7l3-2 3 2v7M2 20h20"/><path d="M13 6v.01"/>`,
  regional: `<path d="M3 20V8h3v2h2V8h3v2h2V8h3v2h2V8h3v12z"/><path d="M10 20v-5a2 2 0 0 1 4 0v5M12 8V3l3 1-3 1"/>`,
};
