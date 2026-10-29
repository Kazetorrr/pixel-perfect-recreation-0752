import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Onboarding } from '@/components/game/Onboarding';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invalidate: vi.fn(), testing: true, gps: vi.fn() }));
vi.mock('@/game/api', () => ({
  useCities: () => ({ data: [] }),
  useGameState: () => ({ data: { config: { dev_mode: mocks.testing } } }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('Temporary test onboarding', () => {
  beforeEach(() => {
    mocks.testing = true;
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
    mocks.gps.mockReset();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: mocks.gps } });
  });

  it('creates a test profile without requesting GPS during shared testing', async () => {
    const view = render(<Onboarding />);
    fireEvent.change(view.getByLabelText('Uživatelské jméno'), { target: { value: 'TestHrac' } });
    const button = view.container.querySelector('[data-test-onboarding]');
    const form = view.container.querySelector('form');
    if (!button || !form) throw new Error('Missing test onboarding action');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'submitter', { value: button });
    fireEvent(form, event);
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
    const event = new Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'submitter', { value: forgedSubmitter });
    fireEvent(form, event);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.gps).not.toHaveBeenCalled();
  });
});