import mongoose, { Schema, Model } from 'mongoose';
import type { IParentDocument } from '../../types/parent.types.js';

const parentSchema = new Schema<IParentDocument>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const ParentModel: Model<IParentDocument> =
  mongoose.model<IParentDocument>('Parent', parentSchema);
