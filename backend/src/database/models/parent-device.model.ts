import mongoose, { Schema, Model } from 'mongoose';
import type { IParentDeviceDocument } from '../../types/parent.types.js';

const parentDeviceSchema = new Schema<IParentDeviceDocument>(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    fcmToken: {
      type: String,
      default: null,
      index: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android'],
      required: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
    appVersion: String,
    deviceModel: String,
    osVersion: String,
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastTokenRotationAt: {
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
  },
  {
    timestamps: true,
  }
);

// One session per device per parent
parentDeviceSchema.index({ parentId: 1, deviceId: 1 }, { unique: true });

// Active devices lookup for multicast push notifications
parentDeviceSchema.index({ parentId: 1, isActive: 1 });

export const ParentDeviceModel: Model<IParentDeviceDocument> =
  mongoose.model<IParentDeviceDocument>('ParentDevice', parentDeviceSchema);
