import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Building2, Crown, Footprints, Hammer, MapPin, Package, Store, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESOURCES, RESOURCE_META, fmt, haversineKm, type Resource } from "@/game/config";
import { quoteShipment, useAction, type City, type GameState, type Guild } from "@/game/api";
import { ResCounters, ResDot, Section } from "./ui";

export function CityPanel({ city, cities, state, guild, onClose }: { city: City; cities: City[]; state: GameState; guild: Guild | null | undefined; onClose: () => void }) {
  const cfg = state.config;
  const pc = state.cities.find((c) => c.city_id === city.id);
  const isHere = state.profile.current_city_id === city.id;
  const isHome = state.profile.home_city_id === city.id;
  const eff = (r: Resource) => Number(city[`eff_${r}` as const]);
  const rate = (r: Resource) => { const l = pc?.buildings[r]; return l ? cfg.prod_per_level[l] * eff(r) : 0; };
  const stored = pc ? RESOURCES.reduce((s, r) => s + (pc.inventory[r] ?? 0), 0) : 0;
  const cap = pc ? pc.warehouse_level * cfg.warehouse_capacity_per_level : 0;

  const build = useAction<{ p_city: string; p_resource: Resource }>("build_or_upgrade", (d) =>
    (d as { level: number }).level === 1 ? "Budova postavena" : "Produkce vylepšena");
  const facility = useAction<{ p_city: string; p_kind: string }>("upgrade_facility", (_d, a) => (a.p_kind === "warehouse" ? "Sklad vylepšen" : "Tržiště vylepšeno"));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="grid size-12 place-items-center rounded-xl border bg-panel-2"><Building2 className="size-6 text-muted-foreground" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold">{city.name}{isHome && <Crown className="size-4 text-res-yellow" />}</h2>
          <p className="text-sm text-muted-foreground">
            {pc ? (isHome ? "Domovské město" : "Moje město") : "Neprozkoumané město"}
            {pc && ` · Sklad úr. ${pc.warehouse_level}`}{isHere && " · Jste zde"}
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Zavřít"><X /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!pc ? (
          <div className="space-y-3">
            <EfficiencyBars city={city} />
            <TravelCard city={city} cities={cities} state={state} />
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="mb-3 grid w-full grid-cols-4">
              <TabsTrigger value="overview">Přehled</TabsTrigger>
              <TabsTrigger value="production">Produkce</TabsTrigger>
              <TabsTrigger value="storage">Sklad</TabsTrigger>
              <TabsTrigger value="logistics">Logistika</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <Section title="Denní produkce">
                <div className="grid grid-cols-4 gap-2">
                  {RESOURCES.map((r) => (
                    <div key={r} className="rounded-lg border bg-panel-2 p-2 text-center">
                      <ResDot r={r} />
                      <div className="text-lg font-bold tabular-nums" style={{ color: RESOURCE_META[r].color }}>+{fmt(rate(r))}</div>
                      <div className="text-[10px] text-muted-foreground">{pc.buildings[r] ? `úr. ${pc.buildings[r]}` : "bez budovy"}</div>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Sklad zásob" right={`${fmt(stored)} / ${fmt(cap)}`}><ResCounters inv={pc.inventory} /></Section>
              <EfficiencyBars city={city} />
              {city.special && <Section title="Speciální vlastnosti"><p className="text-sm text-muted-foreground">{city.special}</p></Section>}
              {!isHere && <TravelCard city={city} cities={cities} state={state} />}
            </TabsContent>

            <TabsContent value="production" className="space-y-2">
              {RESOURCES.map((r) => {
                const lvl = pc.buildings[r];
                const max = lvl !== undefined && lvl >= cfg.max_level;
                const cost = !lvl ? cfg.build_cost : cfg.upgrade_cost[lvl + 1];
                return (
                  <div key={r} className="flex items-center gap-3 rounded-xl border bg-card/60 p-3">
                    <ResDot r={r} className="size-3" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{RESOURCE_META[r].label}</div>
                      <div className="text-xs text-muted-foreground">
                        {lvl ? `Úroveň ${lvl} · ${fmt(rate(r))}/den` : "Bez budovy"} · účinnost {Math.round(eff(r) * 100)} %
                        {!max && lvl ? ` → ${fmt(cfg.prod_per_level[lvl + 1] * eff(r))}/den` : ""}
                      </div>
                    </div>
                    <Button size="sm" variant={lvl ? "secondary" : "default"} disabled={max || build.isPending || state.profile.sp_balance < (cost ?? 0)}
                      onClick={() => build.mutate({ p_city: city.id, p_resource: r })}>
                      {lvl ? <ArrowUp /> : <Hammer />}
                      {max ? "Max" : `${lvl ? "Vylepšit" : "Postavit"} · ${cost} SP`}
                    </Button>
                  </div>
                );
              })}
              <p className="pt-1 text-xs text-muted-foreground">Produkce běží i offline podle uplynulého času a zastaví se při plném skladu.</p>
            </TabsContent>

            <TabsContent value="storage" className="space-y-3">
              <Section title="Zásoby ve skladu" right={`${fmt(stored)} / ${fmt(cap)}`}>
                <Progress value={(stored / cap) * 100} className="mb-3 h-1.5" />
                <ResCounters inv={pc.inventory} />
              </Section>
              <FacilityRow icon={<Package className="size-4" />} label="Sklad" level={pc.warehouse_level} max={cfg.max_level}
                desc={`Kapacita ${fmt(cap)} jednotek`} cost={cfg.warehouse_upgrade_cost[pc.warehouse_level + 1]} sp={state.profile.sp_balance}
                pending={facility.isPending} onClick={() => facility.mutate({ p_city: city.id, p_kind: "warehouse" })} />
              <PrepareExpedition cityId={city.id} state={state} />
            </TabsContent>

            <TabsContent value="logistics" className="space-y-3">
              <FacilityRow icon={<Store className="size-4" />} label="Tržiště" level={pc.market_level} max={cfg.max_level}
                desc={pc.market_level ? `Sleva na přepravu ${Math.min(pc.market_level, 4) * cfg.market_discount_per_level * 100} %` : "Nepostaveno – přeprava za plnou cenu"}
                cost={cfg.market_upgrade_cost[pc.market_level + 1]} sp={state.profile.sp_balance}
                pending={facility.isPending} onClick={() => facility.mutate({ p_city: city.id, p_kind: "market" })} />
              <ShipmentForm from={city} cities={cities} state={state} guild={guild} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function EfficiencyBars({ city }: { city: City }) {
  return (
    <Section title="Efektivita produkce">
      <div className="space-y-1.5">
        {RESOURCES.map((r) => {
          const e = Number(city[`eff_${r}` as const]);
          return (
            <div key={r} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-muted-foreground">{RESOURCE_META[r].short}</span>
              <div className="h-1.5 flex-1 rounded-full bg-panel-2"><div className="h-full rounded-full" style={{ width: `${(e / 1.4) * 100}%`, background: RESOURCE_META[r].color }} /></div>
              <span className="w-10 text-right tabular-nums">{Math.round(e * 100)} %</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function FacilityRow(p: { icon: React.ReactNode; label: string; level: number; max: number; desc: string; cost?: number; sp: number; pending: boolean; onClick: () => void }) {
  const maxed = p.level >= p.max;
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 p-3">
      <div className="grid size-8 place-items-center rounded-lg bg-panel-2">{p.icon}</div>
      <div className="flex-1">
        <div className="text-sm font-semibold">{p.label} {p.level > 0 && <span className="text-muted-foreground">· úr. {p.level}</span>}</div>
        <div className="text-xs text-muted-foreground">{p.desc}</div>
      </div>
      <Button size="sm" variant="secondary" disabled={maxed || p.pending || p.sp < (p.cost ?? 0)} onClick={p.onClick}>
        {maxed ? "Max" : `${p.level ? "Vylepšit" : "Postavit"} · ${p.cost} SP`}
      </Button>
    </div>
  );
}

export function TravelCard({ city, cities, state }: { city: City; cities: City[]; state: GameState }) {
  const cfg = state.config;
  const origin = cities.find((c) => c.id === state.profile.current_city_id)!;
  const km = Math.round(haversineKm(origin, city) * cfg.travel_multiplier * 10) / 10;
  const req = Math.ceil(km * cfg.sp_per_km);
  const start = useAction<{ p_city: string }>("start_travel");
  const fund = useAction<{ p_amount: number | null }>("fund_travel", (d) => ((d as { completed: boolean }).completed ? `Dorazili jste do cíle` : "SP přidány k cestě"));
  const t = state.travel;

  if (t) {
    const dest = cities.find((c) => c.id === t.to_city);
    return (
      <Section title="Probíhající cesta" right={`${dest?.name}`}>
        <Progress value={(t.sp_paid / t.sp_required) * 100} className="mb-2 h-2" />
        <div className="mb-3 text-xs text-muted-foreground">{fmt(t.sp_paid)} / {fmt(t.sp_required)} SP · {t.distance_km} km</div>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={fund.isPending || state.profile.sp_balance <= 0} onClick={() => fund.mutate({ p_amount: null })}>
            <Footprints /> Přidat SP ({fmt(Math.min(state.profile.sp_balance, t.sp_required - t.sp_paid))})
          </Button>
          <CancelTravel />
        </div>
      </Section>
    );
  }
  return (
    <Section title="Cestovat sem">
      <dl className="mb-3 grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Odkud</dt><dd className="text-right">{origin.name}</dd>
        <dt className="text-muted-foreground">Kam</dt><dd className="text-right">{city.name}</dd>
        <dt className="text-muted-foreground">Virtuální vzdálenost</dt><dd className="text-right tabular-nums">{km} km</dd>
        <dt className="text-muted-foreground">Potřeba SP</dt><dd className="text-right font-semibold tabular-nums">{fmt(req)}</dd>
        <dt className="text-muted-foreground">Dostupné SP</dt><dd className="text-right tabular-nums">{fmt(state.profile.sp_balance)}</dd>
      </dl>
      <Button className="w-full" disabled={start.isPending || fund.isPending}
        onClick={async () => { await start.mutateAsync({ p_city: city.id }); if (state.profile.sp_balance > 0) fund.mutate({ p_amount: null }); }}>
        <MapPin /> {state.profile.sp_balance >= req ? "Cestovat sem" : "Zahájit cestu a vložit dostupné SP"}
      </Button>
    </Section>
  );
}

function CancelTravel() {
  const cancel = useAction<Record<string, never>>("cancel_travel", "Cesta zrušena");
  return <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate({})}>Zrušit</Button>;
}

function PrepareExpedition({ cityId, state }: { cityId: string; state: GameState }) {
  const [res, setRes] = useState<Resource>("blue");
  const [qty, setQty] = useState(25);
  const prep = useAction<{ p_city: string; p_resource: Resource; p_qty: number }>("prepare_expedition", "Expedice připravena");
  const carried = RESOURCES.reduce((s, r) => s + (state.expedition[r] ?? 0), 0);
  const avail = state.cities.find((c) => c.city_id === cityId)?.inventory[res] ?? 0;
  return (
    <Section title="Připravit expedici" right={`Náklad ${carried} / ${state.config.expedition_capacity}`}>
      <div className="flex gap-2">
        <ResSelect value={res} onChange={setRes} />
        <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-24" />
        <Button disabled={prep.isPending || qty <= 0 || qty > avail} onClick={() => prep.mutate({ p_city: cityId, p_resource: res, p_qty: qty })}>Naložit</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">K dispozici {fmt(avail)} · naložené zásoby slouží k získávání lokalit.</p>
    </Section>
  );
}

function ResSelect({ value, onChange }: { value: Resource; onChange: (r: Resource) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Resource)}>
      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
      <SelectContent>{RESOURCES.map((r) => <SelectItem key={r} value={r}><span className="flex items-center gap-2"><ResDot r={r} />{RESOURCE_META[r].short}</span></SelectItem>)}</SelectContent>
    </Select>
  );
}

function ShipmentForm({ from, cities, state, guild }: { from: City; cities: City[]; state: GameState; guild: Guild | null | undefined }) {
  const me = state.profile.id;
  const recipients = useMemo(() => {
    const own = { id: me, username: "Já", cities: state.cities.map((c) => c.city_id) };
    return [own, ...(guild?.members.filter((m) => m.id !== me) ?? [])];
  }, [guild, state.cities, me]);
  const [rcpt, setRcpt] = useState(me);
  const r = recipients.find((x) => x.id === rcpt) ?? recipients[0];
  const destOptions = r.cities.filter((c) => !(rcpt === me && c === from.id));
  const [dest, setDest] = useState<string>("");
  const to = destOptions.includes(dest) ? dest : destOptions[0];
  const [res, setRes] = useState<Resource>("blue");
  const [qty, setQty] = useState(20);
  const avail = state.cities.find((c) => c.city_id === from.id)?.inventory[res] ?? 0;
  const quote = useQuery({ queryKey: ["quote", from.id, to, qty], enabled: !!to && qty > 0, queryFn: () => quoteShipment(from.id, to!, qty) });
  const ship = useAction<{ p_from: string; p_to: string; p_resource: Resource; p_qty: number; p_recipient: string }>("send_shipment", "Přeprava dokončena");
  const destName = (id: string) => cities.find((c) => c.id === id)?.name ?? id;

  return (
    <Section title="Přepravit zásoby" right={<Truck className="size-4" />}>
      <div className="space-y-2">
        <Select value={rcpt} onValueChange={setRcpt}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{recipients.map((m) => <SelectItem key={m.id} value={m.id}>{m.id === me ? "Do mého skladu" : `Člen guildy: ${m.username}`}</SelectItem>)}</SelectContent>
        </Select>
        {destOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">{rcpt === me ? "Nemáte jiný sklad. Docestujte do dalšího města." : "Příjemce nemá žádný sklad."}</p>
        ) : (
          <>
            <Select value={to} onValueChange={setDest}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{destOptions.map((c) => <SelectItem key={c} value={c}>{from.name} → {destName(c)}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <ResSelect value={res} onChange={setRes} />
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-24" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>K dispozici: {fmt(avail)}</span>
              <span>Cena: <b className="text-foreground">{quote.data != null ? `${fmt(quote.data)} SP` : "…"}</b> / {fmt(state.profile.sp_balance)} SP</span>
            </div>
            <Button className="w-full" disabled={ship.isPending || qty <= 0 || qty > avail || (quote.data ?? Infinity) > state.profile.sp_balance}
              onClick={() => ship.mutate({ p_from: from.id, p_to: to!, p_resource: res, p_qty: qty, p_recipient: rcpt })}>
              <Truck /> Odeslat {qty} {RESOURCE_META[res].genitive} zásob
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}
