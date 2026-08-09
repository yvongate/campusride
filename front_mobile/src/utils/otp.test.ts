import { isCompleteCode, joinDigits, splitDigits, OTP_LENGTH } from './otp';

describe('joinDigits', () => {
  it('concatenates all digits into a single string', () => {
    expect(joinDigits(['1', '2', '3', '4', '5', '6'])).toBe('123456');
  });
});

describe('isCompleteCode', () => {
  it('returns true when all 6 boxes are filled with digits', () => {
    expect(isCompleteCode(['1', '2', '3', '4', '5', '6'])).toBe(true);
  });

  it('returns false when a box is empty', () => {
    const digits = Array(OTP_LENGTH).fill('1');
    digits[3] = '';
    expect(isCompleteCode(digits)).toBe(false);
  });

  it('returns false when fewer than 6 boxes are provided', () => {
    expect(isCompleteCode(['1', '2', '3'])).toBe(false);
  });

  it('returns false when a box contains a non-digit', () => {
    const digits = Array(OTP_LENGTH).fill('1');
    digits[0] = 'a';
    expect(isCompleteCode(digits)).toBe(false);
  });
});

describe('splitDigits', () => {
  it('splits a 6-digit code string into an array of single digits', () => {
    expect(splitDigits('123456')).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('pads with empty strings when the code is shorter than expected', () => {
    expect(splitDigits('123')).toEqual(['1', '2', '3', '', '', '']);
  });
});
