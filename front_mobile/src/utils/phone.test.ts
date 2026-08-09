import { isValidLocalPhone, toE164 } from './phone';

describe('isValidLocalPhone', () => {
  it('accepts exactly 10 digits', () => {
    expect(isValidLocalPhone('0700000000')).toBe(true);
  });

  it('rejects fewer than 10 digits', () => {
    expect(isValidLocalPhone('070000000')).toBe(false);
  });

  it('rejects more than 10 digits', () => {
    expect(isValidLocalPhone('07000000000')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isValidLocalPhone('07000000a0')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidLocalPhone('')).toBe(false);
  });
});

describe('toE164', () => {
  it('prefixes the local number with +225', () => {
    expect(toE164('0700000000')).toBe('+2250700000000');
  });
});
