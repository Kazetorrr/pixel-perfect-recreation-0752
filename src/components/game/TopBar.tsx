import { useState } from "react";
import { Footprints, LogOut, Shield, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/game/config";
import { useAction, useTodaySteps, type GameState, type Guild } from "@/game/api";
import { SimBadge, StepAmount } from "./ui";
import logoTop from "@/assets/summit-logo-topbar.png";
import logoTopIcon from "@/assets/summit-logo-topbar-icon.png";

export function TopBar({ state, guild }: { state: GameState; guild: Guild | null | undefined }) {
  const p = state.profile;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-2 sm:p-4">
      <div className="panel pointer-events-auto flex items-center gap-3 px-3 py-2 sm:px-4">
        <img src={logoTopIcon} alt="summ-it" className="size-7 shrink-0 sm:hidden" />
        <img src={logoTop} alt="summ-it" className="hidden h-8 w-auto shrink-0 sm:block" />
        <div className="mx-1 hidden h-8 w-px bg-border sm:block" />
        <TodaySteps />
        <StepPopover state={state} />
      </div>
      <div className="flex-1" />
      <div className="panel pointer-events-auto hidden items-center gap-2 px-3 py-2 md:flex">
        <Shield className="size-5 text-res-yellow" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">{guild?.name ?? "Bez guildy"}</div>
          <div className="text-xs text-muted-foreground">{guild ? `${guild.members.length} / ${state.config.guild_max_members} členů` : "Připojte se v sekci Guilda"}</div>
        </div>
      </div>
      {state.config.dev_mode && <DevPanel state={state} />}
      <Popover>
        <PopoverTrigger asChild>
          <button className="panel pointer-events-auto grid size-11 place-items-center font-semibold uppercase">{p.username[0]}</button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56">
          <div className="font-semibold">{p.username}</div>
          <div className="mb-3 text-xs text-muted-foreground">Sezóna: {state.season?.name}</div>
          <Button variant="secondary" className="w-full" onClick={() => supabase.auth.signOut()}><LogOut /> Odhlásit</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function TodaySteps() {
  const today = useTodaySteps();
  return (
    <div className="flex items-center gap-2 px-1" title="Dnes nachozené kroky (od půlnoci)">
      <Footprints className="size-5 text-muted-foreground" />
      <div className="leading-tight"><div className="text-[10px] text-muted-foreground">Dnes</div><div className="font-semibold tabular-nums text-muted-foreground">{fmt(today.data)}</div></div>
    </div>
  );
}

function StepPopover({ state }: { state: GameState }) {
  const p = state.profile;
  const [custom, setCustom] = useState(2500);
  const grant = useAction<{ p_steps: number }>("dev_grant_steps", (_d, a) => `+${fmt(a.p_steps)} testovacích kroků`);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-1 text-left">
          <Footprints className="size-5 text-primary" />
          <div className="leading-tight"><div className="text-[10px] text-muted-foreground">Dostupné</div><div className="font-semibold tabular-nums">{fmt(p.wallet_steps)}</div></div>
          {state.config.dev_mode && <span className="ml-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">+ kroky</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Krokové body</span><SimBadge>Simulátor kroků</SimBadge></div>
        <dl className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Nachozeno</dt><dd className="font-semibold">{fmt(p.steps_total)}</dd></div>
          <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Dostupné</dt><dd className="font-semibold">{fmt(p.wallet_steps)}</dd></div>
          <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Utracené</dt><dd className="font-semibold">{fmt(p.spent_steps)}</dd></div>
        </dl>
        {state.config.dev_mode && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">Testovací kroky se připisují 1:1 a nejsou součástí skutečně nachozeného počtu.</p>
            <div className="mb-2 grid grid-cols-3 gap-2">
              {[1000, 5000, 10000].map((s) => <Button key={s} size="sm" variant="secondary" disabled={grant.isPending} onClick={() => grant.mutate({ p_steps: s })}>+{fmt(s)}</Button>)}
            </div>
            <div className="mb-3 flex gap-2">
              <Input type="number" min={1} step={1} value={custom} onChange={(e) => setCustom(Number(e.target.value))} />
              <Button size="sm" disabled={grant.isPending || custom <= 0 || !Number.isInteger(custom)} onClick={() => grant.mutate({ p_steps: custom })}>Přidat</Button>
            </div>
          </>
        )}
        <div className="mb-2 text-xs text-muted-foreground">Testovací přírůstky: {fmt(p.test_steps)}</div><div className="text-xs font-semibold text-muted-foreground">Poslední pohyby</div>
        <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
          {state.transactions.map((t, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{t.note}{t.simulated && " (sim.)"}</span>
              <span className={t.delta_steps >= 0 ? "text-res-green" : "text-destructive"}>{t.delta_steps >= 0 ? "+" : "−"}<StepAmount value={Math.abs(t.delta_steps)} /></span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function DevPanel({ state }: { state: GameState }) {
  const day = useAction<Record<string, never>>("dev_advance_day", "Simulovaný čas posunut o 1 den");
  const reset = useAction<Record<string, never>>("dev_reset", "Herní data resetována");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="panel pointer-events-auto grid size-11 place-items-center" aria-label="Testovací panel"><Wrench className="size-5 text-sim-foreground" /></button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Testovací panel <SimBadge>Vývoj</SimBadge></DialogTitle>
          <DialogDescription>Simulované akce pro testování. Neovlivňují ověřené žebříčky.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button className="w-full" variant="secondary" disabled={day.isPending} onClick={() => day.mutate({})}>Posunout čas produkce o 1 den</Button>
          <p className="text-xs text-muted-foreground">Posun simulovaného času: {Math.round(state.profile.time_offset_seconds / 86400)} dní</p>
          <Button className="w-full" variant="destructive" disabled={reset.isPending}
            onClick={() => { if (confirm("Opravdu smazat veškerý herní postup?")) reset.mutate({}); }}>Resetovat moje herní data</Button>
          <details className="rounded-lg border p-2 text-xs">
            <summary className="cursor-pointer font-semibold">Aktuální herní stav</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap">{JSON.stringify({ ...state, config: undefined }, null, 2)}</pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
