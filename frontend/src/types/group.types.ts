export interface GroupSchedule {
    _id?: string;
    day: string;
    time: string;
}

export interface Group {
    _id: string;
    name: string;
    gradeLevel: string;
    schedule: GroupSchedule[];
    capacity: number;
    teacherId: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
    studentsCount?: number; // Fetched from backend optionally
}

export interface PaginatedGroupsResponse {
    data: Group[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface CreateGroupDTO {
    name: string;
    gradeLevel: string;
    schedule: GroupSchedule[];
    capacity?: number;
}

export type UpdateGroupDTO = Partial<CreateGroupDTO> & { isActive?: boolean };
