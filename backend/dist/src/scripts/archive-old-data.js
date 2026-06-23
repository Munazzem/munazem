import mongoose from 'mongoose';
import { AttendanceModel } from '../database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../database/models/attendance-snapshot.model.js';
import { SessionModel } from '../database/models/session.model.js';
import { DailyLedgerModel } from '../database/models/ledger.model.js';
import { ArchiveAttendanceModel } from '../database/models/archive-attendance.model.js';
import { SessionStatus } from '../common/enums/enum.service.js';
import { logger } from '../common/utils/logger.util.js';
/**
 * Archives old data to keep the active collections lean.
 *
 * Strategy:
 *  - attendance records   > 6 months → move to archive_attendance collection
 *  - attendance_snapshots > 6 months → delete (data already captured in MonthlyLedger)
 *  - sessions (COMPLETED/CANCELLED) > 6 months → delete
 *  - daily_ledgers > 12 months → delete (MonthlyLedger keeps the summary)
 *
 * Transactions & MonthlyLedgers are NEVER archived — they're needed for
 * historical financial reports.
 *
 * This function is safe to run repeatedly — it uses date filters so it
 * won't touch recently-archived data.
 */
const BATCH_SIZE = 500; // Process in chunks to avoid memory spikes
export async function archiveOldData() {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    logger.info('archive_start', { sixMonthsAgo: sixMonthsAgo.toISOString(), twelveMonthsAgo: twelveMonthsAgo.toISOString() });
    // ── 1. Archive old attendance records ─────────────────────────────
    let archivedAttendance = 0;
    let hasMore = true;
    while (hasMore) {
        const oldRecords = await AttendanceModel.find({ scannedAt: { $lt: sixMonthsAgo } }, { __v: 0 }).limit(BATCH_SIZE).lean();
        if (oldRecords.length === 0) {
            hasMore = false;
            break;
        }
        // Insert into archive collection (ignore duplicates)
        const archiveDocs = oldRecords.map(r => ({
            ...r,
            _id: r._id, // Preserve original ID
            archivedAt: now,
        }));
        try {
            await ArchiveAttendanceModel.insertMany(archiveDocs, { ordered: false });
        }
        catch (err) {
            // Partial insert is fine — duplicates are expected on re-runs
            if (!err.writeErrors && !err.code)
                throw err;
        }
        // Delete from active collection
        const ids = oldRecords.map(r => r._id);
        await AttendanceModel.deleteMany({ _id: { $in: ids } });
        archivedAttendance += oldRecords.length;
        // Safety: yield to event loop
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    // ── 2. Delete old attendance snapshots ────────────────────────────
    const deletedSnapshots = await AttendanceSnapshotModel.deleteMany({
        date: { $lt: sixMonthsAgo },
    });
    // ── 3. Delete old completed/cancelled sessions ───────────────────
    const deletedSessions = await SessionModel.deleteMany({
        date: { $lt: sixMonthsAgo },
        status: { $in: [SessionStatus.COMPLETED, SessionStatus.CANCELLED] },
    });
    // ── 4. Delete old daily ledgers (monthly keeps the summary) ──────
    const deletedLedgers = await DailyLedgerModel.deleteMany({
        date: { $lt: twelveMonthsAgo },
    });
    logger.info('archive_done', {
        archivedAttendance,
        deletedSnapshots: deletedSnapshots.deletedCount,
        deletedSessions: deletedSessions.deletedCount,
        deletedLedgers: deletedLedgers.deletedCount,
    });
}
//# sourceMappingURL=archive-old-data.js.map