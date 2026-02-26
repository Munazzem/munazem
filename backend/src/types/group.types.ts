import { Document, Types } from 'mongoose';

export interface ISchedule {
    day: string;
    time: string;
}

export interface IGroup {
    name: string;
    gradeLevel: string;
    schedule: ISchedule[];
    capacity?: number;
    teacherId: Types.ObjectId;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IGroupDocument extends IGroup, Document {}
