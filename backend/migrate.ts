import mongoose from 'mongoose';
import { envVars } from './src/config/env.service.ts';

async function migrate() {
    console.log('Connecting to DB...');
    await mongoose.connect(envVars.mongoUrl);
    const db = mongoose.connection.db;

    console.log('Updating PRO -> MINI...');
    const result1 = await db.collection('subscriptions').updateMany(
        { planTier: 'PRO' },
        { $set: { planTier: 'MINI' } }
    );
    console.log('PRO updated:', result1.modifiedCount);

    console.log('Setting studentsCount for missing records...');
    const result2 = await db.collection('subscriptions').updateMany(
        { studentsCount: { $exists: false } },
        { $set: { studentsCount: 250 } }
    );
    console.log('studentsCount set:', result2.modifiedCount);

    console.log('Done');
    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
