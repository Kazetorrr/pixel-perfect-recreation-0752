import { useState } from 'react';
import { ArrowUp, Building2, Check, Hammer, Lock, Package, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RESOURCES, RESOURCE_META, fmt, type Resource } from '@/game/config';
import { useAction, type City, type GameState, type PlayerCity } from '@/game/api';
import { warehouseCapacity } from '@/game/economy';
import { cn } from '@/lib/utils';
import { MissingSteps, StepAmount } from './ui';

type Kind = Resource | 'warehouse' | 'market';
type Node = { kind: Kind; level: number; x: number; y: number };
const tones: Record<Kind, string> = { blue: 'text-res-blue', green: 'text-res-green', yellow: 'text-res-yellow', red: 'text-res-red', warehouse: 'text-foreground', market: 'text-foreground' };
const labels = { ...Object.fromEntries(RESOURCES.map(r => [r, RESOURCE_META[r].label])), warehouse: 'Sklad', market: 'Tržiště' } as Record<Kind, string>;
const rotate = (x: number, y: number, turns: number): [number, number] => turns === 0 ? [x,y] : rotate(100-y,x,turns-1);
const productionNodes: Node[] = RESOURCES.flatMap((kind, turn) => Array.from({ length: 6 }, (_, i) => {
  const [x,y] = rotate(i % 2 ? 56 : 44, 34-i*5.2, turn);
  return { kind, level:i+1,x,y };
}));
const nodes: Node[] = [...productionNodes, ...[[36,39],[29,32],[22,25],[15,18],[8,11]].map(([x=0,y=0],i) => ({kind:'warehouse' as const,level:i+1,x,y})), ...[[64,63],[74,73],[84,83]].map(([x=0,y=0],i) => ({kind:'market' as const,level:i+1,x,y}))];

export function UpgradeTree({ city, state, pc }: { city: City; state: GameState; pc: PlayerCity }) {
  const [selected, setSelected] = useState<Node>(productionNodes[0] ?? {kind:'blue',level:1,x:44,y:34});
  const cfg = state.config;
  const current = (kind: Kind) => kind === 'warehouse' ? pc.warehouse_level : kind === 'market' ? pc.market_level : pc.buildings[kind] ?? 0;
  const build = useAction<{p_city:string;p_resource:Resource}>('build_or_upgrade','Výrobna vylepšena');
  const facility = useAction<{p_city:string;p_kind:string}>('upgrade_facility','Budova vylepšena');
  const level = current(selected.kind);
  const maximum = selected.kind === 'warehouse' ? cfg.warehouse_max_level : selected.kind === 'market' ? cfg.market_max_level : cfg.max_level;
  const next = level + 1;
  const cost = (selected.kind === 'warehouse' ? cfg.warehouse_upgrade_cost : selected.kind === 'market' ? cfg.market_upgrade_cost : cfg.upgrade_cost)[next] ?? 0;
  const production = (kind: Resource, l: number) => (cfg.prod_per_level[l] ?? 0) * Number(city[`eff_${kind}`]) * (1+(cfg.tier_bonus[city.tier]?.production ?? 0));
  const benefit = (l: number) => selected.kind === 'warehouse' ? `${fmt(warehouseCapacity(cfg,l,city.tier === 'town'))} jednotek skladu` : selected.kind === 'market' ? `${fmt(Math.floor((cfg.market_capacity[l] ?? 0)*(1+(cfg.tier_bonus[city.tier]?.logistics ?? 0))))} zásob/den · sleva ${Math.round((cfg.market_discount[l] ?? 0)*100)} %` : `${fmt(production(selected.kind,l))} zásob/den`;
  return <div className="space-y-3">
    <div className="tech-tree relative mx-auto aspect-square w-full max-w-[400px]" aria-label="Strom vylepšení města">
      <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="43" fill="none" className="stroke-border" strokeWidth=".3" strokeDasharray="1 2" />
        {([...RESOURCES,'warehouse','market'] as Kind[]).map(kind => <polyline key={kind} points={`50,50 ${nodes.filter(n=>n.kind===kind).map(n=>`${n.x},${n.y}`).join(' ')}`} fill="none" className={tones[kind]} stroke="currentColor" strokeWidth=".5" opacity=".5" />)}
      </svg>
      <div className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-panel-2"><Building2 className="size-5 text-muted-foreground" /></div>
      {nodes.map(node => {
        const bought = node.level <= current(node.kind), available = node.level === current(node.kind)+1;
        const active = selected.kind === node.kind && selected.level === node.level;
        return <Button key={`${node.kind}-${node.level}`} size="icon" variant="outline" title={`${labels[node.kind]} · úroveň ${node.level} · ${bought?'Zakoupeno':available?'Dostupné':'Uzamčeno'}`} aria-label={`${labels[node.kind]} úroveň ${node.level}`} aria-pressed={active} onClick={()=>setSelected(node)}
          style={{left:`${node.x}%`,top:`${node.y}%`}} className={cn('tech-node absolute z-10 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border p-0 text-[11px] tabular-nums',tones[node.kind], bought ? 'border-current bg-panel-2' : available ? 'border-current bg-background' : 'border-border bg-background text-muted-foreground',active && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}>
          {node.kind === 'warehouse' ? <Package className="size-3"/> : node.kind === 'market' ? <Store className="size-3"/> : node.level}
          {bought && <Check className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-background"/>}
        </Button>;
      })}
    </div>
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><Check className="size-3"/> Zakoupeno</span><span className="flex items-center gap-1"><ArrowUp className="size-3"/> Dostupné</span><span className="flex items-center gap-1"><Lock className="size-3"/> Uzamčeno</span></div>
    <div className="border-t pt-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2"><h3 className={cn('text-sm font-semibold',tones[selected.kind])}>{labels[selected.kind]}</h3><span className="text-xs text-muted-foreground">Úroveň {level}/{maximum}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">Aktuálně: {benefit(level)}</p>
      <p className="mt-1 text-xs">Vybraný uzel {selected.level}: {benefit(selected.level)} · {selected.level <= level ? 'Zakoupeno' : selected.level === next ? 'Dostupné' : 'Uzamčeno'}</p>
      {level < maximum ? <>
        <p className="mt-2 text-xs text-muted-foreground">Další úroveň {next}: {benefit(next)}</p>
        {selected.level > next && <p className="mt-1 text-xs text-muted-foreground">Nejprve pořiďte úroveň {next}.</p>}
        <MissingSteps cost={cost} balance={state.profile.wallet_steps}/>
        <Button className="mt-3 w-full" disabled={build.isPending || facility.isPending || state.profile.wallet_steps < cost || selected.level !== next} onClick={()=>{
          if(selected.kind === 'warehouse' || selected.kind === 'market') facility.mutate({p_city:city.id,p_kind:selected.kind});
          else build.mutate({p_city:city.id,p_resource:selected.kind});
        }}>{level ? <ArrowUp/> : <Hammer/>}{level ? 'Vylepšit' : 'Postavit'} <StepAmount value={cost}/></Button>
      </> : <p className="mt-3 text-sm text-res-green">Maximální úroveň dosažena</p>}
    </div>
  </div>;
}