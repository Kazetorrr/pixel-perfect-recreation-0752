import { useState } from "react";
import { Footprints, LogOut, Shield, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fmt } from "@/game/config";
import { useAction, type GameState, type Guild } from "@/game/api";
import { SimBadge } from "./ui";
import logoIcon from "@/assets/summit-logo-icon.png";
import logoWord from "@/assets/summit-logo-wordmark.png";

export function TopBar({ state, guild }: { state: GameState; guild: Guild | null | undefined }) {
  const p = state.profile;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-2 sm:p-4">
      <div className="panel pointer-events-auto flex items-center gap-3 px-3 py-2 sm:px-4">
        <img src={logoIcon} alt="" className="size-7 shrink-0" />
        <div className="hidden flex-col justify-center leading-tight sm:flex">
          <img src={logoWord} alt="summ-it" className="h-5 w-auto" />
          <div className="text-[10px] tracking-widest text-muted-foreground">BETA</div>
        </div>
        <div className="mx-1 hidden h-8 w-px bg-border sm:block" />
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

function StepPopover({ state }: { state: GameState }) {
  const p = state.profile;
  const [custom, setCustom] = useState(2500);
  const grant = useAction<{ p_steps: number }>("dev_grant_steps", (d, a) => `+${fmt(a.p_steps)} kroků → +${fmt((d as { sp: number }).sp)} SP`);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-1 text-left">
          <Footprints className="size-5 text-primary" />
          <div className="leading-tight"><div className="text-[10px] text-muted-foreground">SP</div><div className="font-semibold tabular-nums">{fmt(p.sp_balance)}</div></div>
          {state.config.dev_mode && <span className="ml-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">+ kroky</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="mb-2 flex items-center justify-between"><span className="font-semibold">Krokové body</span><SimBadge>Simulátor kroků</SimBadge></div>
        <dl className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Kroky</dt><dd className="font-semibold">{fmt(p.steps_total)}</dd></div>
          <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Dostupné SP</dt><dd className="font-semibold">{fmt(p.sp_balance)}</dd></div>
          <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">Utracené SP</dt><dd className="font-semibold">{fmt(p.sp_spent)}</dd></div>
        </dl>
        {state.config.dev_mode && (
          <>
            <p className="mb-2 text-xs text-muted-foreground">Vývojový simulátor: {state.config.steps_per_sp} kroků = 1 SP. Skutečné kroky z telefonu budou doplněny později.</p>
            <div className="mb-2 grid grid-cols-3 gap-2">
              {[1000, 5000, 10000].map((s) => <Button key={s} size="sm" variant="secondary" disabled={grant.isPending} onClick={() => grant.mutate({ p_steps: s })}>+{fmt(s)}</Button>)}
            </div>
            <div className="mb-3 flex gap-2">
              <Input type="number" min={1} value={custom} onChange={(e) => setCustom(Number(e.target.value))} />
              <Button size="sm" disabled={grant.isPending || custom <= 0} onClick={() => grant.mutate({ p_steps: custom })}>Přidat</Button>
            </div>
          </>
        )}
        <div className="text-xs font-semibold text-muted-foreground">Poslední pohyby SP</div>
        <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs">
          {state.transactions.map((t, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{t.note}{t.simulated && " (sim.)"}</span>
              <span className={t.sp >= 0 ? "text-res-green" : "text-destructive"}>{t.sp >= 0 ? "+" : ""}{fmt(t.sp)}</span>
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
