import { Document, Types } from 'mongoose';
import { GradeLevel } from '../common/enums/enum.service.js';

export interface INotebook {
    teacherId:      Types.ObjectId;
    name:           string;           
    gradeLevel:     GradeLevel;       
    price:          number;           
    stock:          number;           
    reservedCount:  number;           
    createdAt?:     Date;
    updatedAt?:     Date;
}

export interface INotebookDocument extends INotebook, Document {}
