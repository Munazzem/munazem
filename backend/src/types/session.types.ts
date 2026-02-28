import { Document, Types } from 'mongoose';
import { SessionStatus } from '../common/enums/enum.service.js';

export interface ISession {
    groupId:    Types.ObjectId;
    teacherId:  Types.ObjectId;      // denormalized — avoids extra join on every query
    date:       Date;
    startTime:  string;              // "10:00" in 24h format
    status:     SessionStatus;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ISessionDocument extends ISession, Document {}
