/**
 * Migration Script: Calculate remainingSessions for existing students
 *
 * For each active student:
 *   1. Get their group schedule to calculate the dynamic quota (schedule.length × 4)
 *   2. Find their most recent SUBSCRIPTION transaction
 *   3. Count COMPLETED sessions they attended (via snapshots) since that payment
 *   4. Set remainingSessions = quota - attendedSincePayment
 *
 * Usage: npx tsx src/scripts/migrate-remaining-sessions.ts
 */
export {};
//# sourceMappingURL=migrate-remaining-sessions.d.ts.map