import { useState } from "react";
import { CheckCircle2, LocateFixed, Mountain, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_META, RESOURCE_META, fmt } from "@/game/config";
import { useAction, usePoiDetail, type GameState, type Poi } from "@/game/api";
import { ResCounters, ResDot, Section, SimBadge } from "./ui";
import { toast } from "sonner";

export function PoiPanel({ poi, state, onClose }: { poi: Poi; state: GameState; onClose: () => void }) {
  const meta = CATEGORY_META[poi.category];
  const res = meta.resource;
  const cost = state.config.poi_cost[poi.category];
  const have = state.expedition[res] ?? 0;
  const guildClaimed = state.guild_claims.includes(poi.id);
  const mine = state.my_claims.includes(poi.id);
  const detail = usePoiDetail(poi.id);
  const [locating, setLocating] = useState(false);
  const claim = useAction<{ p_poi: string; p_mode: string; p_lat: number | null; p_lng: number | null; p_accuracy: number | null }>("claim_poi", (d) =>
    (d as { status: string }).status === "visit" ? "Návštěva zaznamenána (guilda již lokalitu vlastní)" : state.profile.guild_id ? "Lokalita získána pro guildu" : "Lokalita získána");

  const gpsClaim = () => {
    if (!("geolocation" in navigator)) { toast.error("Prohlížeč nepodporuje určování polohy"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); claim.mutate({ p_poi: poi.id, p_mode: "gps", p_lat: p.coords.latitude, p_lng: p.coords.longitude, p_accuracy: p.coords.accuracy }); },
      (e) => { setLocating(false); toast.error(e.code === 1 ? "Přístup k poloze byl zamítnut. Povolte ho v nastavení prohlížeče." : "Polohu se nepodařilo zjistit"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const status = mine ? "Získáno vámi" : guildClaimed ? "Získáno vaší guildou" : "Nezískáno";
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="grid size-12 place-items-center rounded-xl border-2 bg-panel-2" style={{ borderColor: RESOURCE_META[res].color, color: RESOURCE_META[res].color }}>
          <Mountain className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{poi.name}</h2>
          <p className="text-sm text-muted-foreground">{meta.label} · {status}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Zavřít"><X /></Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <Section title="Údaje">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Kategorie</dt><dd className="text-right">{meta.label}</dd>
            {poi.elevation != null && (<><dt className="text-muted-foreground">Nadmořská výška</dt><dd className="text-right">{fmt(poi.elevation)} m</dd></>)}
            <dt className="text-muted-foreground">Souřadnice</dt><dd className="text-right tabular-nums">{poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}</dd>
            <dt className="text-muted-foreground">Zdroj</dt><dd className="text-right"><a className="underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/${{ n: "node", w: "way", r: "relation" }[poi.osm_id[0] as "n"]}/${poi.osm_id.slice(1)}`}>OpenStreetMap</a></dd>
          </dl>
        </Section>
        <Section title="Potřebné zásoby">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><ResDot r={res} /> {cost} {RESOURCE_META[res].genitive} zásob</span>
            <span className={have >= cost ? "text-res-green" : "text-destructive"}>V expedici: {fmt(have)}</span>
          </div>
        </Section>
        <Section title="Expediční inventář"><ResCounters inv={state.expedition} /></Section>

        {mine ? (
          <div className="flex items-center gap-2 rounded-xl border border-res-green/40 bg-res-green/10 p-3 text-sm"><CheckCircle2 className="size-4 text-res-green" /> Tuto lokalitu jste v této sezóně již získali.</div>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" disabled={claim.isPending || locating || (!guildClaimed && have < cost)} onClick={gpsClaim}>
              <LocateFixed /> {locating ? "Zjišťuji polohu…" : guildClaimed ? "Zaznamenat návštěvu (GPS)" : "Získat lokalitu (ověření GPS)"}
            </Button>
            {state.config.dev_mode && (
              <Button variant="outline" className="w-full border-dashed" disabled={claim.isPending || (!guildClaimed && have < cost)}
                onClick={() => claim.mutate({ p_poi: poi.id, p_mode: "simulated", p_lat: null, p_lng: null, p_accuracy: null })}>
                <SimBadge>Demo</SimBadge> Simulovat ověření polohy
              </Button>
            )}
            <p className="text-xs text-muted-foreground">GPS ověření vyžaduje být do {state.config.gps_radius_m} m od lokality. Demo získání se počítá jen do simulovaného žebříčku.</p>
          </div>
        )}

        <Section title="Historie této sezóny">
          {detail.data?.claims.length ? (
            <ul className="space-y-1 text-sm">
              {detail.data.claims.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span>{c.username}{c.guild && <span className="text-muted-foreground"> · {c.guild}</span>}</span>
                  {c.verification === "simulated" ? <SimBadge /> : <span className="text-xs text-res-green">GPS</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Zatím nikdo nezískal.</p>}
          {!!detail.data?.guild_visitors.length && (
            <p className="mt-2 text-xs text-muted-foreground">Navštívili členové guildy: {detail.data.guild_visitors.map((v) => v.username).join(", ")}</p>
          )}
        </Section>
      </div>
    </div>
  );
}
