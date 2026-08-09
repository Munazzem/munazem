/**
 * Migration Script: Initialize Group Cycles
 * 
 * This script migrates the lesson cycle from the Student level to the Group level.
 * It initializes the `cycle` object on all groups.
 * 
 * Backward Compatibility Strategy for Payment Status:
 * To ensure that students who are currently "Paid" (remainingSessions > 0) stay "Paid",
 * the group's `startedAt` date is set to the OLDEST `cycleStartedAt` among all active, 
 * paid students in the group. Since a student is considered paid if 
 * `Transaction.date >= group.cycle.startedAt`, this guarantees all currently paid 
 * students remain paid.
 *
 * Usage: npx tsx src/scripts/migrate-group-cycles.ts [--execute]
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { StudentModel } from '../database/models/student.model.js';
import { GroupModel } from '../database/models/group.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../config/.env') });

const isDryRun = !process.argv.includes('--execute');

async function migrate() {
    console.log(`\n🚀 Starting Group Cycle Migration (${isDryRun ? 'DRY RUN' : 'EXECUTE'})\n`);

    const uri = process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGO_URL;
    if (!uri) {
        console.error('❌ No MONGO_URI, DATABASE_URL, or MONGO_URL found in environment');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    const groups = await GroupModel.find({ isActive: true }).lean();
    console.log(`📋 Found ${groups.length} active groups to process\n`);

    let updated = 0;
    let skipped = 0;

    for (const group of groups) {
        try {
            // 1. Calculate capacity
            const capacity = (group.schedule && group.schedule.length > 0) 
                ? (group.schedule.length * 4) 
                : 8;

            // 2. Find the oldest cycleStartedAt among students who have remainingSessions > 0
            const activeStudents = await StudentModel.find({
                groupId: group._id,
                isActive: true,
                remainingSessions: { $gt: 0 },
                cycleStartedAt: { $ne: null }
            }).sort({ cycleStartedAt: 1 }).lean();

            let startedAt = new Date(); // Default to now if no active students
            if (activeStudents.length > 0 && activeStudents[0]!.cycleStartedAt) {
                startedAt = new Date(activeStudents[0]!.cycleStartedAt!);
            }

            const cycleData = {
                capacity,
                currentCycleNumber: 1,
                currentSessionNumber: 1,
                startedAt
            };

            console.log(`  ✓ [GROUP] ${group.name}: capacity=${capacity}, startedAt=${startedAt.toISOString().split('T')[0]}`);

            if (!isDryRun) {
                await GroupModel.findByIdAndUpdate(group._id, {
                    $set: { cycle: cycleData }
                });
            }
            updated++;
        } catch (err: any) {
            skipped++;
            console.error(`  ✗ [ERROR] Group ${group._id}: ${err.message}`);
        }
    }

    console.log(`\n🏁 Migration complete:`);
    console.log(`   - ${updated} groups updated`);
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
