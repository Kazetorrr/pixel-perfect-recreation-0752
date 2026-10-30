import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCities, useGameState, type City } from "@/game/api";
import { DEFAULT_PLAYER_COLOR, TIER_META, haversineKm, type Tier } from "@/game/config";
import { ArrowLeft, FlaskConical, LocateFixed, MapPin, RefreshCw } from "lucide-react";
import { ensureLocationPermission } from "@/lib/native-location";

type Fix = { lat: number; lng: number; accuracy: number };
const DEFAULT_RADIUS: Record<Tier, number> = { village: 3, town: 5, regional: 10 };

export function Onboarding() {
  const cities = useCities();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [color, setColor] = useState(DEFAULT_PLAYER_COLOR);
  const [fix, setFix] = useState<Fix | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const gs = useGameState(true);
  const cfg = (gs.data as { config?: { player_colors?: string[]; dev_mode?: boolean; home_radius_km?: Record<Tier, number> } } | undefined)?.config;
  const palette = cfg?.player_colors ?? [DEFAULT_PLAYER_COLOR];
  const testingEnabled = cfg?.dev_mode === true;
  const radius = cfg?.home_radius_km ?? DEFAULT_RADIUS;


  const nearby = useMemo(() => {
    if (!fix) return [] as (City & { km: number })[];
    return (cities.data ?? [])
      .map((c) => ({ ...c, km: haversineKm(fix, c) }))
      .filter((c) => c.km <= (radius[c.tier] ?? 3))
      .sort((a, b) => a.km - b.km)
      .slice(0, 20);
  }, [fix, cities.data, radius]);
  const sel = nearby.find((c) => c.id === city) ?? null;

  const locate = async () => {
    setLocating(true);
    try { await ensureLocationPermission(); }
    catch (e) { toast.error((e as Error).message); setLocating(false); return; }
    try {
      // Watch up to 20 s and keep the most accurate fix (first fixes are often network-based ±2 km).
      const p = await new Promise<GeolocationPosition>((resolve, reject) => {
        let best: GeolocationPosition | null = null;
        const done = () => { navigator.geolocation.clearWatch(id); clearTimeout(t); best ? resolve(best) : reject(new Error("no fix")); };
        const id = navigator.geolocation.watchPosition((pos) => {
          if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
          if (pos.coords.accuracy <= 50) done();
        }, (e) => { if (!best) { navigator.geolocation.clearWatch(id); clearTimeout(t); reject(e); } }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        const t = setTimeout(done, 20000);
      });
      const f = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
      setFix(f); setShowOthers(false);
      const best = (cities.data ?? []).map((c) => ({ c, km: haversineKm(f, c) })).filter((x) => x.km <= (radius[x.c.tier] ?? 3)).sort((a, b) => a.km - b.km)[0];
      setCity(best?.c.id ?? null);
      if (!best) toast.error("Ve vašem okolí jsme nenašli žádné sídlo.");
    } catch {
      toast.error("Polohu se nepodařilo získat. Povolte přístup k přesné poloze.");
    } finally { setLocating(false); }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const testOnly = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-test-onboarding') === 'true';
    if (testOnly && !testingEnabled) return;
    if (!testOnly && (!fix || !city)) return;
    setBusy(true);
    const { error } = testOnly
      ? await supabase.rpc("complete_onboarding_test", { p_username: name, p_city: city ?? "zlin", p_color: color })
      : await supabase.rpc("complete_onboarding_verified", { p_username: name, p_city: city!, p_color: color, p_lat: fix!.lat, p_lng: fix!.lng, p_accuracy: fix!.accuracy });
    if (error) { setBusy(false); toast.error(error.message); return; }
    toast.success("Vítejte v summ-it!");
    await qc.invalidateQueries();
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6">
        <div><h1 className="text-2xl font-semibold">Vítej, Cestovateli !</h1><p className="text-sm text-muted-foreground">Zvolte jméno a barvu. Domov založíme podle vaší polohy.</p></div>
        <div className="space-y-1"><Label htmlFor="un">Uživatelské jméno</Label><Input id="un" required minLength={3} maxLength={20} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Barva hráče</Label>
          <div className="grid grid-cols-8 gap-2">
            {palette.map((c) => (
              <button key={c} type="button" aria-label={`Barva ${c}`} onClick={() => setColor(c)}
                className="size-7 rounded-full border-2 transition-transform"
                style={{ background: c, borderColor: color === c ? "var(--foreground)" : "transparent", transform: color === c ? "scale(1.15)" : undefined, boxShadow: color === c ? `0 0 10px ${c}` : undefined }} />
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border bg-card/60 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4" />Domovské sídlo podle vaší polohy</div>
          {!fix ? (
            <Button type="button" variant="outline" className="w-full" onClick={locate} disabled={locating}><LocateFixed />{locating ? "Zaměřuji…" : "Zaměřit moji polohu"}</Button>
          ) : (
            <>
              {sel ? (
                <div><div className="text-lg font-semibold">{sel.name}</div><div className="text-xs text-muted-foreground">{TIER_META[sel.tier].label} · {sel.km.toFixed(1)} km od vás · přesnost ±{Math.round(fix.accuracy)} m</div>
                  </div>
              ) : <p className="text-sm text-destructive">V okolí jsme nenašli žádné sídlo.</p>}
              {nearby.length > 1 && (
                <button type="button" className="text-xs text-primary underline" onClick={() => setShowOthers((v) => !v)}>Netrefili jsme se? Zde jsou ostatní města a vesnice ve tvém okolí.</button>
              )}
              {showOthers && (
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {nearby.map((c) => (
                    <button key={c.id} type="button" onClick={() => setCity(c.id)}
                      className={`flex w-full justify-between rounded-md border px-2 py-1.5 text-left text-sm ${c.id === city ? "border-primary bg-primary/10" : ""}`}>
                      <span>{c.name} <span className="text-xs text-muted-foreground">· {TIER_META[c.tier].label}</span></span>
                      <span className="text-xs text-muted-foreground">{c.km.toFixed(1)} km</span>
                    </button>
                  ))}
                </div>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={locate} disabled={locating}><RefreshCw />{locating ? "Zaměřuji…" : "Zaměřit znovu"}</Button>
            </>
          )}
          <p className="text-xs text-muted-foreground">Ověření GPS polohy je jednorázová validace a je nutné pro správné a férové fungování hry. Domov je trvalý a nelze ho později změnit. V dotazu prohlížeče na polohu prosím povolte <b>přesnou</b> polohu, ne jen přibližnou.</p>
        </div>

        <p className="text-xs text-muted-foreground">Začínáte bez budov se 70 zásobami ve skladu o kapacitě 110.</p>
        <Button type="submit" className="w-full" disabled={busy || !fix || !city}>{busy ? "Zakládám…" : sel ? `Potvrdit ${sel.name} a začít` : "Potvrdit domov a začít"}</Button>
        {testingEnabled && <Button type="submit" data-test-onboarding="true" variant="secondary" className="w-full" disabled={busy}><FlaskConical/>Založit testovací profil bez GPS</Button>}
        <Button type="button" variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}><ArrowLeft/>Zpět na přihlášení</Button>
      </form>
    </div>
  );
}
