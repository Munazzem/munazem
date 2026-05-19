// ── Daily Summary ───────────────────────────────────────────────────

export interface IDailySummary {
    date:               string;
    sessionsCount:      number;
    totalPresent:       number;
    subscriptionsCount: number;
    financial: {
        totalIncome:   number;
        totalExpenses: number;
        netBalance:    number;
    };
}

// ── Unpaid Students ─────────────────────────────────────────────────

export interface IUnpaidStudentsReport {
    month:       string;
    totalActive: number;
    unpaidCount: number;
    paidCount:   number;
    students:    Array<{
        _id:         string;
        studentName: string;
        gradeLevel:  string;
        studentCode: string;
        groupId?:    { _id: string; name: string } | string;
    }>;
}
