export interface INotebook {
    _id: string;
    teacherId: string;
    name: string;
    gradeLevel: string;
    price: number;
    stock: number;
    createdAt: string;
    updatedAt: string;
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
