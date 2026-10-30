import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requestPermission: vi.fn() }));
vi.mock('@capacitor/geolocation', () => ({ Geolocation: { requestPermission: mocks.requestPermission } }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setNative = (native: boolean) => { (window as any).Capacitor = native ? { isNativePlatform: () => true } : undefined; };

describe('Native location permission', () => {
  beforeEach(() => {
    mocks.requestPermission.mockReset();
    setNative(false);
  });

  it('leaves the browser prompt alone in a plain browser', async () => {
    const { ensureLocationPermission } = await import('@/lib/native-location');
    await expect(ensureLocationPermission()).resolves.toBeUndefined();
    expect(mocks.requestPermission).not.toHaveBeenCalled();
  });

  it('asks Android for the location permission inside the app', async () => {
    setNative(true);
    mocks.requestPermission.mockResolvedValue({ location: 'granted' });
    const { ensureLocationPermission } = await import('@/lib/native-location');
    await ensureLocationPermission();
    expect(mocks.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('stops the GPS flow when the user denies location', async () => {
    setNative(true);
    mocks.requestPermission.mockResolvedValue({ location: 'denied' });
    const { ensureLocationPermission } = await import('@/lib/native-location');
    await expect(ensureLocationPermission()).rejects.toThrow('Přístup k poloze byl zamítnut');
  });
});
