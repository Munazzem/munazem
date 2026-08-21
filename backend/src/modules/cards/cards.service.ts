import crypto from 'crypto';
import mongoose from 'mongoose';
import { CardModel }    from '../../database/models/card.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { GroupModel }   from '../../database/models/group.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { nextSequenceBulk } from '../../database/models/counter.model.js';
import { TransactionType } from '../../common/enums/enum.service.js';
import {
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '../../common/utils/response/error.responce.js';
import { cache, CacheKeys, CacheTTL } from '../../infrastructure/cache/cache.service.js';
import type {
    GenerateBatchDTO,
    LinkCardDTO,
    DisableCardDTO,
    ReplaceCardDTO,
    CardResolveResult,
    StudentQuickSummary,
    BatchGenerateResult,
} from '../../types/card.types.js';

export class CardsService {

    // ─── Generate a batch of blank cards ──────────────────────────────────────
    static async generateBatch(teacherId: string, dto: GenerateBatchDTO): Promise<BatchGenerateResult> {
        const { count } = dto;

        // Generate a unique batchId for this print run
        const batchId = crypto.randomUUID();

        // Build the teacher's short identifier (first 4 hex chars of their Mongo ObjectId)
        const teacherShort = teacherId.slice(-4).toUpperCase();
        const counterKey   = `cards:${teacherId}`;

        // Reserve a sequential range atomically (1 query)
        const firstSeq = await nextSequenceBulk(counterKey, count);

        // Build all card documents in memory
        const docs = Array.from({ length: count }, (_, i) => {
            const seq        = firstSeq + i;
            const cardNumber = `MNZ-${teacherShort}-${String(seq).padStart(5, '0')}`;
            const cardToken  = crypto.randomUUID();
            return { cardNumber, cardToken, teacherId: new mongoose.Types.ObjectId(teacherId), batchId, status: 'NEW' as const };
        });

        const created = await CardModel.insertMany(docs);

        return {
            batchId,
            count: created.length,
            cards: created.map(c => ({ cardNumber: c.cardNumber, cardToken: c.cardToken })),
        };
    }

    // ─── Unified resolution: card token → student summary ─────────────────────
    // Used by the parent portal (no auth — public access via cardToken)
    static async resolveByToken(cardToken: string): Promise<StudentQuickSummary> {
        const card = await CardModel.findOne({ cardToken, status: 'LINKED' }).lean();
        if (!card || !card.studentId) {
            throw NotFoundException({ message: 'الكارت غير موجود أو غير مربوط بطالب' });
        }
        return CardsService._buildStudentSummary(card.studentId.toString());
    }

    // ─── Unified resolution: any scan input → card + student summary ───────────
    // Accepts: cardToken (from QR URL), cardNumber, student.barcode, student.studentCode
    // Used by the Smart Card page scanner (authenticated — scoped to teacherId)
    static async resolveCard(rawInput: string, teacherId: string): Promise<CardResolveResult> {
        // Strip full URL prefix if scanning a QR that contains the app URL
        // e.g. "https://monazem.app/card/uuid-here" → "uuid-here"
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const uuidMatch = rawInput.match(uuidRegex);
        const looksLikeToken = uuidMatch !== null;
        const resolvedInput  = looksLikeToken ? uuidMatch![0]! : rawInput.trim();

        // ── Priority 1: Card Collection — by cardToken (from QR URL) ────────────
        if (looksLikeToken) {
            const card = await CardModel.findOne({ cardToken: resolvedInput, teacherId: new mongoose.Types.ObjectId(teacherId) }).lean();
            if (card) {
                if (card.status === 'DISABLED') {
                    throw BadRequestException({ message: 'هذا الكارت معطل — يرجى استبداله أو التواصل مع إدارة المنصة' });
                }
                if (card.status === 'NEW') {
                    // Return minimal info to trigger the linking flow on the frontend
                    return {
                        source:     'card',
                        cardStatus: 'NEW',
                        cardNumber: card.cardNumber,
                        student:    null as any, // frontend checks cardStatus=NEW and shows link modal
                    };
                }
                // LINKED
                const student = await CardsService._buildStudentSummary(card.studentId!.toString(), teacherId);
                return { source: 'card', cardStatus: 'LINKED', cardNumber: card.cardNumber, student };
            }
        }

        // ── Priority 2: Card Collection — by cardNumber (manual entry fallback) ─
        const cardByNumber = await CardModel.findOne({ cardNumber: resolvedInput, teacherId: new mongoose.Types.ObjectId(teacherId) }).lean();
        if (cardByNumber) {
            if (cardByNumber.status === 'DISABLED') {
                throw BadRequestException({ message: 'هذا الكارت معطل' });
            }
            if (cardByNumber.status === 'NEW') {
                return { source: 'card', cardStatus: 'NEW', cardNumber: cardByNumber.cardNumber, student: null as any };
            }
            const student = await CardsService._buildStudentSummary(cardByNumber.studentId!.toString(), teacherId);
            return { source: 'card', cardStatus: 'LINKED', cardNumber: cardByNumber.cardNumber, student };
        }

        // ── Priority 3: Student.barcode (existing QR codes from before this feature) ─
        const studentByBarcode = await StudentModel.findOne({ barcode: resolvedInput, teacherId }).lean();
        if (studentByBarcode) {
            const student = await CardsService._buildStudentSummary(studentByBarcode._id.toString(), teacherId);
            return { source: 'barcode', cardStatus: null, cardNumber: null, student };
        }

        // ── Priority 4: Student.studentCode (manual code input fallback) ──────────
        const studentByCode = await StudentModel.findOne({ studentCode: resolvedInput, teacherId }).lean();
        if (studentByCode) {
            const student = await CardsService._buildStudentSummary(studentByCode._id.toString(), teacherId);
            return { source: 'studentCode', cardStatus: null, cardNumber: null, student };
        }

        throw NotFoundException({ message: 'لم يتم التعرف على هذا الكارت أو الكود — تأكد من أن الكارت مضاف للنظام' });
    }

    // ─── Link a card to a student ──────────────────────────────────────────────
    static async linkCard(dto: LinkCardDTO, teacherId: string, linkedBy: string) {
        const { cardNumber, studentId } = dto;

        const [card, student] = await Promise.all([
            CardModel.findOne({ cardNumber, teacherId }).lean(),
            StudentModel.findOne({ _id: studentId, teacherId }).lean(),
        ]);

        if (!card)    throw NotFoundException({ message: 'الكارت غير موجود أو لا صلاحية لك عليه' });
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });
        if (card.status === 'DISABLED') throw BadRequestException({ message: 'هذا الكارت معطل ولا يمكن ربطه' });
        if (card.status === 'LINKED')   throw ConflictException({ message: `الكارت مربوط بالفعل بالطالب: ${(card as any).studentName || ''}` });

        // Check student doesn't already have an active card
        const existingCard = await CardModel.findOne({ studentId: new mongoose.Types.ObjectId(studentId), status: 'LINKED', teacherId }).lean();
        if (existingCard) {
            throw ConflictException({ message: `هذا الطالب مربوط بالفعل بكارت: ${existingCard.cardNumber}` });
        }

        const updated = await CardModel.findOneAndUpdate(
            { cardNumber, teacherId },
            {
                studentId:  new mongoose.Types.ObjectId(studentId),
                status:     'LINKED',
                linkedAt:   new Date(),
                linkedBy:   new mongoose.Types.ObjectId(linkedBy),
            },
            { new: true }
        ).lean();

        // Invalidate cache if any
        await cache.del(CacheKeys.card(cardNumber));

        return updated;
    }

    // ─── Unlink a card from its student ───────────────────────────────────────
    static async unlinkCard(cardNumber: string, teacherId: string) {
        const card = await CardModel.findOne({ cardNumber, teacherId }).lean();
        if (!card) throw NotFoundException({ message: 'الكارت غير موجود' });
        if (card.status !== 'LINKED') throw BadRequestException({ message: 'الكارت غير مربوط بأي طالب' });

        const updated = await CardModel.findOneAndUpdate(
            { cardNumber, teacherId },
            { studentId: null, status: 'NEW', linkedAt: null, linkedBy: null },
            { new: true }
        ).lean();

        await cache.del(CacheKeys.card(cardNumber));
        return updated;
    }

    // ─── Disable a card (LOST / DAMAGED / MANUAL) ─────────────────────────────
    static async disableCard(dto: DisableCardDTO, teacherId: string, disabledBy: string) {
        const { cardNumber, reason } = dto;
        const card = await CardModel.findOne({ cardNumber, teacherId }).lean();
        if (!card)                       throw NotFoundException({ message: 'الكارت غير موجود' });
        if (card.status === 'DISABLED')  throw BadRequestException({ message: 'الكارت معطل بالفعل' });

        const updated = await CardModel.findOneAndUpdate(
            { cardNumber, teacherId },
            {
                status:         'DISABLED',
                disabledAt:     new Date(),
                disabledReason: reason,
                disabledBy:     new mongoose.Types.ObjectId(disabledBy),
            },
            { new: true }
        ).lean();

        await cache.del(CacheKeys.card(cardNumber));
        return updated;
    }

    // ─── Replace a card: disable old → link new to same student ───────────────
    static async replaceCard(dto: ReplaceCardDTO, teacherId: string, replacedBy: string) {
        const { oldCardNumber, newCardNumber } = dto;

        const [oldCard, newCard] = await Promise.all([
            CardModel.findOne({ cardNumber: oldCardNumber, teacherId }).lean(),
            CardModel.findOne({ cardNumber: newCardNumber, teacherId }).lean(),
        ]);

        if (!oldCard) throw NotFoundException({ message: 'الكارت القديم غير موجود' });
        if (!newCard) throw NotFoundException({ message: 'الكارت الجديد غير موجود' });
        if (oldCard.status !== 'LINKED') throw BadRequestException({ message: 'الكارت القديم غير مربوط بطالب' });
        if (newCard.status !== 'NEW')    throw BadRequestException({ message: 'الكارت الجديد يجب أن يكون جديداً (NEW)' });

        const studentId = oldCard.studentId;
        const now = new Date();

        // Disable old + link new in parallel
        await Promise.all([
            CardModel.findOneAndUpdate(
                { cardNumber: oldCardNumber, teacherId },
                { status: 'DISABLED', disabledAt: now, disabledReason: 'MANUAL', disabledBy: new mongoose.Types.ObjectId(replacedBy) }
            ),
            CardModel.findOneAndUpdate(
                { cardNumber: newCardNumber, teacherId },
                { studentId, status: 'LINKED', linkedAt: now, linkedBy: new mongoose.Types.ObjectId(replacedBy) }
            ),
        ]);

        await Promise.all([
            cache.del(CacheKeys.card(oldCardNumber)),
            cache.del(CacheKeys.card(newCardNumber)),
        ]);

        return { message: `تم نقل الكارت من ${oldCardNumber} إلى ${newCardNumber} بنجاح` };
    }

    // ─── Get cards list for teacher ────────────────────────────────────────────
    static async getCards(teacherId: string, query: any) {
        const filter: any = { teacherId: new mongoose.Types.ObjectId(teacherId) };
        if (query.status)  filter.status  = query.status;
        if (query.batchId) filter.batchId = query.batchId;

        const page  = Math.max(1, parseInt(query.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
        const skip  = (page - 1) * limit;

        const [cards, total] = await Promise.all([
            CardModel.find(filter)
                .populate('studentId', 'studentName studentCode gradeLevel')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            CardModel.countDocuments(filter),
        ]);

        return {
            data: cards,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // ─── Get quick stats ───────────────────────────────────────────────────────
    static async getCardStats(teacherId: string) {
        const stats = await CardModel.aggregate([
            { $match: { teacherId: new mongoose.Types.ObjectId(teacherId) } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const result = { NEW: 0, LINKED: 0, DISABLED: 0, total: 0 };
        for (const s of stats) {
            if (s._id === 'NEW')      result.NEW      = s.count;
            if (s._id === 'LINKED')   result.LINKED   = s.count;
            if (s._id === 'DISABLED') result.DISABLED = s.count;
            result.total += s.count;
        }
        return result;
    }

    // ─── Private: Build student quick summary ──────────────────────────────────
    private static async _buildStudentSummary(studentId: string, teacherId?: string): Promise<StudentQuickSummary> {
        const filter: any = { _id: studentId };
        if (teacherId) filter.teacherId = teacherId;

        const student = await StudentModel.findOne(filter, {
            studentName: 1, studentCode: 1, gradeLevel: 1, teacherId: 1,
            groupId: 1, totalDebt: 1, isActive: 1
        }).lean();

        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        // Group name and cycle
        const group = await GroupModel.findById(student.groupId, { name: 1, cycle: 1 }).lean();

        // Last attendance (from snapshot model — fast read)
        const lastSnapshot = await AttendanceSnapshotModel.findOne({
            teacherId: student.teacherId ?? (teacherId ? new mongoose.Types.ObjectId(teacherId) : undefined),
            $or: [
                { 'presentStudents.studentId': student._id },
                { 'absentStudents.studentId':  student._id },
                { 'guestStudents.studentId':   student._id },
            ],
        }).sort({ date: -1 }).lean() as any;

        let lastAttendanceDate:   string | null = null;
        let lastAttendanceStatus: string | null = null;

        if (lastSnapshot) {
            const sid = student._id.toString();
            const isPresent = lastSnapshot.presentStudents?.some((s: any) => s.studentId.toString() === sid);
            const isGuest   = lastSnapshot.guestStudents?.some((s: any) => s.studentId.toString() === sid);
            lastAttendanceDate   = lastSnapshot.date?.toISOString() ?? null;
            lastAttendanceStatus = isPresent ? 'PRESENT' : isGuest ? 'GUEST' : 'ABSENT';
        }

        // Last payment
        const lastTx = await TransactionModel.findOne(
            { studentId: student._id, type: TransactionType.INCOME },
            { paidAmount: 1, date: 1 }
        ).sort({ date: -1 }).lean();

        // Payment status based on group cycle
        const cycleStartedAt = (group as any)?.cycle?.startedAt || new Date('2099-01-01');
        const hasActiveSubscription = await TransactionModel.exists({
            studentId: student._id,
            category: 'SUBSCRIPTION',
            type: 'INCOME',
            date: { $gte: cycleStartedAt }
        });

        return {
            studentId:             student._id.toString(),
            studentName:           student.studentName,
            studentCode:           student.studentCode,
            gradeLevel:            student.gradeLevel,
            groupId:               student.groupId?.toString() ?? '',
            groupName:             (group as any)?.name ?? '—',
            remainingSessions:     0, // Deprecated
            cycleCapacity:         (group as any)?.cycle?.capacity ?? 8,
            cycleNumber:           (group as any)?.cycle?.currentCycleNumber ?? 0,
            totalDebt:             student.totalDebt ?? 0,
            hasActiveSubscription: !!hasActiveSubscription,
            lastAttendanceDate,
            lastAttendanceStatus,
            lastPaymentDate:   lastTx ? (lastTx as any).date?.toISOString() : null,
            lastPaymentAmount: lastTx ? (lastTx as any).paidAmount : null,
            isActive:          student.isActive ?? true,
        };
    }
}
