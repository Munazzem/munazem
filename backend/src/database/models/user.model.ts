import mongoose, { Schema, Model } from "mongoose";
import type { IUserDocument } from "../../types/user.types.js";
import { UserRole, TeacherStage } from "../../common/enums/enum.service.js";

const userSchema = new Schema<IUserDocument>(
    {
        name: {
            type: String,
            required: [true, "الاسم مطلوب"],
            trim: true,
        },
        email: {
            type: String,
            required: false,
            unique: true,
            sparse: true,
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
            select: false,
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
        // stage — required for teachers: determines allowed grade levels (PREPARATORY | SECONDARY)
        stage: {
            type:    String,
            enum:    [...Object.values(TeacherStage), null],
            default: null,
        },
        // Monthly salary — only relevant for assistants
        salary: {
            type:    Number,
            default: null,
            min:     0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        centerName: {
            type: String,
            trim: true,
        },
        logoUrl: {
            type: String,
        },
    },
    {
        timestamps: true,
    },
);

userSchema.index({ teacherId: 1, role: 1, isActive: 1 });

export const UserModel: Model<IUserDocument> =
    mongoose.models.User || mongoose.model<IUserDocument>("User", userSchema);
