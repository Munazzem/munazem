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
    customPrice?: number | null;  // Optional override: null or undefined → fallback to grade-level price
    cycle?: {
        capacity: number;
        currentCycleNumber: number;
        currentSessionNumber: number;
        startedAt: Date;
        priceSnapshot?: Map<string, number>;
    };
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IGroupDocument extends IGroup, Document {}
