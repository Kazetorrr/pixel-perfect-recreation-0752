import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, RefreshCw, Smartphone, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isNativeApp, syncHealthSteps } from "@/lib/health-connect";
import { APK_URL } from "@/game/config";

type Step = "platform" | "device" | "brand" | "phone" | Brand;
type Brand = "xiaomi" | "samsung" | "garmin" | "google" | "other";

const BRANDS: { id: Brand; label: string }[] = [
  { id: "xiaomi", label: "Xiaomi / Mi Band (Mi Fitness)" },
  { id: "samsung", label: "Samsung Galaxy Watch (Samsung Health)" },
  { id: "garmin", label: "Garmin (Garmin Connect)" },
  { id: "google", label: "Pixel Watch / Fitbit" },
  { id: "other", label: "Jiná značka" },
];

const GUIDES: Record<Brand | "phone", { title: string; steps: string[] }> = {
  xiaomi: { title: "Xiaomi – Mi Fitness", steps: [
    "Otevřete Mi Fitness → Profil → Propojené aplikace (nebo Služby třetích stran).",
    "Zapněte Health Connect a povolte zápis Kroků.",
    "Na hlavní obrazovce Mi Fitness stáhněte prstem dolů, aby se načetla data z náramku.",
    "V Health Connect → Data a přístup → Kroky by se měl objevit zdroj Mi Fitness.",
  ] },
  samsung: { title: "Samsung Health", steps: [
    "Otevřete Samsung Health → ⋮ → Nastavení → Health Connect.",
    "Povolte Samsung Health zápis Kroků.",
    "Otevřete Samsung Health, aby se synchronizovaly hodinky.",
  ] },
  garmin: { title: "Garmin Connect", steps: [
    "Otevřete Garmin Connect → Více → Nastavení → Připojené aplikace → Health Connect.",
    "Zapněte sdílení a povolte Kroky.",
    "Synchronizujte hodinky v Garmin Connect.",
  ] },
  google: { title: "Pixel Watch / Fitbit", steps: [
    "Otevřete aplikaci Fitbit → Profil → Nastavení aplikace → Health Connect.",
    "Zapněte synchronizaci a povolte Kroky.",
  ] },
  other: { title: "Jiné hodinky", steps: [
    "V aplikaci výrobce hodinek hledejte v nastavení položku Health Connect (někdy Propojené aplikace).",
    "Povolte zápis Kroků do Health Connect.",
    "Pokud aplikace Health Connect nepodporuje, použijte krokoměr telefonu.",
  ] },
  phone: { title: "Krokoměr v telefonu", steps: [
    "Nainstalujte nebo otevřete aplikaci Google Fit (na Samsungu stačí Samsung Health).",
    "Povolte jí oprávnění Fyzická aktivita, aby počítala kroky ze senzoru telefonu.",
    "V jejím nastavení zapněte Health Connect a povolte zápis Kroků.",
    "Noste telefon u sebe – kroky s odloženým telefonem se nepočítají.",
  ] },
};

export function StepGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<Step>("platform");
  const [history, setHistory] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const go = (s: Step) => { setHistory((h) => [...h, step]); setStep(s); };
  const back = () => { setStep(history[history.length - 1] ?? "platform"); setHistory((h) => h.slice(0, -1)); };
  const close = (o: boolean) => { onOpenChange(o); if (!o) { setStep("platform"); setHistory([]); } };

  const verify = async () => {
    if (!isNativeApp()) { toast.error("Kroky se načítají jen v aplikaci summ-it pro Android."); return; }
    setBusy(true);
    try {
      const n = await syncHealthSteps();
      await qc.invalidateQueries({ queryKey: ["state"] });
      n > 0 ? toast.success(`Hotovo, připsáno ${n} kroků`) : toast.info("Zatím žádné nové kroky. Zkontrolujte nastavení a zkuste to za chvíli.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const guide = step in GUIDES ? GUIDES[step as keyof typeof GUIDES] : null;
  const choice = (label: string, onClick: () => void, Icon?: typeof Watch, disabled?: boolean, note?: string) => (
    <Button variant="secondary" className="h-auto w-full justify-start py-3 text-left" disabled={disabled} onClick={onClick}>
      {Icon && <Icon />}<span className="flex flex-col"><span>{label}</span>{note && <span className="text-xs font-normal text-muted-foreground">{note}</span>}</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Jak zapojit počítání kroků</DialogTitle>
          <DialogDescription>Kroky bere summ-it z Health Connect. Ten je jen schránka – kroky do něj musí posílat hodinky nebo telefon.</DialogDescription>
        </DialogHeader>
        {history.length > 0 && <Button variant="ghost" size="sm" className="w-fit" onClick={back}><ChevronLeft /> Zpět</Button>}
        <div className="space-y-2">
          {step === "platform" && (<>
            <p className="text-sm font-semibold">Jaký máte telefon?</p>
            {choice("Android", () => go("device"), Smartphone)}
            {choice("iPhone", () => {}, Smartphone, true, "Zatím nepodporujeme – připravujeme")}
          </>)}
          {step === "device" && (<>
            {!isNativeApp() && <p className="rounded-lg bg-muted p-2 text-xs">Kroky se načítají jen v nainstalované aplikaci, ne v prohlížeči.{APK_URL && <> <a className="underline" href={APK_URL}>Stáhnout aplikaci</a></>}</p>}
            <p className="text-sm font-semibold">Máte chytré hodinky nebo náramek?</p>
            {choice("Ano, mám hodinky / náramek", () => go("brand"), Watch)}
            {choice("Ne, jen telefon", () => go("phone"), Smartphone)}
          </>)}
          {step === "brand" && (<>
            <p className="text-sm font-semibold">Jaké značky?</p>
            {BRANDS.map((b) => <div key={b.id}>{choice(b.label, () => go(b.id))}</div>)}
          </>)}
          {guide && (<>
            <p className="text-sm font-semibold">{guide.title}</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <p className="text-xs text-muted-foreground">Nakonec v Nastavení → Health Connect → Oprávnění aplikací → summ-it zkontrolujte, že je povoleno čtení Kroků.</p>
            <Button className="w-full" disabled={busy} onClick={verify}><RefreshCw className={busy ? "animate-spin" : ""} /> Ověřit a synchronizovat kroky</Button>
          </>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}
