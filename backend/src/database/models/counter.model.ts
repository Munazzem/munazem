import mongoose, { Schema, Model, Document } from 'mongoose';

// Atomic counter for sequential student codes per (teacherId, gradeLevel)
interface ICounter extends Document {
    key:   string;   // format: `${teacherId}_${gradeLevel}`
    count: number;
}

const counterSchema = new Schema<ICounter>({
    key:   { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
});

export const CounterModel: Model<ICounter> =
    mongoose.model<ICounter>('Counter', counterSchema);

// Atomically increment and return new count
export async function nextSequence(key: string): Promise<number> {
    const doc = await CounterModel.findOneAndUpdate(
        { key },
        { $inc: { count: 1 } },
        { new: true, upsert: true }
    ).lean();
    return doc!.count;
}

// Atomically reserves a range of `count` sequential numbers in one round-trip.
// Returns the FIRST number in the allocated range.
// Example: counter was 5, request count=3 → counter becomes 8, returns 6 → codes: 6A, 7A, 8A
export async function nextSequenceBulk(key: string, count: number): Promise<number> {
    const doc = await CounterModel.findOneAndUpdate(
        { key },
        { $inc: { count } },
        { new: true, upsert: true }
    ).lean();
    return doc!.count - count + 1;
}

