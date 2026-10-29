import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Crown, Footprints, MapPin, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RESOURCES, RESOURCE_META, TIER_META, tierBonusText, fmt, haversineKm, type Resource } from "@/game/config";
import { quoteShipment, useAction, type City, type GameState, type Guild, type SettlementOwner } from "@/game/api";
import { travelPrice, foundingPrice } from "@/game/economy";
import { ResCounters, ResDot, Section, StepAmount, MissingSteps } from "./ui";
import { UpgradeTree } from "./UpgradeTree";
import { ExpeditionSupply } from "./ExpeditionSupply";

export function CityPanel({ city, cities, state, guild, owners = [], onClose }: { city: City; cities: City[]; state: GameState; guild: Guild | null | undefined; owners?: SettlementOwner[]; onClose: () => void }) {
  const cfg = state.config;
  const me = state.profile.id;
  const others = owners.filter((o) => o.id !== me);
  const [who, setWho] = useState<string>(owners.some((o) => o.id === me) || others.length === 0 ? me : others[0]?.id ?? me);
  const viewed = who === me ? null : others.find((o) => o.id === who) ?? null;
  const pc = state.cities.find((c) => c.city_id === city.id);
  const isHere = state.profile.current_city_id === city.id;
  const isHome = state.profile.home_city_id === city.id;
  const eff = (r: Resource) => Number(city[`eff_${r}` as const]);
  const bonus = cfg.tier_bonus?.[city.tier] ?? {};
  const rate = (r: Resource) => { const l = pc?.buildings[r]; return l ? (cfg.prod_per_level[l] ?? 0) * eff(r) * (1 + (bonus.production ?? 0)) : 0; };
  const stored = pc?.used_capacity ?? 0;
  const cap = pc ? (pc.capacity ?? cfg.warehouse_capacity[0]) : 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-3 border-b p-4">
        <div className="grid size-12 place-items-center rounded-xl border bg-panel-2"><Building2 className="size-6 text-muted-foreground" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold">{city.name}{isHome && <Crown className="size-4 text-res-yellow" />}</h2>
          <p className="text-sm text-muted-foreground">
            {TIER_META[city.tier].label} · {pc ? (isHome ? "Domovské město" : "Moje město") : others.length ? "Sídlo guildy" : "Neprozkoumané město"}
            {pc && ` · Sklad úr. ${pc.warehouse_level}`}{isHere && " · Jste zde"}
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Zavřít"><X /></Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {others.length > 0 && (
          <Section title={owners.length === 1 ? "Člen guildy zde má infrastrukturu" : `${owners.length} ${owners.length < 5 ? "členové" : "členů"} guildy zde ${owners.length < 5 ? "mají" : "má"} infrastrukturu`}>
            <div className="space-y-1">
              {owners.map((o) => {
                const lv = Object.values(o.buildings).reduce((a, b) => a + Number(b), 0);
                const active = o.id === who;
                return (
                  <button key={o.id} type="button" onClick={() => setWho(o.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition-colors ${active ? "border-primary bg-accent" : "border-transparent hover:bg-muted"}`}>
                    <span className="size-3 rounded-full" style={{ background: o.id === me ? state.profile.color : o.color }} />
                    <span className="flex-1 truncate">{o.id === me ? `${o.username} (já)` : o.username}</span>
                    <span className="text-xs text-muted-foreground">budovy {lv} · tržiště {o.market_level}</span>
                  </button>
                );
              })}
              {!owners.some((o) => o.id === me) && (
                <button type="button" onClick={() => setWho(me)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm ${who === me ? "border-primary bg-accent" : "border-transparent hover:bg-muted"}`}>
                  <span className="size-3 rounded-full" style={{ background: state.profile.color }} />
                  <span className="flex-1">Moje možnosti</span>
                </button>
              )}
            </div>
          </Section>
        )}
        {others.length > 0 && <div className="h-3" />}
        {viewed ? (
          <MemberView city={city} owner={viewed} state={state} cities={cities} />
        ) : !pc ? (
          <div className="space-y-3">
            <EfficiencyBars city={city} />
            <TravelCard city={city} cities={cities} state={state} />
            {isHere && <FoundingCard city={city} state={state} />}
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="mb-3 grid w-full grid-cols-3">
              <TabsTrigger value="overview">Přehled</TabsTrigger>
              <TabsTrigger value="upgrades">Vylepšení</TabsTrigger>
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
              <Section title="Bonus sídla"><p className="text-sm"><span className="font-medium">{TIER_META[city.tier].label}:</span> <span className="text-muted-foreground">{tierBonusText(city.tier, bonus)}</span></p></Section>
              {city.special && <Section title="Speciální vlastnosti"><p className="text-sm text-muted-foreground">{city.special}</p></Section>}
              {!isHere && <TravelCard city={city} cities={cities} state={state} />}
            </TabsContent>

            <TabsContent value="upgrades">
              <UpgradeTree city={city} pc={pc} state={state} />
            </TabsContent>

            <TabsContent value="logistics" className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Truck className="size-4" />Guildovní zásilky</h3>
              <p className="text-xs text-muted-foreground">{pc.market_level ? `Tržiště úr. ${pc.market_level} · dnes odesláno ${pc.market_used}/${pc.market_capacity} · sleva ${Math.round((cfg.market_discount[Math.min(pc.market_level, cfg.market_max_level)] ?? 0)*100)} %` : "Tržiště není postaveno"}</p>
              <ShipmentForm from={city} cities={cities} state={state} guild={guild} />
              <ExpeditionSupply city={city} pc={pc} state={state} />
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

export function TravelCard({ city, cities, state }: { city: City; cities: City[]; state: GameState }) {
  const cfg = state.config;
  const origin = cities.find((c) => c.id === state.profile.current_city_id);
  const km = origin ? haversineKm(origin, city) : 0;
  const req = travelPrice(cfg, km);
  const start = useAction<{ p_city: string }>("start_travel");
  const fund = useAction<{ p_amount: number | null }>("fund_travel", (d) => ((d as { completed: boolean }).completed ? `Dorazili jste do cíle` : "Kroky vloženy do cesty"));
  const t = state.travel;

  if (!origin) return null;
  if (t) {
    const dest = cities.find((c) => c.id === t.to_city);
    return (
      <Section title="Probíhající cesta" right={`${dest?.name}`}>
        <Progress value={(t.paid_steps / t.required_steps) * 100} className="mb-2 h-2" />
        <div className="mb-3 text-xs text-muted-foreground"><StepAmount value={t.paid_steps} /> / <StepAmount value={t.required_steps} /> · {fmt(t.distance_km)} km</div>
        <div className="flex gap-2">
          <Button className="flex-1" disabled={fund.isPending || state.profile.wallet_steps <= 0} onClick={() => fund.mutate({ p_amount: null })}>
            <Footprints /> Vložit {fmt(Math.min(state.profile.wallet_steps, t.required_steps - t.paid_steps))}
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
        <dt className="text-muted-foreground">Přímá vzdálenost</dt><dd className="text-right tabular-nums">{km.toFixed(1)} km</dd>
        <dt className="text-muted-foreground">Cena</dt><dd className="text-right font-semibold tabular-nums"><StepAmount value={req} /></dd>
        <dt className="text-muted-foreground">Dostupné</dt><dd className="text-right tabular-nums"><StepAmount value={state.profile.wallet_steps} /></dd>
      </dl>
      <MissingSteps cost={req} balance={state.profile.wallet_steps} />
      <Button className="mt-2 w-full" disabled={start.isPending || fund.isPending}
        onClick={async () => { await start.mutateAsync({ p_city: city.id }); if (state.profile.wallet_steps > 0) fund.mutate({ p_amount: null }); }}>
        <MapPin /> {state.profile.wallet_steps >= req ? "Cestovat sem" : "Zahájit a vložit dostupné kroky"}
      </Button>
    </Section>
  );
}

function CancelTravel() {
  const cancel = useAction<Record<string, never>>("cancel_travel", "Cesta zrušena");
  return <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate({})}>Zrušit</Button>;
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
  const destOptions = (r?.cities ?? []).filter((c) => !(rcpt === me && c === from.id));
  const [dest, setDest] = useState<string>("");
  const to = destOptions.includes(dest) ? dest : destOptions[0];
  const [res, setRes] = useState<Resource>("blue");
  const [qty, setQty] = useState(20);
  const avail = state.cities.find((c) => c.city_id === from.id)?.transferable[res] ?? 0;
  const sender = state.cities.find((c) => c.city_id === from.id);
  const canSend = !!sender && sender.market_level > 0;
  const quote = useQuery({ queryKey: ["quote", from.id, to, qty, sender?.market_level], enabled: canSend && !!to && qty > 0, queryFn: () => { if (!to) throw new Error("Zvolte cíl"); return quoteShipment(from.id, to, qty); } });
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
          <p className="text-xs text-muted-foreground">{rcpt === me ? "Nemáte jiný sklad. Založte další sídlo." : "Příjemce nemá žádný sklad."}</p>
        ) : (
          <>
            <Select value={to ?? ""} onValueChange={setDest}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{destOptions.map((c) => <SelectItem key={c} value={c}>{from.name} → {destName(c)}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <ResSelect value={res} onChange={setRes} />
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-24" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Přenosné: {fmt(avail)}</span>
              <span>Cena: <b className="text-foreground">{quote.data != null ? <StepAmount value={quote.data} /> : "…"}</b> / <StepAmount value={state.profile.wallet_steps} /></span>
            </div>
            {!canSend && <p className="text-xs text-destructive">Odesílání vyžaduje postavené tržiště, i v témže sídle.</p>}
            {sender && <p className="text-xs text-muted-foreground">Denní kapacita: {sender.market_used}/{sender.market_capacity}</p>}
            <MissingSteps cost={quote.data ?? 0} balance={state.profile.wallet_steps} />
            <Button className="w-full" disabled={!canSend || qty > (sender ? sender.market_capacity - sender.market_used : 0) || ship.isPending || !Number.isInteger(qty) || qty <= 0 || qty > avail || (quote.data ?? Infinity) > state.profile.wallet_steps}
              onClick={() => { if (!to) return; ship.mutate({ p_from: from.id, p_to: to, p_resource: res, p_qty: qty, p_recipient: rcpt }); }}>
              <Truck /> Odeslat {qty} {RESOURCE_META[res].genitive} zásob
            </Button>
          </>
        )}
      </div>
    </Section>
  );
}

function MemberView({ city, owner, state, cities }: { city: City; owner: SettlementOwner; state: GameState; cities: City[] }) {
  const cfg = state.config;
  const eff = (r: Resource) => Number(city[`eff_${r}` as const]);
  const bonus = cfg.tier_bonus?.[city.tier] ?? {};
  return (
    <div className="space-y-3">
      <Section title={`Infrastruktura hráče ${owner.username}`} right={<span className="text-[10px] uppercase text-muted-foreground">jen náhled</span>}>
        <div className="grid grid-cols-4 gap-2">
          {RESOURCES.map((r) => {
            const l = owner.buildings[r];
            const rate = l ? (cfg.prod_per_level[l] ?? 0) * eff(r) * (1 + (bonus.production ?? 0)) : 0;
            return (
              <div key={r} className="rounded-lg border bg-panel-2 p-2 text-center">
                <ResDot r={r} />
                <div className="text-lg font-bold tabular-nums" style={{ color: RESOURCE_META[r].color }}>+{fmt(rate)}</div>
                <div className="text-[10px] text-muted-foreground">{l ? `úr. ${l}` : "bez budovy"}</div>
              </div>
            );
          })}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Sklad</dt><dd className="text-right">úroveň {owner.warehouse_level}</dd>
          <dt className="text-muted-foreground">Tržiště</dt><dd className="text-right">{owner.market_level ? `úroveň ${owner.market_level}` : "nepostaveno"}</dd>
        </dl>
      </Section>
      <ShipToMember city={city} owner={owner} state={state} cities={cities} />
    </div>
  );
}

function ShipToMember({ city, owner, state, cities }: { city: City; owner: SettlementOwner; state: GameState; cities: City[] }) {
  const mine = state.cities;
  const [fromId, setFrom] = useState<string>(mine.find((c) => c.city_id === state.profile.current_city_id)?.city_id ?? mine[0]?.city_id ?? "");
  const [res, setRes] = useState<Resource>("blue");
  const [qty, setQty] = useState(20);
  const avail = mine.find((c) => c.city_id === fromId)?.transferable[res] ?? 0;
  const sender = mine.find((c) => c.city_id === fromId);
  const canSend = !!sender && sender.market_level > 0;
  const quote = useQuery({ queryKey: ["quote", fromId, city.id, qty, sender?.market_level], enabled: canSend && !!fromId && qty > 0, queryFn: () => quoteShipment(fromId, city.id, qty) });
  const ship = useAction<{ p_from: string; p_to: string; p_resource: Resource; p_qty: number; p_recipient: string }>("send_shipment", "Přeprava dokončena");
  const name = (id: string) => cities.find((c) => c.id === id)?.name ?? id;
  if (!mine.length) return null;
  return (
    <Section title={`Poslat zásoby hráči ${owner.username}`} right={<Truck className="size-4" />}>
      <div className="space-y-2">
        <Select value={fromId} onValueChange={setFrom}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{mine.map((c) => <SelectItem key={c.city_id} value={c.city_id}>{name(c.city_id)} → {city.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex gap-2">
          <ResSelect value={res} onChange={setRes} />
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-24" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Přenosné: {fmt(avail)}</span>
          <span>Cena: <b className="text-foreground">{quote.data != null ? <StepAmount value={quote.data} /> : "…"}</b> / <StepAmount value={state.profile.wallet_steps} /></span>
        </div>
        {!canSend && <p className="text-xs text-destructive">Odesílání vyžaduje postavené tržiště, i v témže sídle.</p>}
        {sender && <p className="text-xs text-muted-foreground">Denní kapacita: {sender.market_used}/{sender.market_capacity}</p>}
        <MissingSteps cost={quote.data ?? 0} balance={state.profile.wallet_steps} />
        <Button className="w-full" disabled={!canSend || qty > (sender ? sender.market_capacity - sender.market_used : 0) || ship.isPending || !Number.isInteger(qty) || qty <= 0 || qty > avail || (quote.data ?? Infinity) > state.profile.wallet_steps}
          onClick={() => ship.mutate({ p_from: fromId, p_to: city.id, p_resource: res, p_qty: qty, p_recipient: owner.id })}>
          <Truck /> Odeslat {qty} {RESOURCE_META[res].genitive} zásob
        </Button>
      </div>
    </Section>
  );
}

function FoundingCard({ city, state }: { city: City; state: GameState }) {
  const cost = foundingPrice(state.config, state.profile.founded_count + 1);
  const found = useAction<{ p_city: string }>("found_settlement", "Sídlo založeno");
  return <Section title="Založit ekonomické sídlo"><p className="mb-2 text-sm text-muted-foreground">Sídlo č. {state.profile.founded_count + 1} · prázdný sklad {state.config.warehouse_capacity[0]}</p><MissingSteps cost={cost} balance={state.profile.wallet_steps} /><Button className="mt-2 w-full" disabled={found.isPending || !!state.travel || state.profile.wallet_steps < cost} onClick={() => found.mutate({ p_city: city.id })}><Building2 />Založit <StepAmount value={cost} /></Button></Section>;
}
