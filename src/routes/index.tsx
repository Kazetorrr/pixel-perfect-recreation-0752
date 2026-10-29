import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, ChevronDown, Compass, Footprints, SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { GameShell } from "@/components/game/GameShell";
import { GameMap, type Selection } from "@/components/game/GameMap";
import { CityPanel } from "@/components/game/CityPanel";
import { PoiPanel } from "@/components/game/PoiPanel";
import { ResCounters } from "@/components/game/ui";
import { CATEGORIES, CATEGORY_META, RESOURCES, RESOURCE_META, fmt, type Category, type Resource } from "@/game/config";
import { useCities, useAction, usePois, useSettlements, type GameState, type Guild } from "@/game/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "summ-it – mapa | Strategie objevování Česka" },
      { name: "description", content: "Choďte, budujte výrobu ve skutečných městech a získávejte vrcholy, zříceniny a rozhledny pro svou guildu." },
      { property: "og:title", content: "summ-it – mapa" },
      { property: "og:description", content: "Ekonomická a průzkumná strategie na skutečné mapě Česka." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <GameShell>{(state, guild) => <MapScreen state={state} guild={guild} />}</GameShell>,
});

function MapScreen({ state, guild }: { state: GameState; guild: Guild | null | undefined }) {
  const cities = useCities();
  const pois = usePois();
  const settlements = useSettlements(true);
  const [layer, setLayer] = useState<"economy" | "exploration">("economy");
  const [sel, setSel] = useState<Selection>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [resFilter, setResFilter] = useState<Record<Resource, boolean>>({ blue: false, green: false, yellow: false, red: false });
  const [catFilter, setCatFilter] = useState<Record<Category, boolean>>({ peak: true, ruin: true, tower: true, monument: true });
  const fund = useAction<{ p_amount: number | null }>("fund_travel", (d) => ((d as { completed: boolean }).completed ? "Dorazili jste do cíle" : "Kroky vloženy do cesty"));

  const city = sel?.kind === "city" ? cities.data?.find((c) => c.id === sel.id) : undefined;
  const poi = sel?.kind === "poi" ? pois.data?.find((p) => p.id === sel.id) : undefined;
  const memoCities = useMemo(() => cities.data ?? [], [cities.data]);
  const memoPois = useMemo(() => pois.data ?? [], [pois.data]);
  const t = state.travel;
  const carried = RESOURCES.reduce((s, r) => s + (state.expedition[r] ?? 0), 0);

  return (
    <>
      <GameMap layer={layer} cities={memoCities} pois={memoPois} state={state} settlements={settlements.data} resFilter={resFilter} catFilter={catFilter} selection={sel}
        onSelect={setSel} />

      {/* Left panel */}
      <div className={cn("absolute left-2 top-20 z-10 w-56 space-y-2 sm:left-4 sm:top-24", (city || poi) && "hidden sm:block")}>
        <div className="panel p-2">
          <div className="flex items-center justify-between px-2 pb-1 pt-1 text-xs font-semibold text-muted-foreground">
            Zobrazení
            <button className="sm:hidden" onClick={() => setFiltersOpen(!filtersOpen)} aria-label="Filtry"><SlidersHorizontal className="size-4" /></button>
          </div>
          {([["economy", "Ekonomika", BarChart3], ["exploration", "Objevování", Compass]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setLayer(id); setSel(null); }}
              className={cn("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors", layer === id ? "border-primary bg-accent" : "border-transparent hover:bg-muted")}>
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        <div className={cn("panel p-3", !filtersOpen && "hidden sm:block")}>
          <button type="button" onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen}
            className={cn("flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground", listOpen && "mb-2")}>
            {layer === "economy" ? "Typy produkce" : "Kategorie lokalit"}
            <ChevronDown className={cn("size-3 transition-transform", listOpen && "rotate-180")} />
          </button>
          {!listOpen ? null : layer === "economy"
            ? RESOURCES.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
                <span className="size-3 rounded-full" style={{ background: RESOURCE_META[r].color }} />
                <span className="flex-1">{RESOURCE_META[r].short}</span>
                <Checkbox checked={resFilter[r]} onCheckedChange={(v) => setResFilter({ ...resFilter, [r]: !!v })} />
              </label>
            )).concat(
              <label key="all" className="mt-2 flex cursor-pointer items-center gap-3 border-t border-border pt-2.5 text-sm">
                <span className="flex-1">Ukázat vše</span>
                <Checkbox checked={RESOURCES.every((r) => resFilter[r])}
                  onCheckedChange={(v) => setResFilter({ blue: !!v, green: !!v, yellow: !!v, red: !!v })} />
              </label>,
            )
            : CATEGORIES.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-3 py-1.5 text-sm">
                <span className="size-3 rounded-full" style={{ background: RESOURCE_META[CATEGORY_META[c].resource].color }} />
                <span className="flex-1">{CATEGORY_META[c].plural}</span>
                <Checkbox checked={catFilter[c]} onCheckedChange={(v) => setCatFilter({ ...catFilter, [c]: !!v })} />
              </label>
            ))}
        </div>
        {layer === "exploration" && (
          <div className={cn("panel p-3", !filtersOpen && "hidden sm:block")}>
            <div className="mb-2 flex justify-between text-xs font-semibold text-muted-foreground"><span>Expedice</span><span>{carried}/{state.config.expedition_capacity}</span></div>
            <ResCounters inv={state.expedition} className="grid-cols-2" />
            <p className="mt-2 text-[11px] text-muted-foreground">Zásoby naložíte ve skladu města (záložka Sklad).</p>
          </div>
        )}
        {t && (
          <div className="panel p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold"><Footprints className="size-3.5 text-primary" /> Cesta do {memoCities.find((c) => c.id === t.to_city)?.name}</div>
            <Progress value={(t.paid_steps / t.required_steps) * 100} className="mb-2 h-1.5" />
            <button className="w-full rounded-md bg-primary py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50" disabled={fund.isPending || state.profile.wallet_steps <= 0}
              onClick={() => fund.mutate({ p_amount: null })}>Vložit kroky · {fmt(t.paid_steps)}/{fmt(t.required_steps)}</button>
          </div>
        )}
      </div>

      {/* Right panel / mobile bottom sheet */}
      {(city || poi) && (
        <aside className="panel absolute inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] top-20 z-30 flex flex-col overflow-hidden sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-20 sm:w-[400px]">
          {city && <CityPanel key={city.id} city={city} cities={memoCities} state={state} guild={guild} owners={settlements.data?.find((x) => x.city_id === city.id)?.owners ?? []} onClose={() => setSel(null)} />}
          {poi && <PoiPanel key={poi.id} poi={poi} state={state} onClose={() => setSel(null)} />}
        </aside>
      )}
    </>
  );
}
