import mongoose, { Schema, Model, Document } from 'mongoose';
const counterSchema = new Schema({
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
});
export const CounterModel = mongoose.model('Counter', counterSchema);
// Atomically increment and return new count
export async function nextSequence(key) {
    const doc = await CounterModel.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true, upsert: true }).lean();
    return doc.count;
}
//# sourceMappingURL=counter.model.js.map