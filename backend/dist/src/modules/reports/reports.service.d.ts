import mongoose from 'mongoose';
import { UserRole, AttendanceStatus } from '../../common/enums/enum.service.js';
export declare class ReportsService {
    static getStudentReport(studentId: string, teacherId: string): Promise<{
        student: {
            groupName: string;
            barcodeImageBase64: string;
            hasActiveSubscription: boolean;
            monthlySessionsQuota: number;
            remainingSessions: any;
            usedSessionsThisMonth: number;
            monthlySessions: {
                sessionId: mongoose.Types.ObjectId;
                date: Date;
                status: AttendanceStatus;
            }[];
            manualRecordsCount: number;
            studentName: string;
            parentName: string;
            studentPhone: string;
            parentPhone: string;
            gradeLevel: import("../../common/enums/enum.service.js").GradeLevel;
            studentCode: string;
            barcode?: string;
            groupId: mongoose.Types.ObjectId;
            teacherId: mongoose.Types.ObjectId;
            isActive: boolean;
            excusedUntil?: Date;
            excusedSessionsCount?: number;
            createdAt?: Date;
            updatedAt?: Date;
            _id: mongoose.Types.ObjectId;
            __v: number;
        };
        attendance: {
            totalSessions: any;
            presentCount: any;
            absentCount: any;
            attendanceRate: string;
            history: {
                date: any;
                status: string;
            }[];
        };
        payments: {
            totalPaid: any;
            totalDiscount: any;
            subscriptionsCount: any;
            notebookSalesCount: any;
            history: (import("../../types/transaction.types.js").ITransactionDocument & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
        };
    }>;
    static getGroupReport(groupId: string, teacherId: string): Promise<{
        group: {
            name: string;
            gradeLevel: import("../../common/enums/enum.service.js").GradeLevel;
            schedule: import("../../types/group.types.js").ISchedule[];
            totalStudents: number;
        };
        attendance: {
            totalSessions: any;
            avgAttendanceRate: string;
            totalPresences: any;
            totalAbsences: any;
            sessionsHistory: (import("../../types/attendance-snapshot.types.js").IAttendanceSnapshotDocument & Required<{
                _id: mongoose.Types.ObjectId;
            }> & {
                __v: number;
            })[];
        };
        revenue: {
            breakdown: any[];
        };
    }>;
    static getFinancialMonthlyReport(teacherId: string, year: number, month: number): Promise<{
        year: number;
        month: number;
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
        dailySummaries: import("../../types/ledger.types.js").IDailySummary[];
        breakdown: any[];
    }>;
    static getDashboardSummary(teacherId: string, role: UserRole): Promise<any>;
    static getDailySummary(teacherId: string, dateStr?: string): Promise<{
        date: string;
        sessionsCount: number;
        totalPresent: number;
        subscriptionsCount: number;
        financial: {
            totalIncome: number;
            totalExpenses: number;
            netBalance: number;
        };
    }>;
    static getUnpaidStudents(teacherId: string, includeList?: boolean): Promise<{
        students: (import("../../types/student.types.js").IStudent & {
            _id: mongoose.Types.ObjectId;
        } & {
            __v: number;
        })[];
        month: string;
        totalActive: number;
        unpaidCount: number;
        paidCount: number;
    }>;
}
//# sourceMappingURL=reports.service.d.ts.map