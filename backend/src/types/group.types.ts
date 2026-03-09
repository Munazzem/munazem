import { Document, Types } from 'mongoose';
import { GradeLevel } from '../common/enums/enum.service.js';

export interface ISchedule {
    day: string;
    time: string;
}

export interface IGroup {
    name: string;
    gradeLevel: GradeLevel;
    schedule: ISchedule[];
    capacity?: number;
    teacherId: Types.ObjectId;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IGroupDocument extends IGroup, Document {}
