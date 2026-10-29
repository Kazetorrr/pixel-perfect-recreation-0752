import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CATEGORY_META, MAP_CENTER, MAP_STYLE_URL, RESOURCES, RESOURCE_META, TIER_ICON, TRAVEL_TRAIL, DEFAULT_PLAYER_COLOR, type Category, type Resource } from "@/game/config";
import type { City, GameState, Poi, Settlement } from "@/game/api";

export type Selection = { kind: "city"; id: string } | { kind: "poi"; id: string } | null;

function citySvg(tier: keyof typeof TIER_ICON, owners: string[], level: number, market: number, extra = 0) {
  const R = 19, C = 2 * Math.PI * R, segs = 5, gap = 3, len = C / segs - gap;
  const owner = owners.length === 1 ? owners[0]! : null;
  const shared = owners.length > 1;
  const ring = owner ? Array.from({ length: segs }, (_, i) =>
    `<circle cx="24" cy="24" r="${R}" fill="none" stroke="${owner}" stroke-width="3" stroke-linecap="round" opacity="${i < level ? 1 : 0.18}"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-(i * C) / segs - C / 4 + gap / 2}" transform="rotate(0 24 24)"/>`).join("") : "";
  // Shared: equal arcs on the outline, one per owner, starting at 12 o'clock clockwise.
  const r2 = 15, C2 = 2 * Math.PI * r2, n = owners.length, g2 = 2.2, l2 = C2 / n - g2;
  const arcs = shared ? owners.map((col, i) =>
    `<circle cx="24" cy="24" r="${r2}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="${l2} ${C2 - l2}" stroke-dashoffset="${-(i * C2) / n - g2 / 2}" transform="rotate(-90 24 24)"/>`).join("") : "";
  const mk = shared ? "oklch(0.8 0.005 230)" : owner;
  const crown = mk && market > 0 ? `<g class="tk-crown" transform="translate(17 -1)"><path d="M1 9h12l-1-6-3 3-2-4-2 4-3-3z" fill="var(--panel-2)" stroke="${mk}" stroke-width="1.4" stroke-linejoin="round"/>${shared ? "" : `<text x="7" y="16" text-anchor="middle" font-size="6" fill="${mk}">${market}</text>`}</g>` : "";
  const plus = extra > 0 ? `<g transform="translate(33 31)"><rect x="0" y="0" width="15" height="10" rx="5" fill="var(--panel-2)" stroke="oklch(0.6 0.01 230)" stroke-width="1"/><text x="7.5" y="7.6" text-anchor="middle" font-size="7" font-weight="700" fill="oklch(0.9 0.005 230)">+${extra}</text></g>` : "";
  return `<svg width="48" height="48" viewBox="0 -2 48 50" overflow="visible">
    <circle cx="24" cy="24" r="15" fill="var(--panel-2)" stroke="${shared ? "none" : (owner ?? "oklch(0.55 0.01 230)")}" stroke-width="2"/>
    ${ring}${arcs}
    <g transform="translate(15 15) scale(0.75)" fill="none" stroke="oklch(0.78 0.005 230)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TIER_ICON[tier]}</g>
    ${crown}${plus}</svg>`;
}
const ICONS: Record<Category, string> = {
  peak: `<path d="m3 20 6-11 4 6 3-4 5 9z"/>`,
  ruin: `<path d="M4 21V9l2-2 2 2 2-2 2 2v12M14 21v-8l3-2 3 2v8M4 21h16"/>`,
  tower: `<path d="M9 21l1-13h4l1 13M8 8h8l-1-4h-6zM12 4V2M7 21h10"/>`,
  monument: `<path d="M12 2l2 4v12h-4V6zM7 22h10M8 18h8"/>`,
};
const poiSvg = (c: Category) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[c]}</svg>`;

const FALLBACK_STYLE = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#101417" } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -1, "raster-brightness-max": 0.32, "raster-contrast": 0.1 } },
  ],
} as const;

export function GameMap(props: {
  layer: "economy" | "exploration";
  cities: City[];
  pois: Poi[];
  state: GameState | null;
  settlements?: Settlement[] | undefined;
  resFilter: Record<Resource, boolean>;
  catFilter: Record<Category, boolean>;
  showProd?: boolean;
  selection: Selection;
  onSelect: (s: Selection) => void;
  flyTo?: [number, number] | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const [ready, setReady] = useState(false);
  const [styleNote, setStyleNote] = useState<string | null>(null);
  const [view, setView] = useState({ zoom: 10, key: 0 });
  const onSelectRef = useRef(props.onSelect);
  onSelectRef.current = props.onSelect;

  useEffect(() => {
    let disposed = false;
    (async () => {
      const ml = await import("maplibre-gl");
      const workerUrl = (await import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url")).default;
      ml.setWorkerUrl(workerUrl);
      if (disposed || !el.current) return;
      lib.current = ml;
      const m = new ml.Map({ container: el.current, style: MAP_STYLE_URL, center: MAP_CENTER, zoom: 10, attributionControl: { compact: true } });
      map.current = m;
      let fellBack = false;
      const fallback = () => {
        if (fellBack) return; fellBack = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        m.setStyle(FALLBACK_STYLE as any);
        setStyleNote("Záložní mapový podklad");
      };
      const timer = setTimeout(() => { if (!m.isStyleLoaded()) fallback(); }, 8000);
      m.on("error", (e) => { if (!m.isStyleLoaded() && String(e.error?.message ?? "").match(/style|fetch|Failed/i)) fallback(); });
      const zc = () => el.current?.classList.toggle("tk-compact", m.getZoom() < 9.3);
      m.on("zoom", zc); zc();
      m.on("moveend", () => setView((v) => ({ zoom: m.getZoom(), key: v.key + 1 })));
      m.on("load", () => { clearTimeout(timer); setReady(true); });
      m.on("style.load", () => setReady(true));
      m.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
      m.addControl(new ml.ScaleControl({ unit: "metric" }), "bottom-left");
      m.on("click", (e) => { if ((e.originalEvent.target as HTMLElement).classList.contains("maplibregl-canvas")) onSelectRef.current(null); });
    })();
    return () => { disposed = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (props.flyTo && map.current) map.current.flyTo({ center: props.flyTo, zoom: Math.max(map.current.getZoom(), 11) });
  }, [props.flyTo]);

  // (Re)build markers
  useEffect(() => {
    const m = map.current, ml = lib.current;
    if (!m || !ml || !ready) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const st = props.state;
    const owned = new Set(st?.cities.map((c) => c.city_id));
    const sel = props.selection;

    if (props.layer === "economy") {
      const active = RESOURCES.filter((r) => props.resFilter[r]);
      // ~10k settlements: draw only those in view, revealing smaller tiers as you zoom in.
      const z = view.zoom, b = m.getBounds().toArray();
      const padX = (b[1][0] - b[0][0]) * 0.15, padY = (b[1][1] - b[0][1]) * 0.15;
      const keep = new Set<string>([...(owned as Set<string>)]);
      props.settlements?.forEach((s) => keep.add(s.city_id));
      if (st?.profile.current_city_id) keep.add(st.profile.current_city_id);
      if (sel?.kind === "city") keep.add(sel.id);
      const minZoom = { regional: 0, town: 8.8, village: 11 } as const;
      for (const c of props.cities) {
        if (!keep.has(c.id)) {
          if (z < minZoom[c.tier ?? "town"]) continue;
          if (c.lng < b[0][0] - padX || c.lng > b[1][0] + padX || c.lat < b[0][1] - padY || c.lat > b[1][1] + padY) continue;
        }
        const node = document.createElement("div");
        node.className = "tk-city";
        node.dataset["owned"] = String(owned.has(c.id));
        node.dataset["here"] = String(st?.profile.current_city_id === c.id);
        const isSel = sel?.kind === "city" && sel.id === c.id;
        node.dataset["selected"] = String(isSel);
        const bars = active.map((r) => {
          const eff = Number(c[`eff_${r}` as const]);
          return `<div class="tk-bar"><i style="width:${Math.round(eff * 40)}px;background:${RESOURCE_META[r].color}"></i>${Math.round(eff * 100)}%</div>`;
        }).join("");
        const card = bars ? `<div class="tk-city-card">${bars}</div>` : "";
        const os = props.settlements?.find((x) => x.city_id === c.id)?.owners ?? [];
        const meId = st?.profile.id;
        const colors = os.map((o) => (o.id === meId ? (st?.profile.color ?? o.color) : o.color) || DEFAULT_PLAYER_COLOR);
        const shown = colors.slice(0, 4);
        const solo = os.length === 1 ? os[0]! : null;
        const lvl = solo ? Math.max(0, ...Object.values(solo.buildings).map(Number)) : 0;
        const market = os.some((o) => o.market_level > 0) ? (solo?.market_level ?? 1) : 0;
        node.dataset["owned"] = String(os.length > 0);
        if (shown[0]) node.style.setProperty("--owner", shown[0]);
        node.innerHTML = `<div class="tk-city-dot">${citySvg(c.tier ?? "town", shown, lvl, market, os.length - shown.length)}</div>${card}`;
        node.title = c.name;
        node.addEventListener("click", (e) => { e.stopPropagation(); onSelectRef.current({ kind: "city", id: c.id }); });
        markers.current.push(new ml.Marker({ element: node, anchor: "left", offset: [-24, 0] }).setLngLat([c.lng, c.lat]).addTo(m));
      }
    } else {
      const claimed = new Set([...(st?.guild_claims ?? []), ...(st?.my_claims ?? [])]);
      // ~8k POIs: only those in view; peaks (most numerous) appear from closer zoom.
      const z = view.zoom, b = m.getBounds().toArray();
      const padX = (b[1][0] - b[0][0]) * 0.15, padY = (b[1][1] - b[0][1]) * 0.15;
      const minZoom: Record<Category, number> = { peak: 10.8, ruin: 8.5, tower: 8.5, monument: 8.5 };
      for (const p of props.pois) {
        if (!props.catFilter[p.category]) continue;
        const keepP = claimed.has(p.id) || (sel?.kind === "poi" && sel.id === p.id);
        if (!keepP) {
          if (z < minZoom[p.category]) continue;
          if (p.lng < b[0][0] - padX || p.lng > b[1][0] + padX || p.lat < b[0][1] - padY || p.lat > b[1][1] + padY) continue;
        }
        const node = document.createElement("div");
        node.className = "tk-poi";
        node.style.color = RESOURCE_META[CATEGORY_META[p.category].resource].color;
        node.dataset["claimed"] = String(claimed.has(p.id));
        node.dataset["selected"] = String(sel?.kind === "poi" && sel.id === p.id);
        node.title = p.name;
        node.innerHTML = poiSvg(p.category);
        node.addEventListener("click", (e) => { e.stopPropagation(); onSelectRef.current({ kind: "poi", id: p.id }); });
        markers.current.push(new ml.Marker({ element: node }).setLngLat([p.lng, p.lat]).addTo(m));
      }
    }
  }, [ready, props.layer, props.cities, props.pois, props.state, props.settlements, props.resFilter, props.catFilter, props.selection, view]);

  // Glowing trail after travel: detect arrival via current_city_id change
  const prevCity = useRef<string | null | undefined>(undefined);
  const curCity = props.state?.profile.current_city_id ?? null;
  useEffect(() => {
    const prev = prevCity.current;
    prevCity.current = curCity;
    const m = map.current;
    if (!m || !ready || prev === undefined || !prev || !curCity || prev === curCity) return;
    const a = props.cities.find((c) => c.id === prev), b = props.cities.find((c) => c.id === curCity);
    if (!a || !b) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0;
    const id = "tk-trail";
    const cleanup = () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      try { for (const l of [`${id}-glow`, `${id}-core`]) if (m.getLayer(l)) m.removeLayer(l); if (m.getSource(id)) m.removeSource(id); } catch { /* map gone */ }
    };
    (async () => {
      const coords = await fetchRoute([a.lng, a.lat], [b.lng, b.lat]);
      if (cancelled || !map.current) return;
      cleanup();
      const T = TRAVEL_TRAIL;
      const trailColor = props.state?.profile.color ?? T.color;

      m.addSource(id, { type: "geojson", lineMetrics: true, data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } } });
      m.addLayer({ id: `${id}-glow`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": trailColor, "line-width": T.glowWidth, "line-blur": T.glowWidth * 0.7, "line-opacity": 0.55 } });
      m.addLayer({ id: `${id}-core`, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": trailColor, "line-width": T.coreWidth, "line-opacity": 1 } });

      const lngs = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
      m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 120, maxZoom: 13, duration: 1200 });
      // Draw-in animation via line-gradient trim
      const drawMs = 1000, t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / drawMs);
        for (const l of [`${id}-glow`, `${id}-core`]) if (m.getLayer(l)) m.setPaintProperty(l, "line-gradient", p >= 1 ? ["interpolate", ["linear"], ["line-progress"], 0, trailColor, 1, trailColor] : ["step", ["line-progress"], trailColor, Math.max(p, 0.0001), "rgba(0,0,0,0)"]);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      timers.push(setTimeout(() => {
        for (const l of [`${id}-glow`, `${id}-core`]) if (m.getLayer(l)) { m.setPaintProperty(l, "line-opacity-transition", { duration: T.fadeMs, delay: 0 }); m.setPaintProperty(l, "line-opacity", 0); }
        timers.push(setTimeout(cleanup, T.fadeMs + 100));
      }, drawMs + T.holdMs));
    })();
    return () => { cancelled = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curCity, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
      {styleNote && <div className="panel absolute bottom-20 left-3 px-3 py-1 text-xs text-muted-foreground sm:bottom-10">{styleNote}</div>}
    </div>
  );
}

async function fetchRoute(from: [number, number], to: [number, number]): Promise<[number, number][]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const url = `https://router.project-osrm.org/route/v1/${TRAVEL_TRAIL.routingProfile}/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    const c = j?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(c) && c.length > 1) return c;
  } catch { /* fall back */ }
  // Smooth arc fallback
  const [x1, y1] = from, [x2, y2] = to;
  const mx = (x1 + x2) / 2 - (y2 - y1) * 0.2, my = (y1 + y2) / 2 + (x2 - x1) * 0.2;
  return Array.from({ length: 41 }, (_, i) => {
    const t = i / 40, u = 1 - t;
    return [u * u * x1 + 2 * u * t * mx + t * t * x2, u * u * y1 + 2 * u * t * my + t * t * y2] as [number, number];
  });
}
