'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchReservations } from '@/lib/api/notebooks';
import { deliverNotebook } from '@/lib/api/payments';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    BookMarked, 
    Loader2, 
    CheckCircle2, 
    Search,
    User,
    Calendar,
    Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Props {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}

export function PendingReservationsModal({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    
    // Delivery state
    const [deliveringId, setDeliveringId] = useState<string | null>(null);
    const [additionalPayment, setAdditionalPayment] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['pendingReservations', searchTerm],
        queryFn: () => fetchReservations({ status: 'PENDING', limit: 100 }), // Simplified for now
        enabled: open,
    });

    const reservations = data?.data || [];

    const deliverMutation = useMutation({
        mutationFn: ({ id, amount }: { id: string, amount: number }) => 
            deliverNotebook(id, { paidAmount: amount }),
        onSuccess: () => {
            toast.success('تم تسليم المذكرة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['pendingReservations'] });
            queryClient.invalidateQueries({ queryKey: ['notebooks'] });
            queryClient.invalidateQueries({ queryKey: ['dailySummary'] });
            setDeliveringId(null);
            setAdditionalPayment('');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'حدث خطأ أثناء التسليم');
        }
    });

    const handleDeliver = (res: any) => {
        const remaining = res.totalPrice - res.paidAmount;
        if (remaining > 0) {
            setDeliveringId(res._id);
            setAdditionalPayment(remaining.toString());
        } else {
            deliverMutation.mutate({ id: res._id, amount: 0 });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-white rounded-2xl p-0 overflow-hidden" dir="rtl">
                <div className="h-1.5 w-full bg-purple-600" />
                
                <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <BookMarked className="h-6 w-6 text-purple-600" />
                        الحجوزات المعلقة
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p>جاري تحميل الحجوزات...</p>
                        </div>
                    ) : reservations.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                            <BookMarked className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">لا توجد حجوزات معلقة حالياً</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reservations.map((res: any) => (
                                <div key={res._id} className="border border-gray-100 rounded-2xl p-4 hover:border-purple-200 transition-colors bg-white shadow-xs">
                                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-gray-900 font-bold">
                                                <User className="h-4 w-4 text-gray-400" />
                                                {res.studentId?.studentName}
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-600 text-[10px]">
                                                    {res.studentId?.gradeLevel}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <BookMarked className="h-3.5 w-3.5 text-purple-400" />
                                                    {res.notebookId?.name} ({res.quantity} نسخة)
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                                    {format(new Date(res.reservedAt), 'd MMMM yyyy', { locale: ar })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 mt-3">
                                                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100">
                                                    المدفوع: {res.paidAmount} ج
                                                </div>
                                                <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-100">
                                                    المتبقي: {res.totalPrice - res.paidAmount} ج
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center sm:items-end">
                                            {deliveringId === res._id ? (
                                                <div className="flex flex-col gap-2 w-full sm:w-40">
                                                    <div className="relative">
                                                        <Wallet className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                                        <Input 
                                                            type="number"
                                                            value={additionalPayment}
                                                            onChange={e => setAdditionalPayment(e.target.value)}
                                                            className="h-9 pr-8 text-xs font-bold"
                                                            placeholder="المبلغ الباقي"
                                                        />
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button 
                                                            size="sm" 
                                                            className="flex-1 text-xs h-8 bg-green-600 hover:bg-green-700"
                                                            onClick={() => deliverMutation.mutate({ id: res._id, amount: Number(additionalPayment) })}
                                                            disabled={deliverMutation.isPending}
                                                        >
                                                            تأكيد
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="outline"
                                                            className="h-8 text-xs"
                                                            onClick={() => setDeliveringId(null)}
                                                        >
                                                            إلغاء
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <Button 
                                                    className="gap-2 bg-purple-600 hover:bg-purple-700 shadow-md sm:w-32"
                                                    onClick={() => handleDeliver(res)}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    تسليم
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
