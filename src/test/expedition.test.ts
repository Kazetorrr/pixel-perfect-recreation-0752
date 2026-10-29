import { describe, expect, it } from 'vitest';
import fixture from './fixtures/economy-config.json';
import type { City, GameConfig } from '@/game/api';
import { expeditionLoadError, expeditionPresence } from '@/game/expedition';
const cfg = fixture as GameConfig;
const city = {lat:49,lng:17,tier:'village'} as City;
describe('Expedition supply rules',()=>{
  it('requires physical GPS near the city regardless of virtual travel',()=>expect(expeditionPresence(cfg,city,{lat:50,lng:17,accuracy:10}).eligible).toBe(false));
  it('uses existing village 3, town 5, regional 10 km radii',()=>{
    const fix={lat:49.036,lng:17,accuracy:10};
    expect(['village','town','regional'].map(tier=>expeditionPresence(cfg,{...city,tier} as City,fix).eligible)).toEqual([false,true,true]);
  });
  it('rejects GPS accuracy above the configured 100 metres',()=>expect(expeditionPresence(cfg,city,{lat:49,lng:17,accuracy:101}).eligible).toBe(false));
  it('allows own available supplies up to capacity without a marketplace input',()=>expect(expeditionLoadError({blue:18},{green:82},{blue:18},100)).toBeNull());
  it('rejects expedition loads exceeding shared capacity',()=>expect(expeditionLoadError({blue:18},{green:83},{blue:18},100)).not.toBeNull());
  it('rejects unavailable warehouse quantities',()=>expect(expeditionLoadError({blue:17},{},{blue:18},100)).not.toBeNull());
  it('rejects fractional resource amounts',()=>expect(expeditionLoadError({blue:18},{},{blue:1.5},100)).not.toBeNull());
});