import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URL as string).then(async () => {
    console.log('Connected.');
    const db = mongoose.connection.db;
    if(!db) throw new Error("DB not found");
    const attendees = db.collection('attendances');
    
    // Find duplicates
    const pipeline = [
        { $match: { sessionId: { $exists: true, $ne: null } } },
        { $group: { _id: { studentId: '$studentId', sessionId: '$sessionId' }, count: { $sum: 1 }, docs: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } }
    ];
    const duplicates = await attendees.aggregate(pipeline).toArray();
    console.log('Found duplicates:', duplicates.length);
    
    let removed = 0;
    for (const dup of duplicates) {
        const docsToRemove = dup.docs.slice(1); // keep the first one
        await attendees.deleteMany({ _id: { $in: docsToRemove } });
        removed += docsToRemove.length;
    }
    console.log('Removed duplicate records:', removed);
    
    // Build index manually to ensure it exists
    await attendees.createIndex({ studentId: 1, sessionId: 1 }, { unique: true, partialFilterExpression: { sessionId: { $exists: true, $ne: null } } });
    console.log('Unique index built successfully.');
    
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
