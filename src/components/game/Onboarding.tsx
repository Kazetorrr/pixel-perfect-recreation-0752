import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { RESOURCES, RESOURCE_META } from "@/game/config";
import { useCities, useGameState } from "@/game/api";
import { DEFAULT_PLAYER_COLOR, TIER_META } from "@/game/config";
import { ArrowLeft, FlaskConical } from "lucide-react";

export function Onboarding() {
  const cities = useCities();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("zlin");
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState(DEFAULT_PLAYER_COLOR);
  const gs = useGameState(true);
  const palette = ((gs.data as { config?: { player_colors?: string[] } } | undefined)?.config?.player_colors ?? [DEFAULT_PLAYER_COLOR]) as string[];
  const testingEnabled = (gs.data as { config?: { dev_mode?: boolean } } | undefined)?.config?.dev_mode === true;
  const sel = cities.data?.find((c) => c.id === city);
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const all = cities.data ?? [];
    const n = q.trim().toLocaleLowerCase("cs");
    const rank = { regional: 0, town: 1, village: 2 } as const;
    const list = n ? all.filter((c) => c.name.toLocaleLowerCase("cs").includes(n)) : all.filter((c) => c.tier !== "village");
    return [...list].sort((a, b) => rank[a.tier] - rank[b.tier] || a.name.localeCompare(b.name, "cs")).slice(0, 150);
  }, [cities.data, q]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const testOnly = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-test-onboarding') === 'true';
    if (testOnly && !testingEnabled) return;
    setBusy(true);
    let position: GeolocationPosition | undefined;
    if (!testOnly) {
    try {
      position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }));
    } catch {
      setBusy(false); toast.error("Pro ověření domovského sídla povolte přístup k poloze."); return;
    }
    }
    const result = testOnly
      ? await supabase.rpc("complete_onboarding_test", { p_username: name, p_city: city, p_color: color })
      : position
        ? await supabase.rpc("complete_onboarding_verified", { p_username: name, p_city: city, p_color: color, p_lat: position.coords.latitude, p_lng: position.coords.longitude, p_accuracy: position.coords.accuracy })
        : { error: { message: "Poloha není dostupná." } };
    const { error } = result;
    if (error) { setBusy(false); toast.error(error.message); return; }
    toast.success("Vítejte v summ-it!");
    await qc.invalidateQueries();
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6">
        <div><h1 className="text-2xl font-semibold">Vítej, Cestovateli !</h1><p className="text-sm text-muted-foreground">Zvolte jméno a domovské město.</p></div>
        <div className="space-y-1"><Label htmlFor="un">Uživatelské jméno</Label><Input id="un" required minLength={3} maxLength={20} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>Domovské město</Label>
          <Input placeholder="Hledat obec…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[...(sel && !shown.includes(sel) ? [sel] : []), ...shown].map((c) => <SelectItem key={c.id} value={c.id}>{c.name} · {TIER_META[c.tier]?.label}</SelectItem>)}</SelectContent>
          </Select>
          {sel && (
            <div className="flex gap-3 pt-1 text-xs text-muted-foreground">
              {RESOURCES.map((r) => <span key={r} className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: RESOURCE_META[r].color }} />{Math.round(Number(sel[`eff_${r}` as const]) * 100)} %</span>)}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Barva hráče</Label>
          <div className="grid grid-cols-8 gap-2">
            {palette.map((c) => (
              <button key={c} type="button" aria-label={`Barva ${c}`} onClick={() => setColor(c)}
                className="size-7 rounded-full border-2 transition-transform"
                style={{ background: c, borderColor: color === c ? "var(--foreground)" : "transparent", transform: color === c ? "scale(1.15)" : undefined, boxShadow: color === c ? `0 0 10px ${c}` : undefined }} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Barvou se na mapě označují vaše sídla. V guildě musí mít každý člen jinou barvu.</p>
        </div>
        <p className="text-xs text-muted-foreground">Domov je trvalý a ověřuje se polohou. Začínáte bez budov se 70 zásobami ve skladu o kapacitě 110.</p>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Ověřuji polohu…" : "Ověřit domov a začít"}</Button>
        {testingEnabled && <Button type="submit" data-test-onboarding="true" variant="secondary" className="w-full" disabled={busy}><FlaskConical/>Založit testovací profil bez GPS</Button>}
        <Button type="button" variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}><ArrowLeft/>Zpět na přihlášení</Button>
      </form>
    </div>
  );
}
