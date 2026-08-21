/**
 * Normalizes Egyptian mobile phone numbers.
 * Converts "+201012345678" or "00201012345678" or "1012345678" into canonical "01012345678"
 */
export function normalizeEgyptianPhone(input: string): string {
  let cleaned = input.replace(/\D/g, '');

  if (cleaned.startsWith('20') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0020') && cleaned.length === 14) {
    cleaned = cleaned.substring(4);
  }

  if (cleaned.length === 10 && (cleaned.startsWith('10') || cleaned.startsWith('11') || cleaned.startsWith('12') || cleaned.startsWith('15'))) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

/**
 * Validates whether the number is a valid 11-digit Egyptian mobile number.
 */
export function isValidEgyptianPhone(phone: string): boolean {
  const normalized = normalizeEgyptianPhone(phone);
  return /^01[0125]\d{8}$/.test(normalized);
}

/**
 * Formats a phone number visually for display, e.g. "010 1234 5678"
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizeEgyptianPhone(phone);
  if (normalized.length !== 11) return phone;
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 7)} ${normalized.slice(7)}`;
}
