import mongoose, { Schema, Model } from 'mongoose';
import type { INotebookDocument } from '../../types/notebook.types.js';
import { GradeLevel } from '../../common/enums/enum.service.js';

const notebookSchema = new Schema<INotebookDocument>({
    teacherId: {
        type:     Schema.Types.ObjectId,
        ref:      'User',
        required: true,
        index:    true,
    },
    name: {
        type:     String,
        required: [true, 'اسم المذكرة مطلوب'],
        trim:     true,
    },
    gradeLevel: {
        type:     String,
        enum:     Object.values(GradeLevel),
        required: [true, 'المرحلة الدراسية مطلوبة'],
        index:    true,
    },
    price: {
        type:     Number,
        required: [true, 'السعر مطلوب'],
        min:      [0, 'السعر لا يمكن أن يكون سالباً'],
    },
    stock: {
        type:    Number,
        default: 0,
        min:     [0, 'الكمية لا يمكن أن تكون سالبة'],
    },
}, {
    timestamps: true,
});

// Unique: same notebook name per teacher per grade
notebookSchema.index({ teacherId: 1, name: 1, gradeLevel: 1 }, { unique: true });

export const NotebookModel: Model<INotebookDocument> =
    mongoose.model<INotebookDocument>('Notebook', notebookSchema);
