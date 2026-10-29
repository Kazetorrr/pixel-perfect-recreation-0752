import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Shield, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameShell } from "@/components/game/GameShell";
import { Section, SimBadge } from "@/components/game/ui";
import { CATEGORIES, CATEGORY_META, RESOURCE_META, fmt } from "@/game/config";
import { useAction, useCities, useLeaderboards, type GameState, type Guild } from "@/game/api";

export const Route = createFileRoute("/guilda")({
  head: () => ({
    meta: [
      { title: "summ-it – guilda a žebříčky" },
      { name: "description", content: "Spravujte svou guildu, sdílejte zásoby a sledujte sezónní žebříčky guild, objevitelů a ekonomů." },
      { property: "og:title", content: "summ-it – guilda a žebříčky" },
      { property: "og:description", content: "Sezónní žebříčky guild, objevitelů a ekonomů." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <GameShell>{(state, guild) => <GuildScreen state={state} guild={guild} />}</GameShell>,
});

function GuildScreen({ state, guild }: { state: GameState; guild: Guild | null | undefined }) {
  return (
    <div className="h-full overflow-y-auto px-3 pb-28 pt-20 sm:px-6 sm:pt-24">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
        <div className="space-y-4">{guild ? <GuildDetail guild={guild} state={state} /> : <NoGuild />}</div>
        <Leaderboards state={state} />
      </div>
    </div>
  );
}

function NoGuild() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const create = useAction<{ p_name: string }>("create_guild", "Guilda založena");
  const join = useAction<{ p_code: string }>("join_guild", "Připojili jste se ke guildě");
  return (
    <div className="panel space-y-4 p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Shield className="size-5 text-res-yellow" /> Nejste v guildě</h2>
      <p className="text-sm text-muted-foreground">Hrát můžete i sami. V guildě ale sdílíte zásoby a společně získáváte lokality.</p>
      <div className="flex gap-2"><Input placeholder="Název nové guildy" value={name} onChange={(e) => setName(e.target.value)} /><Button disabled={create.isPending} onClick={() => create.mutate({ p_name: name })}>Založit</Button></div>
      <div className="flex gap-2"><Input placeholder="Kód pozvánky" value={code} onChange={(e) => setCode(e.target.value)} /><Button variant="secondary" disabled={join.isPending} onClick={() => join.mutate({ p_code: code })}>Připojit</Button></div>
    </div>
  );
}

function GuildDetail({ guild, state }: { guild: Guild; state: GameState }) {
  const cities = useCities();
  const cname = (id: string) => cities.data?.find((c) => c.id === id)?.name ?? id;
  const leave = useAction<Record<string, never>>("leave_guild", "Opustili jste guildu");
  return (
    <>
      <div className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold"><Shield className="size-6 text-res-yellow" /> {guild.name}</h2>
            <p className="text-sm text-muted-foreground">{guild.members.length} / {state.config.guild_max_members} členů · {state.season?.name}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(guild.invite_code); toast.success("Kód zkopírován"); }}>
            <Copy /> {guild.invite_code}
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Získané lokality" value={guild.stats.total} />
          <Stat label="Ověřeno GPS" value={guild.stats.verified} />
          <Stat label="Utracené zásoby" value={guild.stats.spent} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          {CATEGORIES.map((c) => <Stat key={c} label={CATEGORY_META[c].plural} value={guild.stats[c]} color={RESOURCE_META[CATEGORY_META[c].resource].color} />)}
        </div>
      </div>
      <Section title="Členové">
        <ul className="divide-y">
          {guild.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2 text-sm">
              <div><div className="font-semibold">{m.username}{m.id === guild.owner_id && <span className="ml-2 text-xs text-res-yellow">zakladatel</span>}</div>
                <div className="text-xs text-muted-foreground">Sklady: {m.cities.map(cname).join(", ")}</div></div>
              <span className="text-xs text-muted-foreground">{m.claims} lokalit</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Nedávná aktivita">
        {guild.activity.length ? (
          <ul className="space-y-1.5 text-sm">
            {guild.activity.map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{a.type === "claim" ? <><b>{a.user}</b> získal(a) {a.poi}</> : <><b>{a.user}</b> poslal(a) {a.qty} {(a.resource ? RESOURCE_META[a.resource].genitive : "")} zásob hráči <b>{a.to}</b></>}</span>
                {a.verification === "simulated" && <SimBadge />}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Zatím žádná aktivita.</p>}
      </Section>
      <Button variant="ghost" className="text-destructive" disabled={leave.isPending} onClick={() => { if (confirm("Opustit guildu?")) leave.mutate({}); }}>Opustit guildu</Button>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return <div className="rounded-lg border bg-panel-2 p-2"><div className="text-lg font-bold tabular-nums" style={{ color }}>{fmt(value)}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>;
}

function Leaderboards({ state }: { state: GameState }) {
  const [cat, setCat] = useState("all");
  const [ver, setVer] = useState("gps");
  const [board, setBoard] = useState<"guilds" | "explorers" | "economists">("guilds");
  const lb = useLeaderboards(cat, ver);
  const rows = (lb.data?.[board] ?? []) as { name: string; score: number; guild?: string | null; members?: number }[];
  return (
    <div className="panel space-y-3 p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Trophy className="size-5 text-res-yellow" /> Žebříčky · {state.season?.name}</h2>
      <Tabs value={board} onValueChange={(v) => setBoard(v as typeof board)}>
        <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="guilds">Guildy</TabsTrigger><TabsTrigger value="explorers">Objevitelé</TabsTrigger><TabsTrigger value="economists">Ekonomové</TabsTrigger></TabsList>
      </Tabs>
      <div className="flex flex-wrap gap-1">
        {["all", ...CATEGORIES].map((c) => (
          <Button key={c} size="sm" variant={cat === c ? "default" : "secondary"} disabled={board === "economists"} onClick={() => setCat(c)}>
            {c === "all" ? "Vše" : CATEGORY_META[c as keyof typeof CATEGORY_META].plural}
          </Button>
        ))}
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant={ver === "gps" ? "default" : "secondary"} onClick={() => setVer("gps")}>Ověřené GPS</Button>
        <Button size="sm" variant={ver === "simulated" ? "default" : "secondary"} onClick={() => setVer("simulated")}>Simulované (demo)</Button>
      </div>
      {board === "economists" && <p className="text-xs text-muted-foreground">Body za zásoby, které jiní hráči skutečně spotřebovali při získání lokality.</p>}
      <ol className="divide-y">
        {rows.length ? rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-6 text-muted-foreground">{i + 1}.</span>
            <span className="flex-1 font-semibold">{r.name}{r.guild && <span className="font-normal text-muted-foreground"> · {r.guild}</span>}</span>
            <span className="tabular-nums">{fmt(r.score)}</span>
          </li>
        )) : <li className="py-4 text-center text-sm text-muted-foreground">{lb.isLoading ? "Načítám…" : "Zatím bez výsledků"}</li>}
      </ol>
    </div>
  );
}
