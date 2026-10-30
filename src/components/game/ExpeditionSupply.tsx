import { useState } from 'react';
import { CheckCircle2, FlaskConical, LocateFixed, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAction, type City, type GameState, type Inv, type PlayerCity } from '@/game/api';
import { RESOURCES, RESOURCE_META, fmt } from '@/game/config';
import { expeditionLoadError, expeditionPresence, type GpsFix } from '@/game/expedition';
import { ResCounters, ResDot } from './ui';

export function ExpeditionSupply({ city, pc, state }: { city: City; pc: PlayerCity; state: GameState }) {
  const [amounts, setAmounts] = useState<Inv>({});
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [testGps, setTestGps] = useState(false);
  const testAllowed = state.config.dev_mode && testGps;
  const testPrep = useAction<{p_city:string;p_amounts:Inv}>('prepare_expedition_test','Zásoby naloženy do expedice');
  const prep = useAction<{p_city:string;p_amounts:Inv;p_lat:number;p_lng:number;p_accuracy:number}>('prepare_expedition_gps','Zásoby naloženy do expedice');
  const loading = prep.isPending || testPrep.isPending;
  const carried = RESOURCES.reduce((n,r)=>n+(state.expedition[r] ?? 0),0);
  const total = RESOURCES.reduce((n,r)=>n+(amounts[r] ?? 0),0);
  const validation = expeditionLoadError(pc.inventory,state.expedition,amounts,state.config.expedition_capacity);
  const presence = fix ? expeditionPresence(state.config,city,fix) : null;
  const locate = async (load = false) => {
    if (!navigator.geolocation) { setGpsError('Prohlížeč nepodporuje určování polohy.'); return; }
    setTestGps(false); setLocating(true); setGpsError(null); setFix(null);
    try { await ensureLocationPermission(); }
    catch (e) { setLocating(false); setGpsError((e as Error).message); return; }
    navigator.geolocation.getCurrentPosition(position=>{
      setLocating(false);
      const fresh = {lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy};
      setFix(fresh);
      const checked = expeditionPresence(state.config,city,fresh);
      if (!checked.eligible) return;
      if (load && !validation) prep.mutate({p_city:city.id,p_amounts:amounts,p_lat:fresh.lat,p_lng:fresh.lng,p_accuracy:fresh.accuracy}, {onSuccess:()=>setAmounts({})});
    },error=>{
      setLocating(false); setGpsError(error.code === 1 ? 'Přístup k poloze byl zamítnut. Povolte polohu v prohlížeči.' : 'Polohu se nepodařilo zjistit. Zkuste to znovu.');
    },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  };
  return <section className="space-y-3 border-t pt-4">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><Package className="size-4"/>Expediční zásoby</h3>
    <div className="flex items-start gap-2 text-xs">
      {presence?.eligible ? <CheckCircle2 className="size-4 shrink-0 text-res-green"/> : <LocateFixed className="size-4 shrink-0 text-muted-foreground"/>}
      <div className="min-w-0 flex-1"><p className={presence?.eligible ? 'text-res-green' : 'text-muted-foreground'}>{locating ? 'Zjišťuji skutečnou polohu…' : gpsError ?? (presence ? !presence.valid ? 'GPS poloha je příliš nepřesná.' : presence.eligible ? `Jste v okolí sídla · ${presence.distance.toFixed(1)} km` : `Jste mimo okolí sídla · ${presence.distance.toFixed(1)} km` : 'GPS poloha zatím neověřena')}</p><p className="mt-1 text-muted-foreground">Okruh {state.config.home_radius_km[city.tier]} km · virtuální poloha se nezapočítává</p></div>
      <Button size="icon" variant="outline" aria-label="Ověřit polohu pro expedici" title="Ověřit GPS polohu" disabled={locating || loading} onClick={()=>locate()}><LocateFixed/></Button>
      {state.config.dev_mode && <Button size="icon" variant={testAllowed ? 'secondary' : 'outline'} aria-label="Testovat nakládání bez GPS" title="Testovat nakládání bez GPS" aria-pressed={testAllowed} disabled={locating || loading} onClick={()=>setTestGps(true)}><FlaskConical/></Button>}
    </div>
    <div className="flex justify-between text-xs text-muted-foreground"><span>V expedici</span><span className="tabular-nums">{fmt(carried)} / {fmt(state.config.expedition_capacity)}</span></div>
    <Progress value={100*carried/state.config.expedition_capacity} className="h-1.5"/>
    <ResCounters inv={state.expedition}/>
    <div className="grid grid-cols-[1fr_auto_5rem] items-center gap-x-2 gap-y-2 text-xs">
      <span className="text-muted-foreground">Zásoby</span><span className="text-right text-muted-foreground">Ve skladu</span><span className="text-right text-muted-foreground">Naložit</span>
      {RESOURCES.map(r=><div key={r} className="contents"><label htmlFor={`expedition-${r}`} className="flex items-center gap-2"><ResDot r={r}/>{RESOURCE_META[r].short}</label><span className="text-right tabular-nums">{fmt(pc.inventory[r] ?? 0)}</span><Input id={`expedition-${r}`} aria-label={`Naložit ${RESOURCE_META[r].short.toLowerCase()} zásoby`} type="number" inputMode="numeric" min={0} max={Math.min(pc.inventory[r] ?? 0,state.config.expedition_capacity-carried)} step={1} value={amounts[r] ?? 0} disabled={locating || loading} onChange={e=>setAmounts({...amounts,[r]:Number(e.target.value)})} className="h-8 min-w-0 text-right"/></div>)}
    </div>
    {total > 0 && validation && <p className="text-xs text-destructive">{validation}</p>}
    <Button className="w-full" disabled={!!validation || locating || loading || (!testAllowed && !presence?.eligible)} onClick={()=>testAllowed ? testPrep.mutate({p_city:city.id,p_amounts:amounts},{onSuccess:()=>setAmounts({})}) : locate(true)}><Package/>{loading ? 'Nakládám…' : locating ? 'Ověřuji GPS…' : `Naložit ${fmt(total)} zásob`}</Button>
  </section>;
}