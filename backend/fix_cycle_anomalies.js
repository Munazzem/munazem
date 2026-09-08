import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'config', '.env') });

async function runFix() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URL);
  const db = mongoose.connection.db;
  console.log('Connected successfully.');

  const groups = await db.collection('groups').find({}).toArray();
  let totalFixedGroups = 0;
  let totalFixedSessions = 0;
  const teachersToInvalidate = new Set();

  for (const g of groups) {
    // Only process groups that have an active cycle and completed sessions
    const completedSessions = await db.collection('sessions')
      .find({ groupId: g._id, status: 'COMPLETED' })
      .sort({ date: 1, startTime: 1 })
      .toArray();

    if (completedSessions.length === 0) continue;

    // Check if there is an anomaly in this group
    let hasAnomaly = false;

    // Check if the very first completed session in Cycle 1 started at sessionNumber > 1 (e.g. migration offset)
    if (completedSessions[0]?.cycleContext?.cycleNumber === 1 && (completedSessions[0]?.cycleContext?.sessionNumber || 0) > 1) {
      hasAnomaly = true;
    }

    for (let i = 1; i < completedSessions.length; i++) {
      const prevC = completedSessions[i - 1].cycleContext?.cycleNumber || 0;
      const currC = completedSessions[i].cycleContext?.cycleNumber || 0;
      const prevS = completedSessions[i - 1].cycleContext?.sessionNumber || 0;
      const currS = completedSessions[i].cycleContext?.sessionNumber || 0;

      // Cycle number dropped backwards
      if (currC < prevC && currC > 0) hasAnomaly = true;
      // In same cycle, session number dropped backwards or duplicate session numbers
      if (currC === prevC && currC > 0 && currS <= prevS) hasAnomaly = true;
    }

    // Also check for sessions with missing/undefined cycleContext
    const hasUndefined = completedSessions.some(s => !s.cycleContext || !s.cycleContext.cycleNumber);
    if (hasUndefined && g.cycle?.currentCycleNumber) {
      hasAnomaly = true;
    }

    // Skip groups without any anomaly
    if (!hasAnomaly) continue;

    const defaultFullCap = (g.schedule?.length || 2) * 4 || 8;
    const enr1 = await db.collection('cycleenrollments').findOne({ groupId: g._id, cycleNumber: 1 });
    const cycle1Cap = enr1?.cycleCapacity || g.cycle?.capacity || defaultFullCap;
    const standardCap = defaultFullCap;

    console.log(`\nFixing group: "${g.name}" (ID: ${g._id})`);
    console.log(`  Cycle 1 Capacity: ${cycle1Cap}, Standard Capacity: ${standardCap}`);

    let currentC = 1;
    let currentS = 0;
    let capForCurrentC = cycle1Cap;
    let groupFixedSessions = 0;

    for (let i = 0; i < completedSessions.length; i++) {
      const s = completedSessions[i];
      currentS++;
      if (currentS > capForCurrentC) {
        currentC++;
        currentS = 1;
        capForCurrentC = standardCap;
      }

      const prevCtx = s.cycleContext;
      const newCtx = { cycleNumber: currentC, sessionNumber: currentS };

      if (!prevCtx || prevCtx.cycleNumber !== newCtx.cycleNumber || prevCtx.sessionNumber !== newCtx.sessionNumber) {
        await db.collection('sessions').updateOne(
          { _id: s._id },
          { $set: { cycleContext: newCtx } }
        );
        const dateStr = s.date.toISOString().split('T')[0];
        console.log(`  ✓ Session ${dateStr} (${s.startTime}): ${JSON.stringify(prevCtx)} -> ${JSON.stringify(newCtx)}`);
        groupFixedSessions++;
        totalFixedSessions++;
      }
    }

    // Update group.cycle to match the true latest completed session
    await db.collection('groups').updateOne(
      { _id: g._id },
      {
        $set: {
          'cycle.currentCycleNumber': currentC,
          'cycle.currentSessionNumber': currentS,
          'cycle.capacity': capForCurrentC
        }
      }
    );
    console.log(`  ✓ Updated group.cycle -> currentCycleNumber: ${currentC}, currentSessionNumber: ${currentS}, capacity: ${capForCurrentC}`);

    if (g.teacherId) {
      teachersToInvalidate.add(g.teacherId.toString());
    }
    totalFixedGroups++;
  }

  // Flush Redis cache for affected teachers
  if (teachersToInvalidate.size > 0) {
    try {
      const IORedis = await import('ioredis');
      const Redis = IORedis.default || IORedis;
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';
      const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
      await redis.connect();

      for (const tId of teachersToInvalidate) {
        const pattern = `cache:t:${tId}:*`;
        let cursor = '0';
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys && keys.length > 0) await redis.del(...keys);
        } while (cursor !== '0');
        await redis.del(`cache:dashboard:${tId}`);
      }
      await redis.disconnect();
      console.log(`\n✓ Invalidated Redis cache for ${teachersToInvalidate.size} teachers.`);
    } catch (err) {
      console.log('\nRedis not running or failed to invalidate cache, skipping Redis flush.');
    }
  }

  console.log(`\n======================================================`);
  console.log(`COMPLETED SUCCESSFULLY!`);
  console.log(`Fixed groups: ${totalFixedGroups}`);
  console.log(`Fixed sessions: ${totalFixedSessions}`);
  console.log(`======================================================`);

  process.exit(0);
}

runFix().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
