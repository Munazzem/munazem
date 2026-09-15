'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getCardTemplate,
    uploadCardTemplate,
    updateCardTemplate,
    deleteCardTemplate,
    type ICardTemplate
} from '@/lib/api/cards';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    CreditCard,
    Upload,
    Sliders,
    Sparkles,
    Move,
    RotateCcw,
    Loader2,
    Image as ImageIcon,
    FileCode,
    CheckCircle2,
    Trash2,
    Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardTemplateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CardTemplateModal({ open, onOpenChange }: CardTemplateModalProps) {
    const qc = useQueryClient();
    const [targetFace, setTargetFace] = useState<'back' | 'front'>('back');
    const [isUploading, setIsUploading] = useState(false);
    const [detectedInfo, setDetectedInfo] = useState<string | null>(null);

    // Current working state
    const [qrCode, setQrCode] = useState({ xPercent: 50, yPercent: 48, sizePercent: 32 });
    const [cardNumber, setCardNumber] = useState({
        xPercent: 50,
        yPercent: 82,
        fontSizePt: 11,
        color: '#000000',
        show: true
    });

    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewContainerRef = useRef<HTMLDivElement | null>(null);
    const [isDraggingQr, setIsDraggingQr] = useState(false);

    // Fetch existing template
    const { data: template, isLoading } = useQuery<ICardTemplate | null>({
        queryKey: ['card-template'],
        queryFn: getCardTemplate,
        enabled: open,
    });

    // Synchronize loaded template into local state
    useEffect(() => {
        if (template) {
            if (template.qrCode) {
                setQrCode({
                    xPercent: template.qrCode.xPercent ?? 50,
                    yPercent: template.qrCode.yPercent ?? 48,
                    sizePercent: template.qrCode.sizePercent ?? 32
                });
            }
            if (template.cardNumber) {
                setCardNumber({
                    xPercent: template.cardNumber.xPercent ?? 50,
                    yPercent: template.cardNumber.yPercent ?? 82,
                    fontSizePt: template.cardNumber.fontSizePt ?? 11,
                    color: template.cardNumber.color || '#000000',
                    show: template.cardNumber.show ?? true
                });
            }
        }
    }, [template]);

    // Save changes mutation
    const saveMutation = useMutation({
        mutationFn: () => updateCardTemplate({ qrCode, cardNumber }),
        onSuccess: () => {
            toast.success('تم حفظ إعدادات قالب الكارت بنجاح ✅');
            qc.invalidateQueries({ queryKey: ['card-template'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message || 'تعذر حفظ إعدادات القالب');
        }
    });

    // Delete template mutation
    const deleteMutation = useMutation({
        mutationFn: deleteCardTemplate,
        onSuccess: () => {
            toast.success('تم استعادة القالب الافتراضي');
            qc.invalidateQueries({ queryKey: ['card-template'] });
            setDetectedInfo(null);
        }
    });

    // Handle File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setDetectedInfo(null);

        try {
            const res = await uploadCardTemplate(file, targetFace);
            toast.success(res.message);

            if (res.detectedLayers?.qrCode || res.detectedLayers?.cardNumber) {
                const parts: string[] = [];
                if (res.detectedLayers.qrCode) {
                    parts.push(`طبقة QR Code (${res.detectedLayers.qrLayerName || 'QR_CODE'})`);
                }
                if (res.detectedLayers.cardNumber) {
                    parts.push(`طبقة رقم الكارت (${res.detectedLayers.cardNumLayerName || 'CARD_NUMBER'})`);
                }
                setDetectedInfo(`تم التعرف تلقائياً من ملف الفوتوشوب على: ${parts.join(' و ')}`);
            }

            // Sync updated template
            if (res.template) {
                if (res.template.qrCode) setQrCode(res.template.qrCode);
                if (res.template.cardNumber) setCardNumber(res.template.cardNumber);
            }

            qc.invalidateQueries({ queryKey: ['card-template'] });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'تعذر رفع ومعالجة ملف التصميم');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Live Card Dragging Handler for QR Code
    const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDraggingQr || !previewContainerRef.current) return;
        const rect = previewContainerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const clampedX = Math.round(Math.min(Math.max(x, 10), 90) * 10) / 10;
        const clampedY = Math.round(Math.min(Math.max(y, 10), 90) * 10) / 10;

        setQrCode(prev => ({ ...prev, xPercent: clampedX, yPercent: clampedY }));
    };

    const activeBg = targetFace === 'back'
        ? template?.backImageUrl
        : template?.frontImageUrl;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} dir="rtl" className="max-w-4xl max-h-[92vh] overflow-y-auto p-6">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="text-xl font-black text-gray-900 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <CreditCard className="h-6 w-6 text-primary" />
                            تخصيص قالب كروت PVC الذكية (CR80)
                        </span>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            مقاس قياسي 85.6mm × 53.98mm
                        </Badge>
                    </DialogTitle>
                    <p className="text-xs text-gray-500">
                        ارفع تصميم الكارت بملف فوتوشوب (PSD) أو صورة (PNG/JPG) وسيتم وضع الـ QR ورقم الكارت تلقائياً بدقة الطباعة.
                    </p>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-gray-500">جاري تحميل إعدادات القالب...</p>
                    </div>
                ) : (
                    <div className="space-y-6 pt-2">
                        {/* Target Face Selector */}
                        <div className="flex items-center justify-between border-b pb-3">
                            <div className="flex rounded-lg bg-gray-100 p-1 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setTargetFace('back')}
                                    className={cn(
                                        'px-4 py-1.5 text-xs font-bold rounded-md transition-all',
                                        targetFace === 'back' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    )}
                                >
                                    الوجه الخلفي (موضع الـ QR Code)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetFace('front')}
                                    className={cn(
                                        'px-4 py-1.5 text-xs font-bold rounded-md transition-all',
                                        targetFace === 'front' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    )}
                                >
                                    الوجه الأمامي (اختياري للطباعة وجهين)
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".psd,image/png,image/jpeg,image/jpg,image/webp"
                                    className="hidden"
                                />
                                <Button
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="gap-2 bg-primary hover:bg-primary/90 text-xs font-bold"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            جاري المعالجة...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="h-4 w-4" />
                                            رفع تصميم {targetFace === 'back' ? 'الوجه الخلفي' : 'الوجه الأمامي'} (PSD / صورة)
                                        </>
                                    )}
                                </Button>

                                {template && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 hover:bg-red-50 text-xs"
                                        onClick={() => deleteMutation.mutate()}
                                        disabled={deleteMutation.isPending}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 ml-1" />
                                        حذف القالب
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Detection Alert */}
                        {detectedInfo && (
                            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="font-semibold">{detectedInfo}</span>
                            </div>
                        )}

                        {/* Interactive Live Card Preview */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                    <Eye className="h-4 w-4 text-gray-500" />
                                    معاينة حية لشكل الكارت (CR80) — يمكنك سحب الـ QR مباشرة داخل الكارت:
                                </span>
                                {targetFace === 'back' && (
                                    <span className="text-[11px] text-gray-400">
                                        الموضع: X: {qrCode.xPercent}% · Y: {qrCode.yPercent}% · الحجم: {qrCode.sizePercent}%
                                    </span>
                                )}
                            </div>

                            <div className="bg-slate-900/90 rounded-2xl p-6 flex items-center justify-center shadow-inner">
                                <div
                                    ref={previewContainerRef}
                                    onMouseMove={handlePreviewMouseMove}
                                    onMouseUp={() => setIsDraggingQr(false)}
                                    onMouseLeave={() => setIsDraggingQr(false)}
                                    className="relative w-full max-w-[460px] aspect-[85.6/53.98] rounded-xl overflow-hidden shadow-2xl border border-white/20 select-none bg-white cursor-crosshair"
                                    style={{
                                        boxShadow: '0 12px 36px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    {/* Card Background */}
                                    {activeBg ? (
                                        <img
                                            src={activeBg}
                                            alt="Card Design"
                                            className="w-full height-full object-cover absolute inset-0 pointer-events-none"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-slate-900 text-white p-4 text-center">
                                            <ImageIcon className="h-10 w-10 text-white/40 mb-2" />
                                            <p className="text-xs font-bold">لم يتم رفع صورة للـ {targetFace === 'back' ? 'الوجه الخلفي' : 'الوجه الأمامي'}</p>
                                            <p className="text-[10px] text-white/60 mt-1">اضغط على زر رفع تصميم لاختيار ملف PSD أو صورة</p>
                                        </div>
                                    )}

                                    {/* QR Code Overlay (Back Face only) */}
                                    {targetFace === 'back' && (
                                        <div
                                            onMouseDown={() => setIsDraggingQr(true)}
                                            className={cn(
                                                'absolute aspect-square flex items-center justify-center cursor-move transition-shadow z-20',
                                                isDraggingQr ? 'ring-2 ring-primary ring-offset-2' : 'hover:ring-1 hover:ring-blue-400'
                                            )}
                                            style={{
                                                left: `${qrCode.xPercent}%`,
                                                top: `${qrCode.yPercent}%`,
                                                width: `${qrCode.sizePercent}%`,
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                            title="اسحب لتغيير موضع الـ QR Code"
                                        >
                                            <div className="w-full h-full bg-white p-1 rounded-sm shadow-md border border-gray-200/80 flex items-center justify-center">
                                                {/* Simulated QR Code Pattern */}
                                                <div className="w-full h-full bg-black relative flex items-center justify-center">
                                                    <div className="absolute inset-1 bg-white flex items-center justify-center">
                                                        <div className="w-3/4 h-3/4 bg-black flex items-center justify-center">
                                                            <div className="w-1/2 h-1/2 bg-white" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="absolute -top-4 bg-primary text-white text-[9px] font-bold px-1 rounded shadow opacity-0 hover:opacity-100 transition-opacity">
                                                QR
                                            </div>
                                        </div>
                                    )}

                                    {/* Card Number Overlay (Back Face only) */}
                                    {targetFace === 'back' && cardNumber.show && (
                                        <div
                                            className="absolute font-mono font-bold tracking-wider select-none z-20 pointer-events-none whitespace-nowrap"
                                            style={{
                                                left: `${cardNumber.xPercent}%`,
                                                top: `${cardNumber.yPercent}%`,
                                                fontSize: `${cardNumber.fontSizePt}px`,
                                                color: cardNumber.color,
                                                transform: 'translate(-50%, -50%)',
                                                textShadow: cardNumber.color === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.8)' : 'none'
                                            }}
                                        >
                                            MNZ-XXXX-00001
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Precision Controls Panel (Back Face) */}
                        {targetFace === 'back' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                {/* QR Code Controls */}
                                <div className="space-y-3 bg-white p-3.5 rounded-lg border border-gray-200/70 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                            <Sliders className="h-3.5 w-3.5 text-primary" />
                                            إحداثيات الـ QR Code
                                        </h4>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[11px] text-gray-500 hover:text-primary px-2"
                                            onClick={() => setQrCode({ xPercent: 50, yPercent: 48, sizePercent: 32 })}
                                        >
                                            <RotateCcw className="h-3 w-3 ml-1" />
                                            توسيط
                                        </Button>
                                    </div>

                                    {/* X Position */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[11px] text-gray-500">
                                            <span>الموضع الأفقي (X):</span>
                                            <span className="font-mono font-bold">{qrCode.xPercent}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={10} max={90} step={0.5}
                                            value={qrCode.xPercent}
                                            onChange={e => setQrCode(p => ({ ...p, xPercent: parseFloat(e.target.value) }))}
                                            className="w-full accent-primary h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                        />
                                    </div>

                                    {/* Y Position */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[11px] text-gray-500">
                                            <span>الموضع الرأسي (Y):</span>
                                            <span className="font-mono font-bold">{qrCode.yPercent}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={10} max={90} step={0.5}
                                            value={qrCode.yPercent}
                                            onChange={e => setQrCode(p => ({ ...p, yPercent: parseFloat(e.target.value) }))}
                                            className="w-full accent-primary h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                        />
                                    </div>

                                    {/* Size */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[11px] text-gray-500">
                                            <span>حجم الـ QR:</span>
                                            <span className="font-mono font-bold">{qrCode.sizePercent}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={15} max={55} step={1}
                                            value={qrCode.sizePercent}
                                            onChange={e => setQrCode(p => ({ ...p, sizePercent: parseFloat(e.target.value) }))}
                                            className="w-full accent-primary h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                        />
                                    </div>
                                </div>

                                {/* Card Number Controls */}
                                <div className="space-y-3 bg-white p-3.5 rounded-lg border border-gray-200/70 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                            <FileCode className="h-3.5 w-3.5 text-primary" />
                                            إعدادات رقم الكارت
                                        </h4>
                                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={cardNumber.show}
                                                onChange={e => setCardNumber(p => ({ ...p, show: e.target.checked }))}
                                                className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                                            />
                                            إظهار الرقم
                                        </label>
                                    </div>

                                    {cardNumber.show && (
                                        <>
                                            {/* X Position */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[11px] text-gray-500">
                                                    <span>الموضع الأفقي (X):</span>
                                                    <span className="font-mono font-bold">{cardNumber.xPercent}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={10} max={90} step={0.5}
                                                    value={cardNumber.xPercent}
                                                    onChange={e => setCardNumber(p => ({ ...p, xPercent: parseFloat(e.target.value) }))}
                                                    className="w-full accent-primary h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                                />
                                            </div>

                                            {/* Y Position */}
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[11px] text-gray-500">
                                                    <span>الموضع الرأسي (Y):</span>
                                                    <span className="font-mono font-bold">{cardNumber.yPercent}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min={10} max={95} step={0.5}
                                                    value={cardNumber.yPercent}
                                                    onChange={e => setCardNumber(p => ({ ...p, yPercent: parseFloat(e.target.value) }))}
                                                    className="w-full accent-primary h-1.5 bg-gray-200 rounded-lg cursor-pointer"
                                                />
                                            </div>

                                            {/* Font Size & Color */}
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <div>
                                                    <span className="text-[11px] text-gray-500 block mb-1">حجم الخط:</span>
                                                    <input
                                                        type="number"
                                                        min={8} max={24}
                                                        value={cardNumber.fontSizePt}
                                                        onChange={e => setCardNumber(p => ({ ...p, fontSizePt: parseInt(e.target.value) || 11 }))}
                                                        className="w-full border rounded px-2 py-1 text-xs font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <span className="text-[11px] text-gray-500 block mb-1">لون الخط:</span>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="color"
                                                            value={cardNumber.color}
                                                            onChange={e => setCardNumber(p => ({ ...p, color: e.target.value }))}
                                                            className="w-8 h-7 rounded border cursor-pointer"
                                                        />
                                                        <span className="text-[11px] font-mono">{cardNumber.color}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer Controls */}
                        <div className="flex items-center justify-between pt-2 border-t">
                            <div className="text-[11px] text-gray-500">
                                يتم تطبيق هذا القالب تلقائياً على كل طباعة كروت PVC الذكية.
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                    className="text-xs"
                                >
                                    إغلاق
                                </Button>
                                <Button
                                    onClick={() => saveMutation.mutate()}
                                    disabled={saveMutation.isPending}
                                    className="gap-1.5 text-xs font-bold"
                                >
                                    {saveMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    حفظ إعدادات القالب
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
