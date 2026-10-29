import { describe, expect, it } from 'vitest';
import fixture from './fixtures/economy-config.json';
import type { GameConfig } from '@/game/api';
import { travelPrice, foundingPrice, shipmentPrice, warehouseCapacity } from '@/game/economy';
const cfg = fixture as GameConfig;
describe('Authoritative economy previews', () => {
 it('prices geographical travel at 200 plus 400 per km', () => expect([2,10,30,100].map(km=>travelPrice(cfg,km))).toEqual([1000,4200,12200,40200]));
 it('prices founding progressively without a fixed post-eighth cost', () => expect([1,2,3,4,5,6,7,8,9].map(n=>foundingPrice(cfg,n))).toEqual([0,12000,30000,60000,100000,150000,210000,280000,360000]));
 it('applies transport discounts to total and rounds upward', () => expect([1,2,3].map(l=>shipmentPrice(cfg,100,40,l))).toEqual([770,616,501]));
 it('makes same-settlement shipment geographically free',()=>expect(shipmentPrice(cfg,0,40,1,true)).toBe(0));
 it('uses six total daily production rates and incremental prices',()=>{expect(cfg.prod_per_level).toEqual([0,3,5,8,11,15,20]);expect(cfg.upgrade_cost).toEqual([0,1500,4000,8000,15000,27000,45000]);expect(cfg.upgrade_cost.reduce((a,b)=>a+b,0)).toBe(100500)});
 it('uses the eight-percent village specialization',()=>expect(20*1.10*(1+(cfg.tier_bonus.village.production??0))).toBeCloseTo(23.76));
 it('keeps base storage 110 and five upgrades to 600',()=>{expect([0,1,2,3,4,5].map(l=>warehouseCapacity(cfg,l))).toEqual([110,175,250,340,460,600]);expect(cfg.warehouse_upgrade_cost.reduce((a,b)=>a+b,0)).toBe(101000)});
 it('applies town bonus only to gained storage and floors units',()=>{expect(warehouseCapacity(cfg,0,true)).toBe(110);expect(warehouseCapacity(cfg,5,true)).toBe(673)});
 it('has shared marketplace capacities with regional bonus',()=>{expect(cfg.market_capacity).toEqual([0,50,120,250]);expect(cfg.market_capacity.slice(1).map(x=>Math.floor(x*(1+(cfg.tier_bonus.regional.logistics??0))))).toEqual([60,144,300])});
});
