'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWhatsAppTemplates, updateWhatsAppTemplates } from '@/lib/api/admin';
import { Loader2, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppTemplatesPage() {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    
    const [sessionAbsent, setSessionAbsent] = useState<string[]>([]);
    const [examResult, setExamResult] = useState<string[]>([]);

    const { isLoading } = useQuery({
        queryKey: ['whatsapp-templates'],
        queryFn: async () => {
            const data = await fetchWhatsAppTemplates();
            setSessionAbsent(data.session_absent || []);
            setExamResult(data.exam_result || []);
            return data;
        },
        refetchOnWindowFocus: false,
    });

    const mutation = useMutation({
        mutationFn: updateWhatsAppTemplates,
        onSuccess: () => {
            toast.success('تم حفظ قوالب الواتساب بنجاح');
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء حفظ القوالب');
        }
    });

    const handleSave = () => {
        // Validation minimums
        const validSession = sessionAbsent.filter(t => t.trim().length > 0);
        const validExam = examResult.filter(t => t.trim().length > 0);

        if (validSession.length < 3 || validExam.length < 3) {
            toast.error('يجب توفير 3 صيغ على الأقل لكل قالب لتجنب حظر الواتساب!');
            return;
        }

        mutation.mutate({
            session_absent: validSession,
            exam_result: validExam,
        });
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">إدارة قوالب الواتساب</h1>
                    <p className="text-gray-500 mt-1">تعديل صيغ الرسائل المُرسلة للطلاب وأولياء الأمور</p>
                </div>
                {isEditing ? (
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        >
                            إلغاء
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={mutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-70"
                        >
                            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            حفظ التعديلات
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                    >
                        تعديل القوالب
                    </button>
                )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3 text-yellow-800">
                <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                <div>
                    <h3 className="font-bold mb-1">تعليمات هامة لحماية الأرقام من الحظر (Anti-Spam)</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>يجب إدخال <strong>3 صيغ مختلفة على الأقل</strong> لكل نوع رسالة.</li>
                        <li>لا تستخدم الإيموجيز الكثيرة، استخدم رمز ⚠️ للتنبيهات فقط.</li>
                        <li>استخدم المتغيرات التالية سيتم استبدالها تلقائياً: {'{studentName}'}, {'{sessionTitle}'}, {'{examName}'}, {'{studentScore}'}, {'{examTotal}'}</li>
                    </ul>
                </div>
            </div>

            {/* Session Absent Templates */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">رسائل الغياب عن الحصة</h2>
                        <p className="text-sm text-gray-500 mt-1">المتغيرات المتاحة: {'{studentName}'}, {'{sessionTitle}'}</p>
                    </div>
                    {isEditing && (
                        <button onClick={() => setSessionAbsent(['', ...sessionAbsent])} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                            <Plus className="w-4 h-4" /> إضافة صيغة
                        </button>
                    )}
                </div>
                <div className="p-5 space-y-4">
                    {sessionAbsent.map((template, idx) => (
                        <div key={idx} className="flex gap-3">
                            <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">{idx + 1}</span>
                            <textarea 
                                value={template}
                                onChange={(e) => {
                                    const arr = [...sessionAbsent];
                                    arr[idx] = e.target.value;
                                    setSessionAbsent(arr);
                                }}
                                disabled={!isEditing}
                                rows={2}
                                className="flex-1 w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-600 resize-none"
                                placeholder="اكتب صيغة الرسالة هنا..."
                            />
                            {isEditing && sessionAbsent.length > 3 && (
                                <button 
                                    onClick={() => setSessionAbsent(sessionAbsent.filter((_, i) => i !== idx))}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg h-fit mt-1 transition-colors"
                                    title="حذف"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                    {sessionAbsent.length < 3 && (
                        <p className="text-red-500 text-sm font-medium">تحذير: يجب إضافة {3 - sessionAbsent.length} صيغة إضافية على الأقل.</p>
                    )}
                </div>
            </div>

            {/* Exam Result Templates */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">رسائل نتيجة الامتحان</h2>
                        <p className="text-sm text-gray-500 mt-1">المتغيرات المتاحة: {'{studentName}'}, {'{examName}'}, {'{studentScore}'}, {'{examTotal}'}</p>
                    </div>
                    {isEditing && (
                        <button onClick={() => setExamResult(['', ...examResult])} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                            <Plus className="w-4 h-4" /> إضافة صيغة
                        </button>
                    )}
                </div>
                <div className="p-5 space-y-4">
                    {examResult.map((template, idx) => (
                        <div key={idx} className="flex gap-3">
                            <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">{idx + 1}</span>
                            <textarea 
                                value={template}
                                onChange={(e) => {
                                    const arr = [...examResult];
                                    arr[idx] = e.target.value;
                                    setExamResult(arr);
                                }}
                                disabled={!isEditing}
                                rows={2}
                                className="flex-1 w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-600 resize-none"
                                placeholder="اكتب صيغة الرسالة هنا..."
                            />
                            {isEditing && examResult.length > 3 && (
                                <button 
                                    onClick={() => setExamResult(examResult.filter((_, i) => i !== idx))}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg h-fit mt-1 transition-colors"
                                    title="حذف"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                    {examResult.length < 3 && (
                        <p className="text-red-500 text-sm font-medium">تحذير: يجب إضافة {3 - examResult.length} صيغة إضافية على الأقل.</p>
                    )}
                </div>
            </div>

        </div>
    );
}
