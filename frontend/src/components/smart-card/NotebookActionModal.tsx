'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { recordNotebookSale, reserveNotebook } from '@/lib/api/payments';
import { fetchNotebooks } from '@/lib/api/notebooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
    open: boolean;
    onClose: () => void;
    studentId: string;
    studentName: string;
    mode: 'sell' | 'reserve';
}

export function NotebookActionModal({ open, onClose, studentId, studentName, mode }: Props) {
    const [selectedId, setSelectedId] = useState('');
    const [qty, setQty] = useState(1);
    const [discount, setDiscount] = useState(0);

    const { data } = useQuery({
        queryKey: ['notebooks-list'],
        queryFn: () => fetchNotebooks({ limit: 50 }),
        enabled: open,
    });
    const notebooks = data?.data ?? [];
    const selected = notebooks.find((n: any) => n._id === selectedId);
    const baseTotal = (selected?.price ?? 0) * qty;
    const finalTotal = Math.max(0, baseTotal - discount);

    const sellMutation = useMutation({
        mutationFn: () => recordNotebookSale({ studentId, notebookId: selectedId, quantity: qty, discountAmount: discount || undefined }),
        onSuccess: () => { toast.success(`✅ تم بيع المذكرة لـ ${studentName}`); onClose(); reset(); },
    });
    const reserveMutation = useMutation({
        mutationFn: () => reserveNotebook({ studentId, notebookId: selectedId, quantity: qty }),
        onSuccess: () => { toast.success(`✅ تم حجز المذكرة لـ ${studentName}`); onClose(); reset(); },
    });

    const reset = () => { setSelectedId(''); setQty(1); setDiscount(0); };
    const isPending = sellMutation.isPending || reserveMutation.isPending;
    const handleSubmit = () => mode === 'sell' ? sellMutation.mutate() : reserveMutation.mutate();

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BookOpen className={cn('h-5 w-5', mode === 'sell' ? 'text-blue-600' : 'text-purple-600')} />
                        {mode === 'sell' ? 'بيع مذكرة' : 'حجز مذكرة'} — {studentName}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Notebook picker */}
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1.5 block">اختر المذكرة</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {notebooks.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-4">لا توجد مذكرات متاحة</p>
                            )}
                            {notebooks.map((n: any) => (
                                <button
                                    key={n._id}
                                    onClick={() => setSelectedId(n._id)}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all',
                                        selectedId === n._id
                                            ? 'border-primary bg-primary/5'
                                            : 'border-gray-100 hover:border-primary/30'
                                    )}
                                >
                                    <span className="font-medium text-gray-800">{n.title}</span>
                                    <span className="text-xs text-gray-500">{n.price} ج · مخزون {n.stock}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-gray-600 w-16">الكمية</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-gray-100 font-bold hover:bg-gray-200">−</button>
                            <span className="w-8 text-center font-bold">{qty}</span>
                            <button onClick={() => setQty(q => q + 1)} className="w-8 h-8 rounded-lg bg-gray-100 font-bold hover:bg-gray-200">+</button>
                        </div>
                    </div>

                    {/* Discount (sell only) */}
                    {mode === 'sell' && (
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-gray-600 w-16">خصم</label>
                            <Input type="number" min={0} value={discount || ''} onChange={e => setDiscount(Number(e.target.value) || 0)} placeholder="0" className="w-28" />
                            <span className="text-xs text-gray-500">ج.م</span>
                        </div>
                    )}

                    {/* Total */}
                    {selected && (
                        <div className={cn('rounded-xl p-3 text-center border', mode === 'sell' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200')}>
                            <p className="text-xs text-gray-500 mb-1">الإجمالي</p>
                            <p className={cn('text-2xl font-black', mode === 'sell' ? 'text-blue-700' : 'text-purple-700')}>
                                {mode === 'sell' ? finalTotal : baseTotal} ج.م
                            </p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!selectedId || isPending}
                            className={cn('flex-1', mode === 'sell' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700')}
                        >
                            {isPending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <><CheckCircle2 className="h-4 w-4 ml-1" />{mode === 'sell' ? 'تأكيد البيع' : 'تأكيد الحجز'}</>
                            }
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
