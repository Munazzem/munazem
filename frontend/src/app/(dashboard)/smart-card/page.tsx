'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    resolveCard,
    linkCard,
    disableCard,
    generateCardBatch,
    getCardStats,
    getCards,
    getCardBatchPrintUrl,
    unlinkCard,
    getCardDesignTemplate,
    updateCardDesignTemplate,
} from '@/lib/api/cards';
import type { CardResolveResult, CardStats, ICard, CardDesignTemplate } from '@/lib/api/cards';
import { fetchStudents } from '@/lib/api/students';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsLocalDev } from '@/lib/use-local-dev';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, User, Users, Wallet, BookOpen, FileText,
    MessageSquare, Printer, Unlink, CheckCircle2,
    Loader2, Package, Scan, Link2, Hash, ExternalLink,
    Palette, Upload, Image as ImageIcon, Save, Eye,
    Move, SlidersHorizontal, Sparkles, RefreshCw } from 'lucide-react';
import { QrScanner } from '@/components/scanner/QrScanner';
import { SubscriptionModal } from '@/components/smart-card/SubscriptionModal';
import { NotebookActionModal } from '@/components/smart-card/NotebookActionModal';
import { AddGradeModal } from '@/components/smart-card/AddGradeModal';

// ── Types ──────────────────────────────────────────────────────────────────────
type View = 'scanner' | 'result' | 'link-choice' | 'link-student' | 'generate';

// ── Student Summary Card ───────────────────────────────────────────────────────
function StudentSummaryCard({ student }: { student: CardResolveResult['student'] }) {
    if (!student) return null;
    const debtColor = student.totalDebt > 0 ? 'text-red-600' : 'text-green-600';
    const subColor  = student.hasActiveSubscription ? 'text-green-600' : 'text-orange-500';

    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {/* Header strip */}
            <div className="bg-primary px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
                        {student.studentName.charAt(0)}
                    </div>
                    <div>
                        <p className="text-lg font-bold">{student.studentName}</p>
                        <p className="text-xs text-white/80">{student.studentCode} · {student.gradeLevel}</p>
                    </div>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 p-4">
                <Stat label="المجموعة"      value={student.groupName}                   />
                <Stat label="الاشتراك"       value={student.hasActiveSubscription ? '✅ مشترك' : '❌ غير مشترك'} valueClass={subColor} />
                <Stat label="رصيد الحصص"    value={`${student.remainingSessions} حصة`}  />
                <Stat label="المديونية"      value={`${student.totalDebt} ج.م`}          valueClass={debtColor} />
                {student.lastAttendanceDate && (
                    <Stat label="آخر حضور" value={new Date(student.lastAttendanceDate).toLocaleDateString('en-GB')} />
                )}
                {student.lastPaymentAmount != null && (
                    <Stat label="آخر دفعة" value={`${student.lastPaymentAmount} ج.م`} />
                )}
            </div>
        </div>
    );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
            <p className={cn('text-sm font-bold', valueClass || 'text-gray-800')}>{value}</p>
        </div>
    );
}

// ── Fast Actions ───────────────────────────────────────────────────────────────
function FastActions({ student, cardNumber, onUnlink }: {
    student: CardResolveResult['student'];
    cardNumber: string | null;
    onUnlink?: () => void;
}) {
    const router = useRouter();
    const [modal, setModal] = useState<'subscription' | 'sell' | 'reserve' | 'grade' | null>(null);
    if (!student) return null;

    const waPhone = (student as any).parentPhone
        ? `https://wa.me/${ ((student as any).parentPhone as string).replace(/[^0-9]/g, '') }`
        : null;

    const actions = [
        {
            icon: Wallet, label: 'تحصيل اشتراك', color: 'bg-green-50 text-green-700 border-green-200',
            onClick: () => setModal('subscription'),
        },
        {
            icon: BookOpen, label: 'بيع مذكرة', color: 'bg-blue-50 text-blue-700 border-blue-200',
            onClick: () => setModal('sell'),
        },
        {
            icon: BookOpen, label: 'حجز مذكرة', color: 'bg-purple-50 text-purple-700 border-purple-200',
            onClick: () => setModal('reserve'),
        },
        {
            icon: User, label: 'بروفايل الطالب', color: 'bg-gray-50 text-gray-700 border-gray-200',
            onClick: () => router.push(`/students/${student.studentId}`),
        },
        {
            icon: FileText, label: 'إضافة درجة', color: 'bg-orange-50 text-orange-700 border-orange-200',
            onClick: () => setModal('grade'),
        },
        {
            icon: MessageSquare, label: 'رسالة واتساب', color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            onClick: () => waPhone ? window.open(waPhone, '_blank') : null,
            disabled: !waPhone,
        },
        ...(cardNumber ? [{
            icon: Unlink, label: 'فك ربط الكارت', color: 'bg-red-50 text-red-700 border-red-200',
            onClick: onUnlink,
        }] : []),
    ];

    return (
        <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {actions.map((action) => (
                    <button
                        key={action.label}
                        onClick={action.onClick as any}
                        disabled={(action as any).disabled}
                        className={cn(
                            'flex flex-col items-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed',
                            action.color
                        )}
                    >
                        <action.icon className="h-5 w-5" />
                        <span className="text-xs text-center">{action.label}</span>
                    </button>
                ))}
            </div>

            <SubscriptionModal
                open={modal === 'subscription'}
                onClose={() => setModal(null)}
                studentId={student.studentId}
                studentName={student.studentName}
                gradeLevel={student.gradeLevel}
            />
            <NotebookActionModal
                open={modal === 'sell'}
                onClose={() => setModal(null)}
                studentId={student.studentId}
                studentName={student.studentName}
                mode="sell"
            />
            <NotebookActionModal
                open={modal === 'reserve'}
                onClose={() => setModal(null)}
                studentId={student.studentId}
                studentName={student.studentName}
                mode="reserve"
            />
            <AddGradeModal
                open={modal === 'grade'}
                onClose={() => setModal(null)}
                studentId={student.studentId}
                studentName={student.studentName}
            />
        </>
    );
}



// ── Link Student Modal ─────────────────────────────────────────────────────────
function LinkStudentModal({ cardNumber, onLinked, onClose }: {
    cardNumber: string;
    onLinked: () => void;
    onClose: () => void;
}) {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['students-for-link', search],
        queryFn: () => fetchStudents({ search: search || undefined, limit: 20 }),
        enabled: search.length >= 1,
    });

    const linkMutation = useMutation({
        mutationFn: () => linkCard(cardNumber, selectedId),
        onSuccess: () => {
            toast.success('تم ربط الكارت بنجاح ✅');
            qc.invalidateQueries({ queryKey: ['card-stats'] });
            qc.invalidateQueries({ queryKey: ['cards'] });
            onLinked();
        },
    });

    const students = data?.data || [];

    return (
        <div className="space-y-4">
            <Input
                placeholder="ابحث بالاسم أو الكود..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
            />
            {isLoading && <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>}
            <div className="space-y-2 max-h-64 overflow-y-auto">
                {students.map(s => (
                    <button
                        key={s._id}
                        onClick={() => setSelectedId(s._id)}
                        className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl border text-right transition-all',
                            selectedId === s._id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/30'
                        )}
                    >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {s.studentName.charAt(0)}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">{s.studentName}</p>
                            <p className="text-xs text-gray-400">{s.studentCode} · {s.gradeLevel}</p>
                        </div>
                    </button>
                ))}
                {search.length >= 1 && !isLoading && students.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-4">لا يوجد نتائج</p>
                )}
            </div>
            <div className="flex gap-2">
                <Button onClick={onClose} variant="outline" className="flex-1">إلغاء</Button>
                <Button
                    onClick={() => linkMutation.mutate()}
                    disabled={!selectedId || linkMutation.isPending}
                    className="flex-1"
                >
                    {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ربط الكارت'}
                </Button>
            </div>
        </div>
    );
}

// ── Generate Batch Panel ───────────────────────────────────────────────────────
type BatchHistoryEntry = { batchId: string; count: number; createdAt: string };

const HISTORY_KEY = 'cardBatchHistory';
function loadHistory(): BatchHistoryEntry[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(entries: BatchHistoryEntry[]) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 20))); } catch { /* ignore */ }
}

function GenerateBatchPanel() {
    const [count, setCount] = useState(50);
    const [history, setHistory] = useState<BatchHistoryEntry[]>(loadHistory);
    const qc = useQueryClient();

    const generateMutation = useMutation({
        mutationFn: () => generateCardBatch(count),
        onSuccess: (data) => {
            toast.success(`تم إنشاء ${data.count} كارت بنجاح ✅`);
            const entry: BatchHistoryEntry = {
                batchId: data.batchId,
                count: data.count,
                createdAt: new Date().toISOString(),
            };
            const updated = [entry, ...history];
            setHistory(updated);
            saveHistory(updated);
            qc.invalidateQueries({ queryKey: ['card-stats'] });
            qc.invalidateQueries({ queryKey: ['cards'] });
        },
    });

    const { data: stats } = useQuery<CardStats>({
        queryKey: ['card-stats'],
        queryFn: getCardStats,
    });

    return (
        <div className="space-y-6">
            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-3 gap-3">
                    <StatCard label="جديدة"   value={stats.NEW}      color="text-blue-600 bg-blue-50"   />
                    <StatCard label="مربوطة"  value={stats.LINKED}   color="text-green-600 bg-green-50" />
                    <StatCard label="معطلة"   value={stats.DISABLED} color="text-red-600 bg-red-50"     />
                </div>
            )}

            {/* Generate form */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-4 border border-gray-100">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" /> إنشاء batch جديد
                    </h3>
                </div>
                <div className="flex items-center gap-3">
                    <Input
                        type="number"
                        min={1} max={1000}
                        value={count}
                        onChange={e => setCount(Math.min(1000, Math.max(1, Number(e.target.value))))}
                        className="w-28 text-center"
                    />
                    <span className="text-sm text-gray-500">كارت</span>
                    <Button
                        onClick={() => generateMutation.mutate()}
                        disabled={generateMutation.isPending}
                        className="flex-1"
                    >
                        {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Package className="h-4 w-4 ml-2" />}
                        إنشاء الكروت
                    </Button>
                </div>
            </div>

            {/* Batch History */}
            {history.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-gray-400" /> سجل الـ Batches
                        </h3>
                        <button
                            onClick={() => { setHistory([]); saveHistory([]); }}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                            مسح السجل
                        </button>
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {history.map((entry, idx) => (
                            <div
                                key={entry.batchId}
                                className={cn(
                                    'flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border transition-all',
                                    idx === 0
                                        ? 'bg-green-50 border-green-200'
                                        : 'bg-white border-gray-100 hover:border-gray-200'
                                )}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    {idx === 0
                                        ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                        : <Package className="h-4 w-4 text-gray-400 shrink-0" />
                                    }
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-700">
                                            {entry.count} كارت
                                            {idx === 0 && <span className="mr-1.5 text-green-600">(آخر batch)</span>}
                                        </p>
                                        <p className="text-xs text-gray-400 font-mono">
                                            {new Date(entry.createdAt).toLocaleString('ar-EG', {
                                                day: '2-digit', month: '2-digit', year: '2-digit',
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                        size="sm"
                                        className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3 font-bold shadow-sm"
                                        onClick={() => window.open(getCardBatchPrintUrl(entry.batchId), '_blank')}
                                        title="طباعة كروت بلاستيكية PVC (CR-80)"
                                    >
                                        <CreditCard className="h-3.5 w-3.5" /> طباعة PVC
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className={cn('rounded-xl p-3 text-center', color.split(' ')[1])}>
            <p className={cn('text-2xl font-black', color.split(' ')[0])}>{value}</p>
            <p className="text-xs text-gray-600 mt-0.5">{label}</p>
        </div>
    );
}

// ── Design Panel ─────────────────────────────────────────────────────────────
function DesignPanel() {
    const qc = useQueryClient();
    const frontRef = useRef<HTMLInputElement>(null);
    const backRef = useRef<HTMLInputElement>(null);
    const cardPreviewRef = useRef<HTMLDivElement>(null);

    const [frontPreview, setFrontPreview] = useState<string>('');
    const [backPreview, setBackPreview] = useState<string>('');
    const [cardSide, setCardSide] = useState<'front' | 'back'>('front');

    // QR position & size controls
    const [qrX, setQrX] = useState<number>(50);
    const [qrY, setQrY] = useState<number>(70);
    const [qrSize, setQrSize] = useState<number>(25);
    const [showQrBg, setShowQrBg] = useState<boolean>(true);
    const [showCardNumber, setShowCardNumber] = useState<boolean>(true);
    const [isDragging, setIsDragging] = useState<boolean>(false);

    const { data, isLoading } = useQuery({
        queryKey: ['card-design-template'],
        queryFn: getCardDesignTemplate,
    });

    useEffect(() => {
        if (data?.template) {
            const t = data.template;
            if (t.frontImageUrl) setFrontPreview(t.frontImageUrl);
            if (t.backImageUrl)  setBackPreview(t.backImageUrl);
            if (t.qrX != null) setQrX(t.qrX);
            if (t.qrY != null) setQrY(t.qrY);
            if (t.qrSize != null) setQrSize(t.qrSize);
            if (t.showQrBg != null) setShowQrBg(t.showQrBg);
            if (t.showCardNumber != null) setShowCardNumber(t.showCardNumber);
        }
    }, [data]);

    const saveMutation = useMutation({
        mutationFn: (payload: CardDesignTemplate) => updateCardDesignTemplate(payload),
        onSuccess: () => {
            toast.success('تم حفظ تصميم الكارت وموضع الـ QR بنجاح ✅');
            qc.invalidateQueries({ queryKey: ['card-design-template'] });
        },
        onError: () => toast.error('تعذر حفظ التصميم'),
    });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('حجم الصورة كبير — الحد الأقصى 5 ميجا'); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const b64 = ev.target?.result as string;
            if (side === 'front') setFrontPreview(b64);
            else setBackPreview(b64);
            toast.success(`تم تحميل الوجه ${side === 'front' ? 'الأمامي' : 'الخلفي'}`);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const updateQrPosFromPointer = (clientX: number, clientY: number) => {
        if (!cardPreviewRef.current) return;
        const rect = cardPreviewRef.current.getBoundingClientRect();
        const x = Math.round(Math.max(10, Math.min(90, ((clientX - rect.left) / rect.width) * 100)));
        const y = Math.round(Math.max(10, Math.min(90, ((clientY - rect.top) / rect.height) * 100)));
        setQrX(x);
        setQrY(y);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (cardSide !== 'back') return;
        setIsDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        updateQrPosFromPointer(e.clientX, e.clientY);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || cardSide !== 'back') return;
        updateQrPosFromPointer(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setIsDragging(false);
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    };

    const handleSave = () => {
        if (!frontPreview && !backPreview) { toast.error('يرجى رفع تصميم واحد على الأقل'); return; }
        saveMutation.mutate({
            ...(frontPreview ? { frontImageUrl: frontPreview } : {}),
            ...(backPreview  ? { backImageUrl: backPreview }   : {}),
            qrX,
            qrY,
            qrSize,
            showQrBg,
            showCardNumber,
        });
    };

    const presets = [
        { label: 'أسفل المنتصف', x: 50, y: 72 },
        { label: 'المنتصف', x: 50, y: 50 },
        { label: 'أسفل اليمين', x: 75, y: 72 },
        { label: 'أسفل اليسار', x: 25, y: 72 },
    ];

    if (isLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-5">
            {/* Side Toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
                <button
                    type="button"
                    onClick={() => setCardSide('front')}
                    className={cn(
                        'flex-1 py-2 text-xs font-bold rounded-lg transition-all',
                        cardSide === 'front' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    )}
                >
                    الوجه الأمامي
                </button>
                <button
                    type="button"
                    onClick={() => setCardSide('back')}
                    className={cn(
                        'flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
                        cardSide === 'back' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                    )}
                >
                    <span>الوجه الخلفي (موضع وحجم QR)</span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700">تفاعلي</Badge>
                </button>
            </div>

            {/* Preview Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        {cardSide === 'front' ? 'تصميم الوجه الأمامي' : 'تحديد مكان وحجم كود الـ QR'}
                    </h3>
                    <Badge variant="outline" className={cn('text-xs', (cardSide === 'front' ? frontPreview : backPreview) ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : '')}>
                        {(cardSide === 'front' ? frontPreview : backPreview) ? 'مرفوع ✓' : 'لم يُرفع بعد'}
                    </Badge>
                </div>

                {/* ── Interactive Preview Area ── */}
                <div
                    ref={cardPreviewRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={cn(
                        'relative w-full rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 bg-slate-50 flex items-center justify-center select-none shadow-sm transition-all',
                        cardSide === 'back' ? 'cursor-crosshair' : 'cursor-pointer hover:border-primary/40'
                    )}
                    style={{ aspectRatio: '85.6 / 54' }}
                    onClick={() => {
                        if (cardSide === 'front') frontRef.current?.click();
                    }}
                >
                    {/* Background Artwork or Placeholder */}
                    {cardSide === 'front' ? (
                        frontPreview ? (
                            <img src={frontPreview} alt="front design" className="w-full h-full object-cover pointer-events-none" />
                        ) : (
                            <div className="flex flex-col items-center gap-2 text-gray-400 py-8 pointer-events-none">
                                <Upload className="h-10 w-10 stroke-[1.5]" />
                                <p className="text-sm font-bold text-gray-700">اضغط لرفع تصميم الوجه الأمامي</p>
                                <p className="text-xs text-gray-400">JPG, PNG — الأبعاد المثالية: 856×540px</p>
                            </div>
                        )
                    ) : (
                        backPreview ? (
                            <img src={backPreview} alt="back design" className="w-full h-full object-cover pointer-events-none" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400 bg-gradient-to-br from-slate-100 to-slate-200 pointer-events-none p-4 text-center">
                                <p className="text-xs font-bold text-gray-600">ارفع تصميم الوجه الخلفي بالزر أدناه، أو حدد موضع وحجم الـ QR مباشرة</p>
                            </div>
                        )
                    )}

                    {/* QR Overlay Box (Only on Back Side) */}
                    {cardSide === 'back' && (
                        <div
                            className={cn(
                                'absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow ring-2 ring-primary/40',
                                showQrBg ? 'bg-white/95 rounded-lg shadow-lg p-1.5' : 'bg-transparent'
                            )}
                            style={{
                                left: `${qrX}%`,
                                top: `${qrY}%`,
                                width: `${qrSize}%`,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            {/* Realistic SVG QR Preview */}
                            <div className="w-full aspect-square bg-slate-900 rounded p-1 flex items-center justify-center pointer-events-none">
                                <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
                                    <rect x="5" y="5" width="30" height="30" fill="white" />
                                    <rect x="10" y="10" width="20" height="20" fill="black" />
                                    <rect x="15" y="15" width="10" height="10" fill="white" />
                                    <rect x="65" y="5" width="30" height="30" fill="white" />
                                    <rect x="70" y="10" width="20" height="20" fill="black" />
                                    <rect x="75" y="15" width="10" height="10" fill="white" />
                                    <rect x="5" y="65" width="30" height="30" fill="white" />
                                    <rect x="10" y="70" width="20" height="20" fill="black" />
                                    <rect x="15" y="75" width="10" height="10" fill="white" />
                                    <rect x="42" y="10" width="16" height="16" fill="white" />
                                    <rect x="42" y="42" width="16" height="16" fill="white" />
                                    <rect x="10" y="42" width="16" height="16" fill="white" />
                                    <rect x="74" y="42" width="16" height="16" fill="white" />
                                    <rect x="42" y="74" width="16" height="16" fill="white" />
                                    <rect x="74" y="74" width="16" height="16" fill="white" />
                                </svg>
                            </div>
                            {showCardNumber && (
                                <span className="text-[9px] font-mono font-bold text-slate-800 mt-0.5 tracking-wider pointer-events-none">
                                    MNZ-123456
                                </span>
                            )}
                            {/* Drag Indicator Tooltip */}
                            <div className="absolute -top-7 bg-slate-900/90 text-white text-[10px] font-mono px-2 py-0.5 rounded-full pointer-events-none flex items-center gap-1 shadow">
                                <Move className="h-2.5 w-2.5" />
                                {qrX}%, {qrY}%
                            </div>
                        </div>
                    )}
                </div>

                {/* Hidden file inputs */}
                <input ref={frontRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'front')} />
                <input ref={backRef}  type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'back')} />

                {/* Upload Button */}
                <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 text-xs"
                    onClick={() => (cardSide === 'front' ? frontRef : backRef).current?.click()}
                >
                    <Upload className="h-4 w-4" />
                    {(cardSide === 'front' ? frontPreview : backPreview) ? `تغيير صورة الوجه ${cardSide === 'front' ? 'الأمامي' : 'الخلفي'}` : `رفع صورة الوجه ${cardSide === 'front' ? 'الأمامي' : 'الخلفي'}`}
                </Button>
            </div>

            {/* ── QR Positioning Controls (Shown when Back Side is active) ── */}
            {cardSide === 'back' && (
                <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 space-y-4 bg-blue-50/20">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                            <h4 className="text-sm font-bold text-gray-800">التحكم في مكان وحجم الـ QR</h4>
                        </div>
                        <span className="text-xs text-gray-400">أو اسحب الـ QR بالماوس مباشرة</span>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-bold text-gray-500">مواضع جاهزة سريعة:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {presets.map(p => (
                                <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => { setQrX(p.x); setQrY(p.y); }}
                                    className={cn(
                                        'py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center',
                                        qrX === p.x && qrY === p.y
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-3 pt-1">
                        {/* Horizontal X */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-gray-700">
                                <span>الموضع الأفقي (يمين / يسار):</span>
                                <span className="font-mono text-blue-600">{qrX}%</span>
                            </div>
                            <input
                                type="range"
                                min={10}
                                max={90}
                                value={qrX}
                                onChange={e => setQrX(Number(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        {/* Vertical Y */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-gray-700">
                                <span>الموضع الرأسي (أعلى / أسفل):</span>
                                <span className="font-mono text-blue-600">{qrY}%</span>
                            </div>
                            <input
                                type="range"
                                min={10}
                                max={90}
                                value={qrY}
                                onChange={e => setQrY(Number(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        {/* Size */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-gray-700">
                                <span>حجم كود الـ QR:</span>
                                <span className="font-mono text-blue-600">{qrSize}% من عرض الكارت</span>
                            </div>
                            <input
                                type="range"
                                min={15}
                                max={45}
                                value={qrSize}
                                onChange={e => setQrSize(Number(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200">
                            <input
                                type="checkbox"
                                checked={showQrBg}
                                onChange={e => setShowQrBg(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span>خلفية بيضاء حول الـ QR</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200">
                            <input
                                type="checkbox"
                                checked={showCardNumber}
                                onChange={e => setShowCardNumber(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span>إظهار رقم الكارت تحت الـ QR</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className={cn('p-3 rounded-xl border text-center', frontPreview ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
                    <p className="text-xs font-bold text-gray-700">الوجه الأمامي</p>
                    <p className={cn('text-xs mt-0.5', frontPreview ? 'text-emerald-600 font-bold' : 'text-gray-400')}>{frontPreview ? 'مرفوع ✓' : 'لم يُرفع'}</p>
                </div>
                <div className={cn('p-3 rounded-xl border text-center', backPreview ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200')}>
                    <p className="text-xs font-bold text-gray-700">الوجه الخلفي</p>
                    <p className={cn('text-xs mt-0.5', backPreview ? 'text-emerald-600 font-bold' : 'text-gray-400')}>{backPreview ? 'مرفوع ✓' : 'لم يُرفع'}</p>
                </div>
            </div>

            {/* Save Button */}
            <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || (!frontPreview && !backPreview)}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-sm"
            >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ تصميم الكارت وإعدادات الـ QR
            </Button>

            <p className="text-xs text-gray-400 text-center">
                عند الطباعة سيظهر الـ QR بدقة بنفس المكان والحجم المحدد · سيتم طباعة كل كارت مع ظهره جنباً إلى جنب
            </p>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SmartCardPage() {
    const [view, setView] = useState<View>('scanner');
    const [resolveResult, setResolveResult] = useState<CardResolveResult | null>(null);
    const [resolving, setResolving] = useState(false);
    const [showLinkStudentModal, setShowLinkStudentModal] = useState(false);
    const [showDisableModal, setShowDisableModal] = useState(false);
    const [tab, setTab] = useState<'scanner' | 'generate' | 'design'>('scanner');
    const qc = useQueryClient();
    const router = useRouter();
    const isLocal = useIsLocalDev();

    useEffect(() => {
        if (!isLocal && tab === 'design') {
            setTab('scanner');
        }
    }, [isLocal, tab]);

    const handleScan = useCallback(async (input: string) => {
        setResolving(true);
        try {
            const result = await resolveCard(input);
            setResolveResult(result);
            if (result.source === 'studentCode') {
                setView('result');
            } else if (result.cardStatus === 'NEW') {
                setView('link-choice');
            } else if (result.cardStatus === 'LINKED') {
                setView('result');
            } else if (result.cardStatus === 'DISABLED') {
                setView('result');
            }
        } catch {
            toast.error('لم يتم التعرف على الرمز أو الكارت');
        } finally {
            setResolving(false);
        }
    }, []);

    const handleReset = () => {
        setView('scanner');
        setResolveResult(null);
    };

    const unlinkMutation = useMutation({
        mutationFn: () => unlinkCard(resolveResult!.cardNumber!),
        onSuccess: () => {
            toast.success('تم فك ربط الكارت');
            qc.invalidateQueries({ queryKey: ['card-stats'] });
            handleReset();
        },
    });

    const tabs = [
        { key: 'scanner' as const, label: 'الماسح', icon: Scan },
        { key: 'generate' as const, label: 'الكروت', icon: Package },
        ...(isLocal ? [{ key: 'design' as const, label: 'التصميم', icon: Palette }] : []),
    ];

    return (
        <div className="w-full max-w-xl mx-auto px-4 sm:px-0 space-y-5 animate-in fade-in duration-500 pb-10 min-w-0" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                        <CreditCard className="h-6 w-6 text-primary" />
                        الكارت الذكي
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">امسح الكارت لتنفيذ الإجراءات السريعة</p>
                </div>
                {view !== 'scanner' && (
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs">
                        <Scan className="h-4 w-4" /> مسح جديد
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
                {tabs.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => { setTab(key); handleReset(); }}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all',
                            tab === key ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {tab === 'design' && isLocal ? (
                <DesignPanel />
            ) : tab === 'generate' ? (
                <GenerateBatchPanel />
            ) : (
                <>
                    {/* Scanner View */}
                    {view === 'scanner' && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                            {resolving ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-4">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                    <p className="text-sm text-gray-500">جاري التعرف على الكارت...</p>
                                </div>
                            ) : (
                                <QrScanner onScanned={handleScan} mode="actions" />
                            )}
                        </div>
                    )}

                    {/* Result View */}
                    {view === 'result' && resolveResult?.student && (
                        <div className="space-y-4">
                            {/* Source badge */}
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs gap-1">
                                    {resolveResult.source === 'card' ? <CreditCard className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                                    {resolveResult.source === 'card' ? 'كارت ذكي' : resolveResult.source === 'barcode' ? 'باركود' : 'كود'}
                                </Badge>
                                {resolveResult.cardNumber && (
                                    <span className="text-xs font-mono text-gray-400">{resolveResult.cardNumber}</span>
                                )}
                            </div>

                            <StudentSummaryCard student={resolveResult.student} />

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">إجراءات سريعة</p>
                                <FastActions
                                    student={resolveResult.student}
                                    cardNumber={resolveResult.cardNumber}
                                    onUnlink={() => unlinkMutation.mutate()}
                                />
                            </div>
                        </div>
                    )}

                    {/* Link Choice View */}
                    {view === 'link-choice' && resolveResult?.cardNumber && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                            <div className="text-center space-y-2">
                                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
                                    <CreditCard className="h-7 w-7 text-blue-600" />
                                </div>
                                <h3 className="font-bold text-gray-800">كارت جديد غير مربوط</h3>
                                <p className="text-sm text-gray-500">
                                    <span className="font-mono font-bold text-gray-700">{resolveResult.cardNumber}</span>
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowLinkStudentModal(true)}
                                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all"
                                >
                                    <Users className="h-7 w-7 text-primary" />
                                    <span className="text-sm font-bold text-primary">ربط بطالب موجود</span>
                                </button>
                                <button
                                    onClick={() => router.push(`/students?newCard=${resolveResult.cardNumber}`)}
                                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all"
                                >
                                    <User className="h-7 w-7 text-gray-600" />
                                    <span className="text-sm font-bold text-gray-700">إنشاء طالب جديد</span>
                                </button>
                            </div>
                            <Button variant="outline" onClick={handleReset} className="w-full">إلغاء</Button>
                        </div>
                    )}
                </>
            )}

            {/* Link Student Modal */}
            <Dialog open={showLinkStudentModal} onOpenChange={setShowLinkStudentModal}>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} dir="rtl" className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Link2 className="h-5 w-5 text-primary" /> ربط الكارت بطالب
                        </DialogTitle>
                    </DialogHeader>
                    {resolveResult?.cardNumber && (
                        <LinkStudentModal
                            cardNumber={resolveResult.cardNumber}
                            onLinked={async () => {
                                setShowLinkStudentModal(false);
                                // Re-resolve the card so we can show the student result
                                setResolving(true);
                                try {
                                    const updated = await resolveCard(resolveResult.cardNumber!);
                                    setResolveResult(updated);
                                    setView('result');
                                } catch {
                                    handleReset();
                                } finally {
                                    setResolving(false);
                                }
                            }}
                            onClose={() => setShowLinkStudentModal(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
