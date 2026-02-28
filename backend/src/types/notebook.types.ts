import { Document, Types } from 'mongoose';
import { GradeLevel } from '../common/enums/enum.service.js';

export interface INotebook {
    teacherId:   Types.ObjectId;
    name:        string;           // اسم المذكرة
    gradeLevel:  GradeLevel;       // المرحلة المرتبطة بها
    price:       number;           // سعر البيع
    stock:       number;           // الكمية الحالية في المخزن
    createdAt?:  Date;
    updatedAt?:  Date;
}

export interface INotebookDocument extends INotebook, Document {}
