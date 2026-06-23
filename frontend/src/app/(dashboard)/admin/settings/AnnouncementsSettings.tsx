'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAnnouncements, createAnnouncement, toggleAnnouncement, deleteAnnouncement } from '@/lib/api/admin';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Megaphone, Trash2, Power, PowerOff, Loader2, Info, AlertTriangle, CheckCircle } from 'lucide-react';

export default function AnnouncementsSettings() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'success'>('info');
    const [expiresAt, setExpiresAt] = useState('');

    const { data: announcements, isLoading } = useQuery({
        queryKey: ['admin-announcements'],
        queryFn: fetchAnnouncements,
    });

    const createMutation = useMutation({
        mutationFn: createAnnouncement,
        onSuccess: () => {
            toast.success('تم إنشاء الإشعار بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
            setTitle('');
            setContent('');
            setType('info');
            setExpiresAt('');
            setIsCreating(false);
        },
    });

    const toggleMutation = useMutation({
        mutationFn: toggleAnnouncement,
        onSuccess: () => {
            toast.success('تم تحديث حالة الإشعار');
            queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteAnnouncement,
        onSuccess: () => {
            toast.success('تم حذف الإشعار بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
        }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !content) {
            toast.error('الرجاء إدخال العنوان والمحتوى');
            return;
        }
        createMutation.mutate({
            title,
            content,
            type,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        });
    };

    const getTypeIcon = (t: string) => {
        if (t === 'warning') return <AlertTriangle className="h-4 w-4 text-orange-500" />;
        if (t === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;
        return <Info className="h-4 w-4 text-blue-500" />;
    };

    const getTypeLabel = (t: string) => {
        if (t === 'warning') return 'تنبيه هام';
        if (t === 'success') return 'نجاح / إنجاز';
        return 'معلومة عامة';
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">الإشعارات العامة</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        إرسال رسائل وتنبيهات تظهر لجميع المعلمين في لوحة التحكم
                    </p>
                </div>
                <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "outline" : "default"} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    {isCreating ? 'إلغاء الإضافة' : 'إشعار جديد'}
                </Button>
            </div>

            {isCreating && (
                <div className="p-5 border-b border-gray-100 bg-primary/5">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-700">عنوان الإشعار</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="مثال: صيانة مجدولة للنظام"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-700">نوع الإشعار</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as any)}
                                    className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
                                >
                                    <option value="info">معلومة عامة (أزرق)</option>
                                    <option value="warning">تنبيه هام (برتقالي)</option>
                                    <option value="success">نجاح / تحديث (أخضر)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700">محتوى الرسالة</label>
                            <Textarea
                                value={content}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                                placeholder="اكتب تفاصيل الإشعار هنا..."
                                rows={3}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-700">تاريخ الانتهاء (اختياري)</label>
                                <Input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                />
                                <p className="text-[10px] text-gray-500">سيختفي الإشعار تلقائياً بعد هذا التاريخ</p>
                            </div>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={createMutation.isPending} className="w-full md:w-auto">
                                    {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                    نشر الإشعار
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div className="divide-y divide-gray-50">
                {isLoading ? (
                    <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/50" /></div>
                ) : announcements?.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">لا توجد إشعارات سابقة</div>
                ) : (
                    announcements?.map((ann) => {
                        const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date();
                        const isInvalid = !ann.isActive || isExpired;

                        return (
                            <div key={ann._id} className={`p-5 flex flex-col sm:flex-row gap-4 justify-between items-start hover:bg-gray-50/30 transition-colors ${isInvalid ? 'opacity-60' : ''}`}>
                                <div className="flex gap-4">
                                    <div className={`mt-1 p-2 rounded-xl border ${
                                        ann.type === 'warning' ? 'bg-orange-50 border-orange-100' :
                                        ann.type === 'success' ? 'bg-green-50 border-green-100' :
                                        'bg-blue-50 border-blue-100'
                                    }`}>
                                        {getTypeIcon(ann.type)}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-900">{ann.title}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                                ann.isActive && !isExpired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {ann.isActive && !isExpired ? 'نشط ويظهر الآن' : isExpired ? 'منتهي الصلاحية' : 'معطل'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{ann.content}</p>
                                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                            <span>النوع: {getTypeLabel(ann.type)}</span>
                                            <span>تاريخ النشر: {new Date(ann.createdAt).toLocaleDateString('ar-EG')}</span>
                                            {ann.expiresAt && <span>ينتهي في: {new Date(ann.expiresAt).toLocaleDateString('ar-EG')}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end mt-4 sm:mt-0">
                                    <Button 
                                        variant="outline" size="sm" 
                                        className={ann.isActive ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                                        onClick={() => toggleMutation.mutate(ann._id)}
                                        disabled={toggleMutation.isPending}
                                    >
                                        {ann.isActive ? <><PowerOff className="h-4 w-4 ml-1" /> إيقاف</> : <><Power className="h-4 w-4 ml-1" /> تفعيل</>}
                                    </Button>
                                    <Button 
                                        variant="outline" size="sm" 
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                                        onClick={() => { if(confirm('هل أنت متأكد من حذف الإشعار؟')) deleteMutation.mutate(ann._id); }}
                                        disabled={deleteMutation.isPending}
                                        title="حذف نهائي"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
