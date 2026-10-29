import type { GameConfig } from './api';

export const travelPrice = (cfg: GameConfig, km: number) => Math.ceil(cfg.travel_base + cfg.travel_per_km * km);
export const foundingPrice = (cfg: GameConfig, n: number) => n <= 1 ? 0 : n === 2 ? cfg.founding_second : cfg.founding_factor * n * (n - 1);
export const shipmentPrice = (cfg: GameConfig, km: number, qty: number, level: number, sameCity = false) => sameCity ? 0 : Math.ceil((cfg.shipment_base + cfg.shipment_per_km * km + cfg.shipment_per_unit * qty) * (1 - (cfg.market_discount[Math.min(level, cfg.market_max_level)] ?? 0)));
export const warehouseCapacity = (cfg: GameConfig, level: number, town = false) => {
  const base = cfg.warehouse_capacity[0] ?? 0;
  return Math.floor(base + ((cfg.warehouse_capacity[Math.min(level, cfg.warehouse_max_level)] ?? base) - base) * (1 + (town ? cfg.tier_bonus.town.warehouse ?? 0 : 0)));
};