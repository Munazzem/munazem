/**
 * Collects financial & session data for the past 7 days for every active
 * teacher and enqueues an email job for each.
 */
export declare function generateWeeklyReports(teacherId?: string, forceTest?: boolean): Promise<void>;
/**
 * For each teacher, finds groups whose 2nd session of the month is TOMORROW.
 * For unpaid students in those groups, enqueues a WhatsApp reminder.
 *
 * Logic:
 * 1. Get all groups with schedules
 * 2. For each group, calculate the dates of scheduled sessions this month
 * 3. If the 2nd session date is tomorrow → find unpaid students in that group
 * 4. Check opt-out list and skip opted-out parents
 * 5. Enqueue WhatsApp reminder (dedup key prevents duplicates within a month)
 */
export declare function generatePaymentReminders(teacherId?: string): Promise<void>;
//# sourceMappingURL=automation.service.d.ts.map