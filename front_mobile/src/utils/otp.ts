export const OTP_LENGTH = 6;

export function joinDigits(digits: string[]): string {
  return digits.join('');
}

export function isCompleteCode(digits: string[]): boolean {
  return joinDigits(digits).length === OTP_LENGTH && digits.every((d) => /^\d$/.test(d));
}

// Inverse de joinDigits -- utilise pour pre-remplir les cases avec le code
// renvoye par le backend (pas d'envoi SMS reel, voir requestOtp).
export function splitDigits(code: string): string[] {
  const digits = code.split('').slice(0, OTP_LENGTH);
  while (digits.length < OTP_LENGTH) digits.push('');
  return digits;
}
