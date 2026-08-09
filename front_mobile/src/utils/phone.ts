const IVORIAN_LOCAL_DIGITS = 10;

/**
 * Validates a local Ivorian phone number entered without the +225 prefix
 * (the prefix is fixed in the UI). Expects exactly 10 digits.
 */
export function isValidLocalPhone(localNumber: string): boolean {
  return /^\d{10}$/.test(localNumber);
}

export function toE164(localNumber: string): string {
  return `+225${localNumber}`;
}

export { IVORIAN_LOCAL_DIGITS };
