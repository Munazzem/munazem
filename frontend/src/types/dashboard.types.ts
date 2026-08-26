/**
 * Dashboard Types
 * Defines the structure for the main dashboard overview page.
 */

export interface DashboardData {
    totalStudents: number;
    activeStudents?: number;
    totalGroups: number;
    todaySessionsCount?: number;
    sessionsThisMonth: number;
    notebooks?: {
        totalQuantity: number;
        totalRevenue: number;
    };
    subscriptions?: {
        totalCount: number;
        totalRevenue: number;
    };
    financial?: {
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
    };
    charts?: {
        incomeTrend: { month: string; income: number }[];
        studentsPerGroup: { groupName: string; studentCount: number }[];
        expensesBreakdown: { name: string; value: number }[];
        attendanceTrend?: { date: string; present?: number; absent?: number; rate?: number }[];
    };
    recentActivities?: {
        type: string;
        category: string;
        paidAmount: number;
        studentName?: string;
        description?: string;
        time: string;
    }[];
    message?: string;
}
