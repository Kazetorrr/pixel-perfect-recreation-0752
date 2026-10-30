import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import heroUrl from "@/assets/trekra-hero.jpg";
import { useEffect as useEff } from "react";
import { isNativeApp } from "@/lib/health-connect";
import { APK_URL } from "@/game/config";
import { authErrorMessage } from "@/game/auth-messages";
import { MailCheck } from "lucide-react";
import logoTop from "@/assets/summit-logo-topbar.png";

export function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [android, setAndroid] = useState(false);
  useEff(() => { setAndroid(!!APK_URL && /android/i.test(navigator.userAgent) && !isNativeApp()); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = mode === "up"
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(authErrorMessage(error.message)); return; }
    // With email confirmation on, signUp returns no session: the player must click the link first.
    if (mode === "up" && !data.session) setSentTo(email.trim().toLowerCase());
    else if (mode === "up") toast.success("Účet vytvořen. Vítejte ve hře!");
  };

  const resend = async () => {
    if (!sentTo) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: sentTo, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) toast.error(authErrorMessage(error.message));
    else toast.success(`Potvrzovací e-mail jsme poslali znovu na ${sentTo}.`);
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
        <div className="mb-6">
          <h1><img src={logoTop} alt="summ-it beta" className="h-12 w-auto" /></h1>
          <p className="mt-2 text-sm text-muted-foreground">Choď, stav, objevuj.</p>
        </div>

        {sentTo ? (
          <div className="space-y-4">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="size-6" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold">Ověřte svůj e-mail</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Na adresu <span className="font-medium text-foreground">{sentTo}</span> jsme poslali potvrzovací odkaz.
                Klikněte v něm na ověření a pak se přihlaste.
              </p>
            </div>
            <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
              Nedorazil? Zkontrolujte složku Spam nebo Hromadné, případně si nechte e-mail poslat znovu.
            </p>
            <Button className="w-full" onClick={resend} disabled={busy}>Poslat ověřovací e-mail znovu</Button>
            <Button variant="ghost" className="w-full" onClick={() => { setSentTo(null); setMode("in"); }}>Zpět na přihlášení</Button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1"><Label htmlFor="em">E-mail</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="pw">Heslo</Label><Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={busy}>{mode === "up" ? "Vytvořit účet" : "Přihlásit se"}</Button>
              {mode === "up" && (
                <p className="text-center text-xs text-muted-foreground">
                  Po vytvoření účtu si otevřete potvrzovací e-mail — bez něj se nepřihlásíte.
                </p>
              )}
            </form>
            {false && <Button variant="secondary" className="mt-2 w-full" onClick={google}>Pokračovat přes Google</Button>}
            <button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "up" ? "in" : "up")}>
              {mode === "up" ? "Už máte účet? Přihlaste se" : "Nemáte účet? Zaregistrujte se"}
            </button>
          </>
        )}

        {android && (
          <a href={APK_URL} className="mt-2 block w-full rounded-md border border-primary/50 px-4 py-2 text-center text-sm font-medium text-primary hover:bg-primary/10">
            Stáhnout aplikaci pro Android (kroky z Health Connect)
          </a>
        )}
      </div>
    </div>
  );
}
