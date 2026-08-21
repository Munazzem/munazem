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

export interface ICycleEnrollmentInfo {
    _id: string;
    cycleNumber: number;
    cycleCapacity: number;
    pricePerSession: number;
    fullCyclePrice: number;
    startSession: number;
    chargeableSessions: number;
    cycleCharge: number;
    totalPaid: number;
    remainingAmount: number;
    status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
    isCurrentCycle: boolean;
    isPastCycle: boolean;
    createdAt?: string;
}
