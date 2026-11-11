import { describe, expect, it } from 'vitest';
import { isCounterHandover } from '@/lib/driverDelivery';

describe('driver handover', () => {
  it('allows the counter bill handover flow', () => expect(isCounterHandover('pos')).toBe(true));
  it('keeps delivery orders on PIN verification', () => {
    expect(isCounterHandover('delivery')).toBe(false);
    expect(isCounterHandover(null)).toBe(false);
  });
});