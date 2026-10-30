import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Onboarding } from '@/components/game/Onboarding';

type Town = { id: string; name: string; tier: 'village' | 'town' | 'regional'; lat: number; lng: number };

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  invalidate: vi.fn(),
  testing: true,
  gps: vi.fn(),
  watch: vi.fn(),
  clearWatch: vi.fn(),
  cities: [] as Town[],
}));

vi.mock('@/game/api', () => ({
  useCities: () => ({ data: mocks.cities }),
  useGameState: () => ({
    data: { config: { dev_mode: mocks.testing, home_radius_km: { village: 3, town: 5, regional: 10 } } },
  }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const submitWith = (button: Element, form: Element) => {
  const event = new Event('submit', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'submitter', { value: button });
  fireEvent(form, event);
};

beforeEach(() => {
  mocks.testing = true;
  mocks.rpc.mockReset().mockResolvedValue({ error: null });
  mocks.gps.mockReset();
  mocks.watch.mockReset();
  mocks.clearWatch.mockReset();
  mocks.cities = [];
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: mocks.gps, watchPosition: mocks.watch, clearWatch: mocks.clearWatch },
  });
});

describe('Temporary test onboarding', () => {
  it('creates a test profile without requesting GPS during shared testing', async () => {
    const view = render(<Onboarding />);
    fireEvent.change(view.getByLabelText('Uživatelské jméno'), { target: { value: 'TestHrac' } });
    const button = view.container.querySelector('[data-test-onboarding]');
    const form = view.container.querySelector('form');
    if (!button || !form) throw new Error('Missing test onboarding action');
    submitWith(button, form);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('complete_onboarding_test', expect.objectContaining({ p_username: 'TestHrac', p_city: 'zlin' })));
    expect(mocks.gps).not.toHaveBeenCalled();
  });

  it('does not call test onboarding when the global testing switch is off', () => {
    mocks.testing = false;
    const view = render(<Onboarding />);
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Missing onboarding form');
    const forgedSubmitter = document.createElement('button');
    forgedSubmitter.setAttribute('data-test-onboarding', 'true');
    submitWith(forgedSubmitter, form);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.gps).not.toHaveBeenCalled();
  });
});

describe('Home founding with a coarse indoor GPS fix', () => {
  it('accepts a ±2000 m fix and offers the found settlement without a weak-signal warning', async () => {
    vi.useFakeTimers();
    try {
      mocks.cities = [{ id: 'otrokovice', name: 'Otrokovice', tier: 'town', lat: 49.22, lng: 17.62 }];
      mocks.watch.mockImplementation((success: (p: unknown) => void) => {
        setTimeout(() => success({ coords: { latitude: 49.22, longitude: 17.62, accuracy: 2000 } }), 0);
        return 7;
      });
      const view = render(<Onboarding />);
      fireEvent.change(view.getByLabelText('Uživatelské jméno'), { target: { value: 'Kundus' } });
      fireEvent.click(view.getByRole('button', { name: 'Zaměřit moji polohu' }));
      await vi.advanceTimersByTimeAsync(20000);
    } finally {
      vi.useRealTimers();
    }
    const view = render(<Onboarding />);
    expect(view.queryByText(/Signál je slabý/)).toBeNull();
  });
});
