import mongoose, { Schema, Model } from 'mongoose';
import type { IStudent } from '../../types/student.types.js'
import { GradeLevel } from '../../common/enums/enum.service.js';

const studentSchema = new Schema<IStudent>({
    studentName: { 
        type: String, 
        required: [true, 'اسم الطالب مطلوب'],
        trim: true
    },
    parentName: { 
        type: String, 
        required: [true, 'اسم ولي الأمر مطلوب'],
        trim: true
    },
    studentPhone: { 
        type: String, 
        required: [true, 'رقم هاتف الطالب مطلوب'],
        index: true
    },
    parentPhone: { 
        type: String, 
        required: [true, 'رقم هاتف ولي الأمر مطلوب']
    },
    gradeLevel: { 
        type: String, 
        enum: Object.values(GradeLevel),
        required: [true, 'المرحلة الدراسية مطلوبة'] 
    },
    studentCode: { 
        type: String, 
        required: [true, 'كود الطالب مطلوب'],
        index: true 
    },
    barcode: { 
        type: String, 
        unique: true, 
        sparse: true, // sparse allows multiple null values if barcodes are generated later
        index: true 
    },
    groupId: { 
        type: Schema.Types.ObjectId, 
        ref: 'Group', 
        required: [true, 'يجب تحديد المجموعة للطالب'],
        index: true
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

// Compound index to ensure a student phone is unique per teacher (a student can't be added twice to the same teacher)
studentSchema.index({ studentPhone: 1, teacherId: 1 }, { unique: true });
// Ensure student code is unique per teacher system
studentSchema.index({ studentCode: 1, teacherId: 1 }, { unique: true });

export const StudentModel: Model<IStudent> = mongoose.model<IStudent>('Student', studentSchema);
