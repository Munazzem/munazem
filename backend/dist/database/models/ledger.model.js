import mongoose, { Schema, Model } from 'mongoose';
// ─── Daily Ledger ────────────────────────────────────────────────
const dailyTransactionSchema = new Schema({
    transactionId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    paidAmount: { type: Number, required: true },
    studentName: { type: String },
    description: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    time: { type: Date, required: true },
}, { _id: false });
const dailyLedgerSchema = new Schema({
    teacherId: {
        type: Schema.Types.ObjectId, ref: 'User', required: true, index: true,
    },
    date: {
        type: Date, required: true, // start of day UTC
    },
    transactions: { type: [dailyTransactionSchema], default: [] },
    totalIncome: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    netBalance: { type: Number, default: 0 },
}, {
    timestamps: true,
});
// Unique: one daily ledger per teacher per day
dailyLedgerSchema.index({ teacherId: 1, date: 1 }, { unique: true });
export const DailyLedgerModel = mongoose.model('DailyLedger', dailyLedgerSchema);
// ─── Monthly Ledger ──────────────────────────────────────────────
const dailySummarySchema = new Schema({
    date: { type: Date, required: true },
    totalIncome: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    netBalance: { type: Number, default: 0 },
    transactionCount: { type: Number, default: 0 },
}, { _id: false });
const monthlyLedgerSchema = new Schema({
    teacherId: {
        type: Schema.Types.ObjectId, ref: 'User', required: true, index: true,
    },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    dailySummaries: { type: [dailySummarySchema], default: [] },
    totalIncome: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    netBalance: { type: Number, default: 0 },
}, {
    timestamps: true,
});
// Unique: one monthly ledger per teacher per month per year
monthlyLedgerSchema.index({ teacherId: 1, year: 1, month: 1 }, { unique: true });
export const MonthlyLedgerModel = mongoose.model('MonthlyLedger', monthlyLedgerSchema);
//# sourceMappingURL=ledger.model.js.map