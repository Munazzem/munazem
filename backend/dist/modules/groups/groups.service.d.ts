import type { CreateGroupDTO, UpdateGroupDTO } from '../../types/dto.types.js';
export declare class GroupService {
    static createGroup(teacherId: string, data: CreateGroupDTO): Promise<import("mongoose").Document<unknown, {}, import("../../types/group.types.js").IGroup, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/group.types.js").IGroup & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    }>;
    static getGroupsByTeacherId(teacherId: string, queryFilters?: any): Promise<any>;
    static getGroupById(groupId: string, teacherId: string): Promise<import("../../types/group.types.js").IGroup & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
    static updateGroup(groupId: string, teacherId: string, data: UpdateGroupDTO): Promise<import("../../types/group.types.js").IGroup & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
    static deleteGroup(groupId: string, teacherId: string): Promise<import("../../types/group.types.js").IGroup & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }>;
}
//# sourceMappingURL=groups.service.d.ts.map