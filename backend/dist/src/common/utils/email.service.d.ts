export interface WeeklyReportData {
    teacherName: string;
    teacherEmail: string;
    weekStart: string;
    weekEnd: string;
    incomeSubscriptions: number;
    incomeNotebooks: number;
    incomeOther: number;
    totalIncome: number;
    expenseSalaries: number;
    expenseRent: number;
    expenseOther: number;
    totalExpenses: number;
    netBalance: number;
    completedSessions: number;
    cancelledSessions: number;
    totalStudents: number;
    unpaidStudents: number;
}
export declare function sendWeeklyReportEmail(data: WeeklyReportData): Promise<boolean>;
//# sourceMappingURL=email.service.d.ts.map