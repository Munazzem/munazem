import { Document, Types } from 'mongoose';
import { GradeLevel } from '../common/enums/enum.service.js';
export interface IPriceSetting {
    gradeLevel: GradeLevel;
    amount: number;
}
export interface IPriceSettings {
    teacherId: Types.ObjectId;
    prices: IPriceSetting[];
    updatedAt?: Date;
    createdAt?: Date;
}
export interface IPriceSettingsDocument extends IPriceSettings, Document {
}
//# sourceMappingURL=price-settings.types.d.ts.map