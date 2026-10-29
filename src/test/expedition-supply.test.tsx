import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpeditionSupply } from '@/components/game/ExpeditionSupply';
import fixture from './fixtures/economy-config.json';
import type { City, GameState, PlayerCity } from '@/game/api';

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), gps: vi.fn() }));
vi.mock('@/game/api', () => ({ useAction: (fn: string) => ({ isPending: false, mutate: (args: unknown) => mocks.mutate(fn, args) }) }));
const city = { id: 'zlin', tier: 'regional', lat: 49.2, lng: 17.6 } as City;
const pc = { inventory: { blue: 10 } } as PlayerCity;
const state = (enabled: boolean) => ({ config: { ...fixture, dev_mode: enabled }, expedition: {} }) as GameState;

describe('Test expedition GPS bypass', () => {
  beforeEach(() => {
    mocks.mutate.mockReset(); mocks.gps.mockReset();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: mocks.gps } });
  });
  it('loads selected supplies without GPS only after explicit test activation', () => {
    const view = render(<ExpeditionSupply city={city} pc={pc} state={state(true)} />);
    fireEvent.change(view.getByLabelText('Naložit modré zásoby'), { target: { value: '1' } });
    fireEvent.click(view.getByRole('button', { name: 'Testovat nakládání bez GPS' }));
    fireEvent.click(view.getByRole('button', { name: 'Naložit 1 zásob' }));
    expect(mocks.mutate).toHaveBeenCalledWith('prepare_expedition_test', { p_city: 'zlin', p_amounts: { blue: 1 } });
    expect(mocks.gps).not.toHaveBeenCalled();
  });
  it('does not retain loading bypass when shared testing is switched off', () => {
    const view = render(<ExpeditionSupply city={city} pc={pc} state={state(true)} />);
    fireEvent.change(view.getByLabelText('Naložit modré zásoby'), { target: { value: '1' } });
    fireEvent.click(view.getByRole('button', { name: 'Testovat nakládání bez GPS' }));
    view.rerender(<ExpeditionSupply city={city} pc={pc} state={state(false)} />);
    fireEvent.click(view.getByRole('button', { name: 'Naložit 1 zásob' }));
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it('still rejects loading more supplies than are in the warehouse', () => {
    const view = render(<ExpeditionSupply city={city} pc={pc} state={state(true)} />);
    fireEvent.click(view.getByRole('button', { name: 'Testovat nakládání bez GPS' }));
    fireEvent.change(view.getByLabelText('Naložit modré zásoby'), { target: { value: '11' } });
    fireEvent.click(view.getByRole('button', { name: 'Naložit 11 zásob' }));
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});