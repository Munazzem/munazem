import mongoose from 'mongoose';
/**
 * Wraps a set of database mutations in a MongoDB transaction.
 * Guarantees all-or-nothing: either every write succeeds, or none do.
 *
 * Usage:
 * ```ts
 * const result = await withTransaction(async (session) => {
 *     await Model.create([{ ... }], { session });
 *     await Model.findByIdAndUpdate(id, update, { session });
 *     return someValue;
 * });
 * ```
 *
 * Notes:
 * - Model.create() inside a transaction requires an array: `create([doc], { session })`
 * - All read/write ops that must be atomic should pass `{ session }` in their options.
 * - Requires a MongoDB replica set (Atlas free tier M0 supports this).
 */
export async function withTransaction(fn) {
    if (process.env.DISABLE_TRANSACTIONS === 'true') {
        // Skip transaction for local standalone MongoDB testing
        return fn(undefined);
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await fn(session);
        await session.commitTransaction();
        return result;
    }
    catch (error) {
        await session.abortTransaction();
        throw error;
    }
    finally {
        session.endSession();
    }
}
//# sourceMappingURL=transaction.util.js.map