import mongoose, { Schema, Model } from 'mongoose';
import { GradeLevel } from '../../common/enums/enum.service.js';
const groupSchema = new Schema({
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
    }
}, {
    timestamps: true
});
export const GroupModel = mongoose.model('Group', groupSchema);
//# sourceMappingURL=group.model.js.map