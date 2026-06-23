import { Document, Types } from 'mongoose';
import { SessionStatus } from '../common/enums/enum.service.js';
export interface ISession {
    groupId: Types.ObjectId;
    teacherId: Types.ObjectId;
    date: Date;
    startTime: string;
    status: SessionStatus;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface ISessionDocument extends ISession, Document {
}
//# sourceMappingURL=session.types.d.ts.map