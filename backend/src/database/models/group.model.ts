import mongoose, { Schema, Model } from 'mongoose';
import type { IGroup } from '../../types/group.types.js';
import { GradeLevel } from '../../common/enums/enum.service.js';

const groupSchema = new Schema<IGroup>({
    name: { 
        type: String, 
        required: [true, 'اسم المجموعة مطلوب'],
        trim: true
    },
    gradeLevel: { 
        type: String, 
        enum: Object.values(GradeLevel),
        required: [true, 'المرحلة الدراسية مطلوبة'] 
    },
    schedule: [{ 
        day: { type: String, required: true }, 
        time: { type: String, required: true } 
    }],
    capacity: {
        type: Number,
        default: 50
    },
    teacherId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    cycle: {
        capacity: { type: Number },
        currentCycleNumber: { type: Number, default: 1 },
        currentSessionNumber: { type: Number, default: 0 }, // 0 means cycle hasn't started yet
        startedAt: { type: Date }
    }
}, {
    timestamps: true
});

export const GroupModel: Model<IGroup> = mongoose.model<IGroup>('Group', groupSchema);
