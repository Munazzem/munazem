/**
 * Migration Script: Migrate to new Lesson Cycle Model
 * 
 * Implements Option C: Cutover Migration
 * - Students with remainingSessions > 0: keep remainingSessions, cycleCapacity = group.schedule.length * 4, cycleStartedAt = last SUBSCRIPTION date (legacy approximation), cycleNumber = total subscriptions
 * - Students with remainingSessions <= 0: remainingSessions = 0, cycleCapacity = group.schedule.length * 4, cycleStartedAt = null, cycleNumber = total subscriptions
 *
 * Usage: npx tsx src/scripts/migrate-lesson-cycle.ts [--execute]
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { StudentModel } from '../database/models/student.model.js';
import { GroupModel } from '../database/models/group.model.js';
import { TransactionModel } from '../database/models/transaction.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../config/.env') });

const isDryRun = !process.argv.includes('--execute');

async function migrate() {
    console.log(`\n🚀 Starting Lesson Cycle Migration (${isDryRun ? 'DRY RUN' : 'EXECUTE'})\n`);

    const uri = process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
    if (!uri) {
        console.error('❌ No MONGO_URI, DATABASE_URL, or MONGO_URL found in environment');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    const students = await StudentModel.find({ isActive: true }).lean();
    console.log(`📋 Found ${students.length} active students to process\n`);

    let updated = 0;
    let zeroed = 0;
    let skipped = 0;

    for (const student of students) {
        try {
            // 1. Get group schedule for dynamic capacity
            // We prioritize the actual group schedule length over the old monthlySessionsQuota override
            const group = student.groupId ? await GroupModel.findById(student.groupId, { schedule: 1 }).lean() : null;
            const capacity = (group?.schedule?.length) 
                ? (group.schedule.length * 4) 
                : (student.monthlySessionsQuota || 8);

            // 2. Find subscriptions
            const subscriptions = await TransactionModel.find({
                studentId: student._id,
                type: 'INCOME',
                category: 'SUBSCRIPTION',
            }).sort({ date: -1 }).lean();
            
            const lastSubscription = subscriptions.length > 0 ? subscriptions[0] : null;
            const cycleNumber = subscriptions.length;
            
            const currentRemaining = student.remainingSessions ?? 0;
            let cycleStartedAt = null;
            let newRemaining = 0;
            
            if (currentRemaining > 0) {
                // Legacy approximation: we treat their last payment date as the start of the current cycle
                cycleStartedAt = lastSubscription ? lastSubscription.date : new Date();
                
                // Cap the remaining sessions at the new cycle capacity
                newRemaining = Math.min(currentRemaining, capacity);
                
                updated++;
                console.log(`  ✓ [ACTIVE CYCLE] ${student.studentName}: remaining=${newRemaining} (was ${currentRemaining}), capacity=${capacity}, startedAt=${cycleStartedAt?.toISOString().split('T')[0]}`);
            } else {
                newRemaining = 0;
                zeroed++;
                console.log(`  - [NO ACTIVE CYCLE] ${student.studentName}: remaining=0, capacity=${capacity}`);
            }

            if (!isDryRun) {
                await StudentModel.findByIdAndUpdate(student._id, {
                    $set: { 
                        remainingSessions: newRemaining,
                        cycleCapacity: capacity,
                        cycleStartedAt: cycleStartedAt,
                        cycleNumber: cycleNumber
                    }
                });
            }
        } catch (err: any) {
            skipped++;
            console.error(`  ✗ [ERROR] ${student.studentName}: ${err.message}`);
        }
    }

    console.log(`\n🏁 Migration complete:`);
    console.log(`   - ${updated} students set to active cycle`);
    console.log(`   - ${zeroed} students set to inactive cycle`);
    console.log(`   - ${skipped} skipped due to errors`);
    if (isDryRun) {
        console.log(`\n⚠️ This was a DRY RUN. No data was modified. Run with --execute to apply changes.`);
    }
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
