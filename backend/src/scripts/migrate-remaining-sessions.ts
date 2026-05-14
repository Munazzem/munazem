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

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { StudentModel } from '../database/models/student.model.js';
import { GroupModel } from '../database/models/group.model.js';
import { TransactionModel } from '../database/models/transaction.model.js';
import { AttendanceSnapshotModel } from '../database/models/attendance-snapshot.model.js';

dotenv.config();

async function migrate() {
    const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!uri) {
        console.error('❌ No MONGO_URI or DATABASE_URL found in environment');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    const students = await StudentModel.find({ isActive: true }).lean();
    console.log(`📋 Found ${students.length} active students`);

    let updated = 0;
    let skipped = 0;

    for (const student of students) {
        try {
            // 1. Get group schedule for dynamic quota
            const group = await GroupModel.findById(student.groupId, { schedule: 1 }).lean();
            const quota = student.monthlySessionsQuota || (group?.schedule?.length ?? 2) * 4;

            // 2. Find last subscription payment
            const lastSubscription = await TransactionModel.findOne({
                studentId: student._id,
                type: 'INCOME',
                category: 'SUBSCRIPTION',
            }).sort({ date: -1 }).lean();

            if (!lastSubscription) {
                // No subscription ever — set remaining to 0
                await StudentModel.findByIdAndUpdate(student._id, {
                    $set: { remainingSessions: 0, monthlySessionsQuota: quota }
                });
                skipped++;
                continue;
            }

            // 3. Count sessions attended since last payment
            const attendedCount = await AttendanceSnapshotModel.countDocuments({
                date: { $gte: lastSubscription.date },
                $or: [
                    { 'presentStudents.studentId': student._id },
                    { 'guestStudents.studentId': student._id },
                ],
            });

            // 4. Calculate remaining
            const remaining = Math.max(0, quota - attendedCount);

            await StudentModel.findByIdAndUpdate(student._id, {
                $set: { remainingSessions: remaining, monthlySessionsQuota: quota }
            });

            updated++;
            console.log(`  ✓ ${student.studentName}: quota=${quota}, attended=${attendedCount}, remaining=${remaining}`);
        } catch (err: any) {
            console.error(`  ✗ ${student.studentName}: ${err.message}`);
        }
    }

    console.log(`\n🏁 Migration complete: ${updated} updated, ${skipped} skipped (no subscription)`);
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
