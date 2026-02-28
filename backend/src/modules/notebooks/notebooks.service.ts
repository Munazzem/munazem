import { NotebookModel } from '../../database/models/notebook.model.js';
import { GradeLevel } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';

export interface CreateNotebookDTO {
    name:       string;
    gradeLevel: GradeLevel;
    price:      number;
    stock?:     number;
}

export interface UpdateNotebookDTO {
    name?:       string;
    gradeLevel?: GradeLevel;
    price?:      number;
}

export class NotebooksService {

    // ── Create ──────────────────────────────────────────────────────
    static async createNotebook(teacherId: string, data: CreateNotebookDTO) {
        try {
            return await NotebookModel.create({ ...data, teacherId, stock: data.stock ?? 0 });
        } catch (error: any) {
            if (error.code === 11000) {
                throw ConflictException({ message: 'يوجد مذكرة بنفس الاسم لهذه المرحلة بالفعل' });
            }
            throw error;
        }
    }

    // ── List — with optional gradeLevel filter ──────────────────────
    static async getNotebooks(teacherId: string, queryFilters: any = {}) {
        const filter: any = { teacherId };
        if (queryFilters.gradeLevel) filter.gradeLevel = queryFilters.gradeLevel;

        const page  = Math.max(1, parseInt(queryFilters.page)  || 1);
        const limit = Math.min(100, Math.max(1, parseInt(queryFilters.limit) || 50));
        const skip  = (page - 1) * limit;

        const [data, total] = await Promise.all([
            NotebookModel.find(filter).sort({ gradeLevel: 1, name: 1 }).skip(skip).limit(limit).lean(),
            NotebookModel.countDocuments(filter),
        ]);

        return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    // ── Get single ──────────────────────────────────────────────────
    static async getNotebookById(notebookId: string, teacherId: string) {
        const nb = await NotebookModel.findOne({ _id: notebookId, teacherId }).lean();
        if (!nb) throw NotFoundException({ message: 'المذكرة غير موجودة' });
        return nb;
    }

    // ── Update details (name, gradeLevel, price) ────────────────────
    static async updateNotebook(notebookId: string, teacherId: string, data: UpdateNotebookDTO) {
        const nb = await NotebookModel.findOneAndUpdate(
            { _id: notebookId, teacherId },
            data,
            { new: true, runValidators: true }
        ).lean();
        if (!nb) throw NotFoundException({ message: 'المذكرة غير موجودة' });
        return nb;
    }

    // ── Add stock (restock) ─────────────────────────────────────────
    static async addStock(notebookId: string, teacherId: string, quantity: number) {
        if (quantity <= 0) throw BadRequestException({ message: 'الكمية يجب أن تكون أكبر من الصفر' });
        const nb = await NotebookModel.findOneAndUpdate(
            { _id: notebookId, teacherId },
            { $inc: { stock: quantity } },
            { new: true }
        ).lean();
        if (!nb) throw NotFoundException({ message: 'المذكرة غير موجودة' });
        return nb;
    }

    // ── Decrement stock on sale (called from PaymentsService) ────────
    static async decrementStock(notebookId: string, teacherId: string, quantity: number = 1) {
        const nb = await NotebookModel.findOne({ _id: notebookId, teacherId }).lean();
        if (!nb) throw NotFoundException({ message: 'المذكرة غير موجودة' });
        if (nb.stock < quantity) {
            throw BadRequestException({ message: `الكمية المتاحة في المخزن: ${nb.stock}` });
        }
        return await NotebookModel.findByIdAndUpdate(
            notebookId,
            { $inc: { stock: -quantity } },
            { new: true }
        ).lean();
    }

    // ── Delete ──────────────────────────────────────────────────────
    static async deleteNotebook(notebookId: string, teacherId: string) {
        const nb = await NotebookModel.findOneAndDelete({ _id: notebookId, teacherId }).lean();
        if (!nb) throw NotFoundException({ message: 'المذكرة غير موجودة' });
        return nb;
    }
}
