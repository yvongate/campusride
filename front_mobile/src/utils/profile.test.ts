import { getDisplayName } from './profile';

describe('getDisplayName', () => {
  it('returns "prenom nom" when both are present', () => {
    expect(getDisplayName('Fofana', 'Ama', '+2250700000000')).toBe(
      'Ama Fofana',
    );
  });

  it('returns the phone number when both are absent', () => {
    expect(getDisplayName(null, null, '+2250700000000')).toBe(
      '+2250700000000',
    );
  });

  it('returns just nom when prenom is missing', () => {
    expect(getDisplayName('Fofana', null, '+2250700000000')).toBe('Fofana');
  });

  it('returns just prenom when nom is missing', () => {
    expect(getDisplayName(null, 'Ama', '+2250700000000')).toBe('Ama');
  });
});
