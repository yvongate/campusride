import { distanceKm } from './haversine';

describe('distanceKm', () => {
  it('returns 0 for the same point', () => {
    expect(distanceKm(5.36, -3.98, 5.36, -3.98)).toBe(0);
  });

  it('returns ~111.2km for one degree of latitude difference (known constant)', () => {
    expect(distanceKm(0, 0, 1, 0)).toBeCloseTo(111.2, 0);
  });

  it('returns a plausible distance between two points in Abidjan', () => {
    // Cocody (~5.3599, -3.9700) et Yopougon (~5.3167, -4.0833) : environ 14km
    const result = distanceKm(5.3599, -3.97, 5.3167, -4.0833);
    expect(result).toBeGreaterThan(10);
    expect(result).toBeLessThan(20);
  });
});
