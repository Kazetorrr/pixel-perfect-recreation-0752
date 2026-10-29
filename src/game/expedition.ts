import type { City, GameConfig, Inv } from './api';
import { haversineKm, RESOURCES } from './config';

export type GpsFix = { lat: number; lng: number; accuracy: number };
export function expeditionPresence(cfg: GameConfig, city: City, fix: GpsFix) {
  const valid = Number.isFinite(fix.lat) && Number.isFinite(fix.lng) && Math.abs(fix.lat) <= 90 && Math.abs(fix.lng) <= 180 && Number.isFinite(fix.accuracy) && fix.accuracy >= 0 && fix.accuracy <= cfg.gps_max_accuracy_m;
  return { valid, distance: valid ? haversineKm(fix, city) : Infinity, eligible: valid && haversineKm(fix, city) <= cfg.home_radius_km[city.tier] };
}
export function expeditionLoadError(inventory: Inv, expedition: Inv, amounts: Inv, capacity: number) {
  const total = RESOURCES.reduce((n, r) => n + (amounts[r] ?? 0), 0);
  if (RESOURCES.some(r => !Number.isInteger(amounts[r] ?? 0) || (amounts[r] ?? 0) < 0)) return 'Zadejte celá nezáporná množství.';
  if (total <= 0) return 'Vyberte zásoby k naložení.';
  if (RESOURCES.some(r => (amounts[r] ?? 0) > (inventory[r] ?? 0))) return 'Ve skladu není dost zásob.';
  if (total + RESOURCES.reduce((n, r) => n + (expedition[r] ?? 0), 0) > capacity) return 'V expedici není dost místa.';
  return null;
}