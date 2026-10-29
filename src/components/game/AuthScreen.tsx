import { useState } from "react";
import { Mountain } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import heroUrl from "@/assets/trekra-hero.jpg";

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = mode === "up"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message === "Invalid login credentials" ? "Neplatný e-mail nebo heslo" : error.message);
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Přihlášení přes Google selhalo");
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden p-4">
      <img src={heroUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
      <div className="panel relative w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-3">
          <Mountain className="size-8 text-primary" />
          <div><h1 className="text-2xl font-semibold">summ-it</h1><p className="text-sm text-muted-foreground">Choď, stav, objevuj.</p></div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="em">E-mail</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="pw">Heslo</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{mode === "up" ? "Vytvořit účet" : "Přihlásit se"}</Button>
        </form>
        <Button variant="secondary" className="mt-2 w-full" onClick={google}>Pokračovat přes Google</Button>
        <button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "up" ? "in" : "up")}>
          {mode === "up" ? "Už máte účet? Přihlaste se" : "Nemáte účet? Zaregistrujte se"}
        </button>
      </div>
    </div>
  );
}
