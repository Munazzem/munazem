import type { CreateStudentDTO, UpdateStudentDTO } from '../../types/dto.types.js';
export declare class StudentService {
    private static parseFullName;
    static createStudent(teacherId: string, data: CreateStudentDTO): Promise<import("mongoose").Document<unknown, {}, import("../../types/student.types.js").IStudent, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/student.types.js").IStudent & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    }>;
    static bulkCreateStudents(teacherId: string, students: CreateStudentDTO[]): Promise<{
        results: {
            studentName: string;
            studentCode: string;
            index: number;
            success: boolean;
        }[];
        successCount: number;
        failCount: number;
        total: number;
    }>;
    static getStudentsByTeacherId(teacherId: string, queryFilters: any): Promise<{
        data: any[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    static getStudentById(studentId: string, teacherId: string): Promise<import("../../types/student.types.js").IStudent & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
    static updateStudent(studentId: string, teacherId: string, data: UpdateStudentDTO): Promise<import("../../types/student.types.js").IStudent & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
    static deleteStudent(studentId: string, teacherId: string): Promise<import("../../types/student.types.js").IStudent & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
}
//# sourceMappingURL=students.service.d.ts.map