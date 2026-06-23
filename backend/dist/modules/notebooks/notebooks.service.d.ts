import { GradeLevel } from '../../common/enums/enum.service.js';
export interface CreateNotebookDTO {
    name: string;
    gradeLevel: GradeLevel;
    price: number;
    stock?: number;
}
export interface UpdateNotebookDTO {
    name?: string;
    gradeLevel?: GradeLevel;
    price?: number;
}
export declare class NotebooksService {
    static createNotebook(teacherId: string, data: CreateNotebookDTO): Promise<import("mongoose").Document<unknown, {}, import("../../types/notebook.types.js").INotebookDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/notebook.types.js").INotebookDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static getNotebooks(teacherId: string, queryFilters?: any): Promise<{
        data: (import("../../types/notebook.types.js").INotebookDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    static getNotebookById(notebookId: string, teacherId: string): Promise<import("../../types/notebook.types.js").INotebookDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static updateNotebook(notebookId: string, teacherId: string, data: UpdateNotebookDTO): Promise<import("../../types/notebook.types.js").INotebookDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static addStock(notebookId: string, teacherId: string, quantity: number): Promise<import("../../types/notebook.types.js").INotebookDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static decrementStock(notebookId: string, teacherId: string, quantity?: number): Promise<(import("../../types/notebook.types.js").INotebookDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    static deleteNotebook(notebookId: string, teacherId: string): Promise<import("../../types/notebook.types.js").INotebookDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static getReservations(teacherId: string, queryFilters?: any): Promise<{
        data: (import("../../types/notebook-reservation.types.js").INotebookReservationDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
}
//# sourceMappingURL=notebooks.service.d.ts.map