import { Document, Types } from 'mongoose';
import { QuestionType, ExamStatus, ExamSource, GradeLevel } from '../common/enums/enum.service.js';

export interface IQuestion {
    type:          QuestionType;
    text:          string;            
    marks:         number;          
    // MCQ only
    options?:      string[];        
    correctAnswer?: string;         
}

export interface IExam {
    teacherId:    Types.ObjectId;
    title:        string;
    gradeLevel?:  GradeLevel;         
    groupIds?:    Types.ObjectId[];   
    date:         Date;
    totalMarks:   number;             
    passingMarks: number;             
    questions:    IQuestion[];
    status:       ExamStatus;
    source:       ExamSource;
    createdAt?:   Date;
    updatedAt?:   Date;
}

export interface IExamDocument extends IExam, Document {}
