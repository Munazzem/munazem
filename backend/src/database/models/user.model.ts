import mongoose, { Schema, Model } from "mongoose";
import type { IUserDocument } from ".././../types/user.types.js";
import {
    UserRole,
    SubscriptionStatus,
} from "../../common/enums/enum.service.js";

const userSchema = new Schema<IUserDocument>(
    {
    name: {
        type: String,
        required: [true, "الاسم مطلوب"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "البريد الإلكتروني مطلوب"],
        unique: true,
        index: true,
    },
    phone: {
        type: String,
        required: [true, "رقم الهاتف مطلوب"],
        unique: true,
        index: true,
    },
    password: {
        type: String,
        required: [true, "كلمة المرور مطلوبة"],
        minlength: [6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"],
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.teacher,
    },
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
    subscription: {
    status: {
        type: String,
        enum: Object.values(SubscriptionStatus),
        default: SubscriptionStatus.active,
    },
    expiryDate: {
        type: Date,
        default: null,
    },
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    },
    {
    timestamps: true,
    },
);

export const UserModel: Model<IUserDocument> =
    mongoose.models.User || mongoose.model<IUserDocument>("User", userSchema);
