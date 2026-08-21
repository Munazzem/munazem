import mongoose, { Schema, Model } from 'mongoose';
import type { IParentStudentDocument } from '../../types/parent.types.js';

const parentStudentSchema = new Schema<IParentStudentDocument>(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED'],
      default: 'ACTIVE',
      index: true,
    },
    verifiedVia: {
      type: String,
      enum: ['BARCODE_SCAN', 'BARCODE_MANUAL', 'AUTO_CONFIRMED'],
      required: true,
    },
    linkedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    audit: {
      linkedByDeviceId: String,
      linkedIp: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Unique Index: Prevents duplicate links between same parent and student
parentStudentSchema.index({ parentId: 1, studentId: 1 }, { unique: true });

// Performance index for active students of a parent
parentStudentSchema.index({ parentId: 1, status: 1 });

// Performance index for notifications routing to parents of a student
parentStudentSchema.index({ studentId: 1, status: 1 });

export const ParentStudentModel: Model<IParentStudentDocument> =
  mongoose.model<IParentStudentDocument>('ParentStudent', parentStudentSchema);
