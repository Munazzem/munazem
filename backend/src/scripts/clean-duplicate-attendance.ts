/**
 * Comprehensive Data Cleanup & Migration Script: clean-duplicate-attendance.ts
 * 
 * High-performance in-memory processing:
 * 1. Intra-snapshot duplicates (students appearing in multiple arrays in the same snapshot).
 * 2. Cross-date & Same-date lesson compensations (missed group session compensated by attending another group as GUEST).
 * 3. Retroactive compensation synchronization (updates AttendanceModel and AttendanceSnapshotModel).
 * 4. Recalculates snapshot counters (presentCount, absentCount, totalCount).
 * 5. Recalculates consecutiveAbsences for all students.
 * 
 * Usage: npx tsx src/scripts/clean-duplicate-attendance.ts [--dry-run]
 */

import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });
import { AttendanceModel } from '../database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../database/models/attendance-snapshot.model.js';
import { StudentModel } from '../database/models/student.model.js';
import { SessionModel } from '../database/models/session.model.js';
import { GroupModel } from '../database/models/group.model.js';
import { AttendanceStatus } from '../common/enums/enum.service.js';

const isDryRun = process.argv.includes('--dry-run');

async function cleanDuplicateAttendance() {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    console.error('❌ No MONGO_URL found in environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Connected to MongoDB (DryRun: ${isDryRun})\n`);

  const students = await StudentModel.find({}).lean();
  const studentMap = new Map(students.map(s => [s._id.toString(), s]));
  console.log(`📋 Total students: ${students.length}`);

  const groups = await GroupModel.find({}).lean();
  const groupMap = new Map(groups.map(g => [g._id.toString(), g]));

  const allSnapshots = await AttendanceSnapshotModel.find({});
  console.log(`📋 Total snapshots loaded in memory: ${allSnapshots.length}`);

  let modifiedSnapshotsCount = 0;
  let modifiedAttendanceDocsCount = 0;
  let studentsWithFixedAbsences = 0;
  let totalCompensationsResolved = 0;

  // ═════════════════════════════════════════════════════════════════════════
  // 1. Clean Intra-Snapshot Duplicates (same snapshot having student in >1 array)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- Step 1: Cleaning Intra-Snapshot Duplicates ---');

  for (const snap of allSnapshots) {
    let modified = false;
    const snapGroupId = snap.groupId?.toString();

    // Deduplicate presentStudents array itself by studentId
    const uniquePresent: any[] = [];
    const presentIdSet = new Set<string>();
    for (const p of snap.presentStudents) {
      const sid = p.studentId.toString();
      if (!presentIdSet.has(sid)) {
        presentIdSet.add(sid);
        uniquePresent.push(p);
      } else {
        modified = true;
      }
    }
    snap.presentStudents = uniquePresent as any;

    // Deduplicate absentStudents array itself by studentId, and remove if already present
    const uniqueAbsent: any[] = [];
    const absentIdSet = new Set<string>();
    for (const a of snap.absentStudents) {
      const sid = a.studentId.toString();
      if (!presentIdSet.has(sid) && !absentIdSet.has(sid)) {
        absentIdSet.add(sid);
        uniqueAbsent.push(a);
      } else {
        modified = true;
      }
    }
    snap.absentStudents = uniqueAbsent as any;

    // Deduplicate guestStudents array
    const uniqueGuest: any[] = [];
    const guestIdSet = new Set<string>();
    for (const g of (snap.guestStudents || [])) {
      const sid = g.studentId.toString();
      const st = studentMap.get(sid);
      const isEnrolledInThisGroup = st?.groupId?.toString() === snapGroupId;

      if (isEnrolledInThisGroup && presentIdSet.has(sid)) {
        modified = true;
        console.log(`  ✓ Removed redundant guest entry in snapshot ${snap.sessionId} for group member ${st?.studentName}`);
      } else if (presentIdSet.has(sid)) {
        if (!isEnrolledInThisGroup) {
          snap.presentStudents = snap.presentStudents.filter(p => p.studentId.toString() !== sid);
          uniqueGuest.push(g);
          guestIdSet.add(sid);
          modified = true;
        } else {
          modified = true;
        }
      } else if (absentIdSet.has(sid)) {
        snap.absentStudents = snap.absentStudents.filter(a => a.studentId.toString() !== sid);
        uniqueGuest.push(g);
        guestIdSet.add(sid);
        modified = true;
      } else if (!guestIdSet.has(sid)) {
        guestIdSet.add(sid);
        uniqueGuest.push(g);
      } else {
        modified = true;
      }
    }
    snap.guestStudents = uniqueGuest as any;

    if (snap.presentCount !== snap.presentStudents.length || snap.absentCount !== snap.absentStudents.length) {
      snap.presentCount = snap.presentStudents.length;
      snap.absentCount = snap.absentStudents.length;
      modified = true;
    }

    if (modified) {
      modifiedSnapshotsCount++;
    }
  }
  console.log(`Step 1 Complete. Intra-snapshot cleaned.`);

  // ═════════════════════════════════════════════════════════════════════════
  // 2. Cross-Date & Same-Date Compensation Resolution
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- Step 2: Resolving Cross-Date & Same-Date Lesson Compensations ---');

  // Build map: studentId -> list of snapshots in which the student appears
  const studentAllSnapsMap = new Map<string, any[]>();
  for (const snap of allSnapshots) {
    const studentIdsInSnap = new Set<string>();
    snap.presentStudents.forEach((p: any) => studentIdsInSnap.add(p.studentId.toString()));
    snap.absentStudents.forEach((a: any) => studentIdsInSnap.add(a.studentId.toString()));
    (snap.guestStudents || []).forEach((g: any) => studentIdsInSnap.add(g.studentId.toString()));

    for (const sid of studentIdsInSnap) {
      if (!studentAllSnapsMap.has(sid)) studentAllSnapsMap.set(sid, []);
      studentAllSnapsMap.get(sid)!.push(snap);
    }
  }

  // Load all guest attendance records in AttendanceModel
  const allGuestAttendanceDocs = await AttendanceModel.find({
    isGuest: true,
    status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] }
  }).lean();

  const attendanceUpdatesToExcused: { studentId: mongoose.Types.ObjectId; sessionId: mongoose.Types.ObjectId }[] = [];

  for (const st of students) {
    const sid = st._id.toString();
    const snaps = (studentAllSnapsMap.get(sid) || []).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Find all guest attendances for this student
    const studentGuestSnaps = snaps.filter(s => s.guestStudents?.some((g: any) => g.studentId.toString() === sid));
    const studentGuestDocs = allGuestAttendanceDocs.filter(d => d.studentId.toString() === sid);

    // Combine unique guest session dates / sessionIds
    const guestInstances: { sessionId: string; date: Date }[] = [];
    const seenGuestSessions = new Set<string>();

    studentGuestSnaps.forEach(s => {
      const sessId = s.sessionId.toString();
      if (!seenGuestSessions.has(sessId)) {
        seenGuestSessions.add(sessId);
        guestInstances.push({ sessionId: sessId, date: new Date(s.date) });
      }
    });

    studentGuestDocs.forEach(d => {
      const sessId = d.sessionId?.toString();
      if (sessId && !seenGuestSessions.has(sessId)) {
        seenGuestSessions.add(sessId);
        guestInstances.push({ sessionId: sessId, date: new Date(d.scannedAt || Date.now()) });
      }
    });

    if (guestInstances.length === 0) continue;

    // Sort guest attendances chronologically
    guestInstances.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Find all absent sessions for this student in their primary group
    const absentSnaps = snaps.filter(s =>
      s.absentStudents.some((a: any) => a.studentId.toString() === sid) &&
      s.groupId?.toString() === st.groupId?.toString()
    );

    const matchedAbsentSnapIds = new Set<string>();

    for (const guest of guestInstances) {
      // Find the closest absent snapshot (within +/- 10 days) that hasn't been matched yet
      let closestAbsentSnap: any = null;
      let minDiff = Infinity;

      for (const absSnap of absentSnaps) {
        if (matchedAbsentSnapIds.has(absSnap.sessionId.toString())) continue;

        const diffMs = Math.abs(new Date(absSnap.date).getTime() - guest.date.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays <= 10 && diffMs < minDiff) {
          minDiff = diffMs;
          closestAbsentSnap = absSnap;
        }
      }

      if (closestAbsentSnap) {
        matchedAbsentSnapIds.add(closestAbsentSnap.sessionId.toString());
        totalCompensationsResolved++;

        const absDateStr = closestAbsentSnap.date.toISOString().split('T')[0];
        const guestDateStr = guest.date.toISOString().split('T')[0];

        console.log(`  ✓ Resolved compensation for ${st.studentName}: missed session on ${absDateStr} compensated via guest attendance on ${guestDateStr}`);

        // Remove from absentStudents in snapshot
        closestAbsentSnap.absentStudents = closestAbsentSnap.absentStudents.filter(
          (a: any) => a.studentId.toString() !== sid
        );
        closestAbsentSnap.absentCount = closestAbsentSnap.absentStudents.length;
        modifiedSnapshotsCount++;

        attendanceUpdatesToExcused.push({
          studentId: new mongoose.Types.ObjectId(sid),
          sessionId: closestAbsentSnap.sessionId
        });
      }
    }
  }

  // Save all modified snapshots and attendance records
  if (!isDryRun) {
    for (const snap of allSnapshots) {
      if (snap.isModified()) {
        await snap.save();
      }
    }

    if (attendanceUpdatesToExcused.length > 0) {
      for (const item of attendanceUpdatesToExcused) {
        const res = await AttendanceModel.updateMany(
          { studentId: item.studentId, sessionId: item.sessionId, status: AttendanceStatus.ABSENT },
          {
            $set: {
              status: AttendanceStatus.EXCUSED,
              notes: 'معوّض — حضر كزائر في مجموعة أخرى',
              isConsumed: false,
            }
          }
        );
        modifiedAttendanceDocsCount += res.modifiedCount;
      }
    }
  } else {
    modifiedAttendanceDocsCount = attendanceUpdatesToExcused.length;
  }

  console.log(`Step 2 Complete. Cleaned cross-date and same-date compensations.`);

  // ═════════════════════════════════════════════════════════════════════════
  // 3. Recalculate consecutiveAbsences for all active students (in-memory)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n--- Step 3: Recalculating Consecutive Absences ---');

  const studentBulkUpdates: any[] = [];

  for (const st of students) {
    const sid = st._id.toString();
    const snaps = (studentAllSnapsMap.get(sid) || []).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const dayMap = new Map<string, string>();
    for (const snap of snaps) {
      const dayKey = snap.date.toISOString().split('T')[0] || '';
      if (dayMap.has(dayKey)) continue;

      const isPresent = snap.presentStudents.some((p: any) => p.studentId.toString() === sid && p.status !== AttendanceStatus.EXCUSED);
      const isGuest = snap.guestStudents?.some((g: any) => g.studentId.toString() === sid);
      const isExcused = snap.presentStudents.some((p: any) => p.studentId.toString() === sid && p.status === AttendanceStatus.EXCUSED);
      const isAbsent = snap.absentStudents.some((a: any) => a.studentId.toString() === sid);

      if (isPresent) dayMap.set(dayKey, 'PRESENT');
      else if (isGuest) dayMap.set(dayKey, 'GUEST');
      else if (isExcused) dayMap.set(dayKey, 'EXCUSED');
      else if (isAbsent) dayMap.set(dayKey, 'ABSENT');
    }

    let consecutive = 0;
    for (const status of dayMap.values()) {
      if (status === 'ABSENT') {
        consecutive++;
      } else {
        break; // Stop at first attended or excused session
      }
    }

    if ((st.consecutiveAbsences ?? 0) !== consecutive) {
      studentsWithFixedAbsences++;
      console.log(`  ✓ ${st.studentName}: consecutiveAbsences updated from ${st.consecutiveAbsences ?? 0} to ${consecutive}`);
      studentBulkUpdates.push({
        updateOne: {
          filter: { _id: st._id },
          update: { $set: { consecutiveAbsences: consecutive } }
        }
      });
    }
  }

  if (!isDryRun && studentBulkUpdates.length > 0) {
    await StudentModel.bulkWrite(studentBulkUpdates);
  }

  console.log('\n=============================================================');
  console.log(`🏁 Data Cleanup Summary (${isDryRun ? 'DRY-RUN' : 'LIVE APPLIED'}):`);
  console.log(`   - Cross-date compensations resolved: ${totalCompensationsResolved}`);
  console.log(`   - Snapshots modified/cleaned: ${modifiedSnapshotsCount}`);
  console.log(`   - AttendanceModel docs updated to EXCUSED: ${modifiedAttendanceDocsCount}`);
  console.log(`   - Students with corrected consecutiveAbsences: ${studentsWithFixedAbsences}`);
  console.log('=============================================================\n');

  await mongoose.disconnect();
}

cleanDuplicateAttendance().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
