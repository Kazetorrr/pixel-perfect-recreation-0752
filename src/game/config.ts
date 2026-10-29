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
