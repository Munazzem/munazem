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
