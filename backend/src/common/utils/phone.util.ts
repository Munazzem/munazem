/**
 * Centralized phone number normalization.
 *
 * Handles Egyptian numbers — converts local 01x format to international 201x.
 * Single Source of Truth — used everywhere instead of inline normalization.
 */
export function normalizePhone(raw: string): string {
    let clean = raw.replace(/\D/g, '');
    if (clean.startsWith('01')) clean = '2' + clean;           // 01012345678 → 201012345678
    else if (!clean.startsWith('20') && clean.length === 10) {
        clean = '20' + clean;                                   // 1012345678 → 201012345678
    }
    return clean;
}
