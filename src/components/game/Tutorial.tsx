import { useEffect, useState } from "react";
import { Footprints, Home, Factory, Mountain, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const STEPS = [
  { Icon: Footprints, cls: "text-primary", title: "Kroky jsou platidlo", text: "Každý nachozený krok = 1 bod. Šedé „Dnes“ ukazuje dnešní kroky, modré „Dostupné“ je tvoje peněženka – kroky nepropadají." },
  { Icon: Home, cls: "text-res-blue", title: "Tvé domovské sídlo", text: "Na mapě klepni na své sídlo (obrys v tvé barvě). Uvidíš budovy, zásoby a možnosti vylepšení." },
  { Icon: Factory, cls: "text-res-green", title: "Výroba a sklad", text: "Za kroky stav výrobny 4 surovin (modrá, zelená, žlutá, červená). Vyrábí samy i offline – sklad hlídá, kolik se vejde." },
  { Icon: Mountain, cls: "text-res-red", title: "Expedice a lokality", text: "Naplň expedici zásobami přímo ve svém sídle a vyraž na vrcholy, rozhledny či zříceniny. Lokalitu zabereš, když u ní reálně stojíš." },
  { Icon: Users, cls: "text-res-yellow", title: "Guilda", text: "V sekci Guilda se spoj s přáteli. Posílejte si suroviny přes tržiště a společně ovládněte region." },
];

const key = (u: string) => `summit-tutorial-seen:${u}`;

export function Tutorial({ user, open, onOpenChange }: { user: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (!localStorage.getItem(key(user))) onOpenChange(true); }, [user, onOpenChange]);
  const close = (o: boolean) => { onOpenChange(o); if (!o) { localStorage.setItem(key(user), "1"); setI(0); } };
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jak hrát summ-it</DialogTitle>
          <DialogDescription>Krok {i + 1} z {STEPS.length}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-muted"><s.Icon className={`size-8 ${s.cls}`} /></div>
          <div className="font-semibold">{s.title}</div>
          <p className="text-sm text-muted-foreground">{s.text}</p>
          <div className="flex gap-1.5">{STEPS.map((_, j) => <span key={j} className={`size-2 rounded-full ${j === i ? "bg-primary" : "bg-muted"}`} />)}</div>
        </div>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft /> Zpět</Button>
          {last ? <Button onClick={() => close(false)}>Začít hrát</Button> : <Button onClick={() => setI(i + 1)}>Další <ChevronRight /></Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
