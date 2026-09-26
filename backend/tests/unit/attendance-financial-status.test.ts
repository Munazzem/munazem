import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '../../src/modules/attendance/attendance.service.js';
import { SessionModel } from '../../src/database/models/session.model.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { GroupModel } from '../../src/database/models/group.model.js';
import { AttendanceModel } from '../../src/database/models/attendance.model.js';
import { CycleEnrollmentModel } from '../../src/database/models/cycle-enrollment.model.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { SessionStatus, AttendanceStatus, CycleEnrollmentStatus } from '../../src/common/enums/enum.service.js';

describe('AttendanceService.recordAttendance - Financial Status Cues', () => {
    const fakeTeacherId = '660d1b2e4f1a2b3c4d5e6f7a';
    const fakeSessionId = '660d1b2e4f1a2b3c4d5e6f7b';
    const fakeStudentId = '660d1b2e4f1a2b3c4d5e6f7c';
    const fakeGroupId = '660d1b2e4f1a2b3c4d5e6f7d';

    beforeEach(() => {
        vi.restoreAllMocks();

        // Mock Session
        vi.spyOn(SessionModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: fakeSessionId,
                teacherId: fakeTeacherId,
                groupId: fakeGroupId,
                date: new Date(),
                status: SessionStatus.IN_PROGRESS,
            }),
        } as any);

        // Mock Session Group
        vi.spyOn(GroupModel, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: fakeGroupId,
                gradeLevel: 'FIRST_SEC',
                customPrice: 300,
                cycle: {
                    currentCycleNumber: 1,
                },
            }),
        } as any);

        // Mock Attendance findOne (no duplicate)
        vi.spyOn(AttendanceModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        } as any);

        // Mock Attendance create
        vi.spyOn(AttendanceModel, 'create').mockImplementation((data: any) => Promise.resolve({
            ...data,
            _id: 'fake-attendance-id',
            toObject: () => ({ ...data, _id: 'fake-attendance-id' }),
        }) as any);

        // Mock User for push notification
        vi.spyOn(UserModel, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue({ name: 'أستاذ محمد', subject: 'رياضيات' }),
        } as any);
    });

    it('يرجع hasOutstandingFees: false إذا كان الطالب مخلصاً لمديونيته ومسدداً للدورة الحالية', async () => {
        // Student with 0 debt
        vi.spyOn(StudentModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: fakeStudentId,
                studentName: 'أحمد محمد',
                studentCode: 'ST-101',
                gradeLevel: 'FIRST_SEC',
                groupId: fakeGroupId,
                totalDebt: 0,
                teacherId: fakeTeacherId,
            }),
        } as any);

        // Current cycle enrollment is PAID
        vi.spyOn(CycleEnrollmentModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                status: CycleEnrollmentStatus.PAID,
                remainingAmount: 0,
                cycleCharge: 300,
            }),
        } as any);

        const result: any = await AttendanceService.recordAttendance(
            fakeTeacherId,
            { sessionId: fakeSessionId, studentId: fakeStudentId, status: AttendanceStatus.PRESENT },
            fakeTeacherId
        );

        expect(result.financialStatus).toBeDefined();
        expect(result.financialStatus.hasOutstandingFees).toBe(false);
        expect(result.financialStatus.totalDebt).toBe(0);
        expect(result.financialStatus.hasPaidCurrentCycle).toBe(true);
        expect(result.financialStatus.debtAmount).toBe(0);
    });

    it('يرجع hasOutstandingFees: true والمبلغ المستحق إذا كان على الطالب مديونية تراكمية (totalDebt > 0)', async () => {
        // Student with 250 EGP debt
        vi.spyOn(StudentModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: fakeStudentId,
                studentName: 'محمود خالد',
                studentCode: 'ST-102',
                gradeLevel: 'FIRST_SEC',
                groupId: fakeGroupId,
                totalDebt: 250,
                teacherId: fakeTeacherId,
            }),
        } as any);

        // Current cycle enrollment is PAID
        vi.spyOn(CycleEnrollmentModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                status: CycleEnrollmentStatus.PAID,
                remainingAmount: 0,
                cycleCharge: 300,
            }),
        } as any);

        const result: any = await AttendanceService.recordAttendance(
            fakeTeacherId,
            { sessionId: fakeSessionId, studentId: fakeStudentId, status: AttendanceStatus.PRESENT },
            fakeTeacherId
        );

        expect(result.financialStatus).toBeDefined();
        expect(result.financialStatus.hasOutstandingFees).toBe(true);
        expect(result.financialStatus.totalDebt).toBe(250);
        expect(result.financialStatus.debtAmount).toBe(250);
    });

    it('يرجع hasOutstandingFees: true إذا لم يسدد الطالب اشتراك الدورة الحالية (UNPAID)', async () => {
        // Student with 0 past debt but UNPAID current cycle
        vi.spyOn(StudentModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: fakeStudentId,
                studentName: 'كريم علي',
                studentCode: 'ST-103',
                gradeLevel: 'FIRST_SEC',
                groupId: fakeGroupId,
                totalDebt: 0,
                teacherId: fakeTeacherId,
            }),
        } as any);

        // Current cycle enrollment is UNPAID with 300 EGP remaining
        vi.spyOn(CycleEnrollmentModel, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                status: CycleEnrollmentStatus.UNPAID,
                remainingAmount: 300,
                cycleCharge: 300,
            }),
        } as any);

        const result: any = await AttendanceService.recordAttendance(
            fakeTeacherId,
            { sessionId: fakeSessionId, studentId: fakeStudentId, status: AttendanceStatus.PRESENT },
            fakeTeacherId
        );

        expect(result.financialStatus).toBeDefined();
        expect(result.financialStatus.hasOutstandingFees).toBe(true);
        expect(result.financialStatus.hasPaidCurrentCycle).toBe(false);
        expect(result.financialStatus.debtAmount).toBe(300);
    });
});
