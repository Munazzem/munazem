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
} from '@/lib/api/cards';
import type { CardResolveResult, CardStats, ICard } from '@/lib/api/cards';
import { fetchStudents } from '@/lib/api/students';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreditCard, User, Users, Wallet, BookOpen, FileText,
    MessageSquare, Printer, Unlink, CheckCircle2,
    Loader2, Package, Scan, Link2, Hash, ExternalLink } from 'lucide-react';
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
function GenerateBatchPanel() {
    const [count, setCount] = useState(50);
    const [lastBatchId, setLastBatchId] = useState<string | null>(null);
    const qc = useQueryClient();

    const generateMutation = useMutation({
        mutationFn: () => generateCardBatch(count),
        onSuccess: (data) => {
            toast.success(`تم إنشاء ${data.count} كارت بنجاح ✅`);
            setLastBatchId(data.batchId);
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
                    <StatCard label="جديدة" value={stats.NEW} color="text-blue-600 bg-blue-50" />
                    <StatCard label="مربوطة" value={stats.LINKED} color="text-green-600 bg-green-50" />
                    <StatCard label="معطلة" value={stats.DISABLED} color="text-red-600 bg-red-50" />
                </div>
            )}

            {/* Generate form */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-4 border border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" /> إنشاء batch جديد
                </h3>
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
                {lastBatchId && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        <span className="text-sm text-green-700 flex-1">تم إنشاء الـ batch بنجاح</span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100 text-xs"
                            onClick={() => window.open(getCardBatchPrintUrl(lastBatchId), '_blank')}
                        >
                            <Printer className="h-3.5 w-3.5" /> طباعة الكروت
                        </Button>
                    </div>
                )}
            </div>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SmartCardPage() {
    const [view, setView] = useState<View>('scanner');
    const [resolveResult, setResolveResult] = useState<CardResolveResult | null>(null);
    const [resolving, setResolving] = useState(false);
    const [showLinkStudentModal, setShowLinkStudentModal] = useState(false);
    const [showDisableModal, setShowDisableModal] = useState(false);
    const [tab, setTab] = useState<'scanner' | 'generate'>('scanner');
    const qc = useQueryClient();

    const handleScan = useCallback(async (input: string) => {
        setResolving(true);
        try {
            const result = await resolveCard(input);
            setResolveResult(result);
            if (result.cardStatus === 'NEW') {
                setView('link-choice');
            } else {
                setView('result');
            }
        } catch {
            // error handled globally
        } finally {
            setResolving(false);
        }
    }, []);

    const handleReset = () => {
        setResolveResult(null);
        setView('scanner');
    };

    const unlinkMutation = useMutation({
        mutationFn: () => unlinkCard(resolveResult!.cardNumber!),
        onSuccess: () => {
            toast.success('تم فك ربط الكارت');
            qc.invalidateQueries({ queryKey: ['card-stats'] });
            handleReset();
        },
    });

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
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                        <Scan className="h-4 w-4" /> مسح جديد
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
                {([['scanner', 'الماسح', Scan], ['generate', 'الكروت', Package]] as const).map(([key, label, Icon]) => (
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
            {tab === 'generate' ? (
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
                                    onClick={() => window.location.href = `/students?newCard=${resolveResult.cardNumber}`}
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
                            onLinked={() => { setShowLinkStudentModal(false); handleReset(); }}
                            onClose={() => setShowLinkStudentModal(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
