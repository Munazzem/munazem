export declare class ParentService {
    static lookupByPhone(parentPhone: string): Promise<{
        studentId: any;
        studentName: any;
        studentCode: any;
        gradeLevel: any;
        groupName: string;
        isActive: any;
        hasActiveSubscription: boolean;
        attendance: {
            totalSessions: number;
            presentCount: number;
            absentCount: number;
            attendanceRate: string;
            history: {
                date: any;
                status: string;
            }[];
        };
        payments: {
            totalPaid: number;
            subscriptionsCount: number;
            lastSubscriptions: (import("../../types/transaction.types.js").ITransactionDocument & Required<{
                _id: import("mongoose").Types.ObjectId;
            }> & {
                __v: number;
            })[];
        };
        exams: (import("../../types/exam-result.types.js").IExamResultDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
    }[]>;
    private static buildStudentSummary;
}
//# sourceMappingURL=parent.service.d.ts.map