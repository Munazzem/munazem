import mongoose, { Schema, Model } from 'mongoose';
import { ParentNotificationType } from '../../types/parent.types.js';
import type { IParentNotificationDocument } from '../../types/parent.types.js';

const parentNotificationSchema = new Schema<IParentNotificationDocument>(
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
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ParentNotificationType),
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    deepLink: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    eventId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Idempotency: Prevent duplicate notifications per parent per event
parentNotificationSchema.index({ parentId: 1, eventId: 1 }, { unique: true });

// Pagination index
parentNotificationSchema.index({ parentId: 1, createdAt: -1 });

// Unread counts
parentNotificationSchema.index({ parentId: 1, isRead: 1 });

// Retention: Automatically purge older than 180 days
parentNotificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 }
);

export const ParentNotificationModel: Model<IParentNotificationDocument> =
  mongoose.model<IParentNotificationDocument>(
    'ParentNotification',
    parentNotificationSchema
  );
