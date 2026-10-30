import { Link } from "@tanstack/react-router";
import { Map as MapIcon, Users } from "lucide-react";
import { useGameState, useGuild, useSession, type GameState, type Guild } from "@/game/api";
import { AuthScreen } from "./AuthScreen";
import logoIcon from "@/assets/summit-logo-icon.png";
import { Onboarding } from "./Onboarding";
import { TopBar } from "./TopBar";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { syncHealthSteps } from "@/lib/health-connect";

export function GameShell({ children }: { children: (state: GameState, guild: Guild | null | undefined) => React.ReactNode }) {
  const { session, ready } = useSession();
  const st = useGameState(!!session);
  const onboarded = !!st.data && (st.data as GameState).onboarded;
  const guild = useGuild(!!session && onboarded);
  const qc = useQueryClient();
  useEffect(() => {
    if (!onboarded) return;
    const run = () => syncHealthSteps().then((n) => { if (n > 0) { toast.success(`Health Connect: +${n} kroků`); qc.invalidateQueries({ queryKey: ["state"] }); } }).catch((e: Error) => toast.error(`Health Connect: ${e.message}`));
    run();
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [onboarded, qc]);

  if (!ready || (session && st.isLoading))
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-4">
          <img src={logoIcon} alt="summ-it" width={174} height={174} className="h-28 w-28 animate-pulse" />
          <div className="text-muted-foreground">Načítám…</div>
        </div>
      </div>
    );
  if (!session) return <AuthScreen />;
  if (st.error) return <div className="grid min-h-screen place-items-center text-destructive">{(st.error as Error).message}</div>;
  if (!onboarded) return <Onboarding />;
  const state = st.data as GameState;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {children(state, guild.data)}
      <TopBar state={state} guild={guild.data} />
      <nav className="panel absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1 p-1">
        {[{ to: "/" as const, label: "Mapa", Icon: MapIcon }, { to: "/guilda" as const, label: "Guilda", Icon: Users }].map(({ to, label, Icon }) => (
          <Link key={to} to={to} className="flex w-24 flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "bg-accent text-primary" }} activeOptions={{ exact: true }}>
            <Icon className="size-5" /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
