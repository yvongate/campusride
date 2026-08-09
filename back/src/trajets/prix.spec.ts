import { computePrixParPersonne } from './prix';

describe('computePrixParPersonne', () => {
  it('does not round when the division is already a whole FCFA amount (cahier des charges example)', () => {
    expect(computePrixParPersonne(3500, 4)).toBe(875);
  });

  it('rounds up to the next ten when the division is not a whole amount', () => {
    // 3500 / 3 = 1166.666... -> arrondi a 1170
    expect(computePrixParPersonne(3500, 3)).toBe(1170);
  });

  it('never returns a per-person total below what an exact split would give', () => {
    const prixParPersonne = computePrixParPersonne(1000, 3);
    expect(prixParPersonne * 3).toBeGreaterThanOrEqual(1000);
  });

  it('handles a single passenger (no division needed)', () => {
    expect(computePrixParPersonne(3500, 1)).toBe(3500);
  });
});
