import { Document, Types } from 'mongoose';
import { CycleEnrollmentStatus } from '../common/enums/enum.service.js';

export interface ICycleEnrollment {
    studentId: Types.ObjectId;
    groupId: Types.ObjectId;
    teacherId: Types.ObjectId;
    cycleNumber: number;

    // Cycle Configuration Snapshot
    cycleCapacity: number;
    pricePerSession: number;
    fullCyclePrice: number;

    // Enrollment details
    startSession: number;
    chargeableSessions: number;
    cycleCharge: number;

    // Payment tracking
    totalPaid: number;
    remainingAmount: number;
    status: CycleEnrollmentStatus;

    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICycleEnrollmentDocument extends ICycleEnrollment, Document {}
