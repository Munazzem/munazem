export interface INotebook {
    _id: string;
    teacherId: string;
    name: string;
    gradeLevel: string;
    price: number;
    stock: number;
    reservedCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface INotebookReservation {
    _id: string;
    teacherId: string;
    studentId: {
        _id: string;
        studentName: string;
        studentPhone: string;
        gradeLevel: string;
    };
    notebookId: {
        _id: string;
        name: string;
        price: number;
    };
    quantity: number;
    totalPrice: number;
    paidAmount: number;
    status: 'PENDING' | 'DELIVERED' | 'CANCELLED';
    reservedAt: string;
    deliveredAt?: string;
}

export interface PaginatedNotebooksResponse {
    data: INotebook[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface CreateNotebookDTO {
    name: string;
    gradeLevel: string;
    price: number;
    stock?: number;
}

export interface UpdateNotebookDTO {
    name?: string;
    gradeLevel?: string;
    price?: number;
}
