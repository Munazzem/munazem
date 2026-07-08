export declare class PdfService {
    private static wrapHtmlContent;
    /**
     * Generates a high-quality HTML report for a student, styled for printing.
     */
    static generateStudentReportPdf(studentId: string, teacherId: string): Promise<string>;
    static generateMonthlyFinancialPdf(teacherId: string, year: number, month: number): Promise<string>;
    static generateDailySummaryPdf(teacherId: string, dateStr?: string): Promise<string>;
    static generateGroupReportPdf(groupId: string, teacherId: string): Promise<string>;
    static generateSessionAttendancePdf(sessionId: string, teacherId: string): Promise<string>;
    static generateGroupAttendanceSheetHtml(groupId: string, teacherId: string): Promise<string>;
}
//# sourceMappingURL=pdf.service.d.ts.map