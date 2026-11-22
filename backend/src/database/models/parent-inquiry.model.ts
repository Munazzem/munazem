import mongoose, { Schema, Model } from 'mongoose';
import {
  INQUIRY_ASSIGNEES,
  INQUIRY_CATEGORIES,
  INQUIRY_REPLIER_ROLES,
  INQUIRY_STATUSES,
  MAX_INQUIRY_EDITS,
  CANCELLED_INQUIRY_TTL_SECONDS,
} from '../../types/parent-inquiry.types.js';
import type {
  IInquiryReply,
  IParentInquiryDocument,
} from '../../types/parent-inquiry.types.js';

const OPEN_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'ESCALATED']);

export function computeInquiryIsOpen(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

const inquiryReplySchema = new Schema<IInquiryReply>(
  {
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    repliedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    repliedByRole: {
      type: String,
      enum: INQUIRY_REPLIER_ROLES,
      required: true,
    },
    repliedByName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    repliedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    clientRequestId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
  },
  { _id: false }
);

const parentInquirySchema = new Schema<IParentInquiryDocument>(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Parent',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    studentName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    groupName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: '',
    },
    category: {
      type: String,
      enum: INQUIRY_CATEGORIES,
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: INQUIRY_STATUSES,
      default: 'PENDING',
      required: true,
    },
    isOpen: {
      type: Boolean,
      default: true,
      required: true,
    },
    assignedTo: {
      type: String,
      enum: INQUIRY_ASSIGNEES,
      default: 'ASSISTANT',
      required: true,
    },
    editCount: {
      type: Number,
      default: 0,
      min: 0,
      max: MAX_INQUIRY_EDITS,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    escalatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    escalationNote: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    reply: {
      type: inquiryReplySchema,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    clientRequestId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
  },
  {
    timestamps: true,
  }
);

// ── Hooks: Guarantee `isOpen` is always synchronized with `status` ──────────
parentInquirySchema.pre('validate', function () {
  if (this.status) {
    this.isOpen = computeInquiryIsOpen(this.status);
  }
});

parentInquirySchema.pre('save', function () {
  this.isOpen = computeInquiryIsOpen(this.status);
});

function syncIsOpenOnQueryUpdate(this: mongoose.Query<any, any>) {
  const update = this.getUpdate() as Record<string, any> | null;
  if (!update || Array.isArray(update)) return;

  const nextStatus = update.$set?.status ?? update.status;
  if (typeof nextStatus === 'string') {
    const computedIsOpen = computeInquiryIsOpen(nextStatus);
    if (update.$set) {
      update.$set.isOpen = computedIsOpen;
    } else if ('status' in update) {
      update.isOpen = computedIsOpen;
    } else {
      update.$set = { isOpen: computedIsOpen };
    }
  }
}

parentInquirySchema.pre('findOneAndUpdate', syncIsOpenOnQueryUpdate);
parentInquirySchema.pre('updateOne', syncIsOpenOnQueryUpdate);
parentInquirySchema.pre('updateMany', syncIsOpenOnQueryUpdate);

// ── Indexes ─────────────────────────────────────────────────────────────────

// 1. One Active Inquiry Rule per (parentId, studentId)
parentInquirySchema.index(
  { parentId: 1, studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { isOpen: true },
    name: 'uniq_active_inquiry_per_parent_student',
  }
);

// 2. Idempotency per (parentId, clientRequestId)
parentInquirySchema.index(
  { parentId: 1, clientRequestId: 1 },
  {
    unique: true,
    name: 'uniq_parent_inquiry_client_request',
  }
);

// 3. Parent thread/history per child sorted by creation date
parentInquirySchema.index(
  { parentId: 1, studentId: 1, createdAt: -1 },
  { name: 'idx_parent_student_history' }
);

// 4. Teacher/Assistant active inbox & badge counts
parentInquirySchema.index(
  { teacherId: 1, isOpen: 1, assignedTo: 1, createdAt: -1 },
  { name: 'idx_teacher_inbox_open' }
);

// 5. Teacher/Assistant archive history by status
parentInquirySchema.index(
  { teacherId: 1, status: 1, createdAt: -1 },
  { name: 'idx_teacher_status_history' }
);

// 6. TTL Index: Auto-delete CANCELLED inquiries after 30 days (only when status === 'CANCELLED')
parentInquirySchema.index(
  { cancelledAt: 1 },
  {
    expireAfterSeconds: CANCELLED_INQUIRY_TTL_SECONDS,
    partialFilterExpression: { status: 'CANCELLED' },
    name: 'ttl_cancelled_inquiries_30d',
  }
);

export const ParentInquiryModel: Model<IParentInquiryDocument> =
  mongoose.models.ParentInquiry ||
  mongoose.model<IParentInquiryDocument>('ParentInquiry', parentInquirySchema);
