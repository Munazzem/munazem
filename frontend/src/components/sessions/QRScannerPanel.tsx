'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Search, UserCheck, Loader2, QrCode, Volume2, VolumeX, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { soundEffects } from '@/lib/utils/sound';

export interface ScanFeedback {
    studentName: string;
    studentCode?: string;
    hasDues: boolean;
    debtAmount?: number;
    timestamp: number;
}

interface QRScannerPanelProps {
    sessionId: string;
    onScan: (studentId: string) => Promise<void>;
    onManualSearch: (query: string) => void;
    disabled?: boolean;
    scanFeedback?: ScanFeedback | null;
}

export function QRScannerPanel({
    sessionId,
    onScan,
    onManualSearch,
    disabled = false,
    scanFeedback = null,
}: QRScannerPanelProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMuted, setIsMuted] = useState(() => soundEffects.getMuted());
    const lastScannedRef = useRef<string | null>(null);

    // Use consistent ID pattern matching QrScanner
    const SCANNER_ID = `qr-reader-session-${sessionId}`;

    const stopCamera = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch {
                /* ignore */
            }
            scannerRef.current = null;
        }
        setIsCameraActive(false);
        setLastScanned(null);
        lastScannedRef.current = null;
    }, []);

    const startCamera = useCallback(async () => {
        if (scannerRef.current || isCameraLoading) return;
        setIsCameraLoading(true);
        setCameraError(null);
        soundEffects.resume();

        // 1. Activate camera view FIRST so DOM has computed aspect ratio & dimensions on iOS Safari
        setIsCameraActive(true);

        // 2. Wait a tick for React commit and Safari layout calculation
        await new Promise((r) => setTimeout(r, 80));

        try {
            const scanner = new Html5Qrcode(SCANNER_ID, {
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true,
                },
                verbose: false,
            });
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 24,
                    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                        const vw = viewfinderWidth > 0 ? viewfinderWidth : 320;
                        const vh = viewfinderHeight > 50 ? viewfinderHeight : Math.floor(vw * 0.75);
                        const minEdge = Math.min(vw, vh);
                        const isPortrait = vh >= vw;
                        const boxWidth = Math.floor(vw * (isPortrait ? 0.92 : 0.88));
                        const boxHeight = Math.floor(vh * (isPortrait ? 0.65 : 0.80));
                        return {
                            width: Math.max(boxWidth, Math.floor(minEdge * 0.90), 200),
                            height: Math.max(boxHeight, Math.floor(minEdge * 0.70), 180),
                        };
                    },
                    videoConstraints: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                },
                async (decodedText: string) => {
                    // Debounce — ignore same QR within 3 seconds
                    if (lastScannedRef.current === decodedText) return;
                    lastScannedRef.current = decodedText;
                    setTimeout(() => { lastScannedRef.current = null; }, 3000);

                    // Haptic feedback on mobile if supported
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        try { navigator.vibrate(80); } catch {}
                    }

                    setLastScanned(decodedText);
                    setIsProcessing(true);
                    try {
                        await onScan(decodedText);
                    } finally {
                        setIsProcessing(false);
                    }
                },
                () => {}
            );
        } catch (err: any) {
            await stopCamera();
            const msg =
                err?.message?.includes('Permission')
                    ? 'لم يتم منح صلاحية الكاميرا. برجاء السماح للمتصفح بالوصول إلى الكاميرا.'
                    : 'تعذر تشغيل الكاميرا — تأكد من منح الإذن ووجود كاميرا متصلة.';
            setCameraError(msg);
        } finally {
            setIsCameraLoading(false);
        }
    }, [isCameraLoading, onScan, SCANNER_ID, stopCamera]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
            }
        };
    }, []);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            onManualSearch(searchQuery.trim());
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Header: Camera Toggle + Audio Cue Mute Toggle */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    مسح QR Code
                </h3>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            const next = soundEffects.toggleMute();
                            setIsMuted(next);
                        }}
                        className={cn(
                            "h-8 px-2.5 text-xs gap-1.5 transition-colors",
                            isMuted ? "text-gray-400 border-gray-200 hover:text-gray-600" : "text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/50"
                        )}
                        title={isMuted ? "التنبيه الصوتي مكتوم - اضغط للتشغيل" : "التنبيه الصوتي مفعل - اضغط للكتم"}
                    >
                        {isMuted ? <VolumeX className="h-3.5 w-3.5 text-gray-400" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-600" />}
                        <span>{isMuted ? "مكتوم" : "صوت"}</span>
                    </Button>

                    <Button
                        size="sm"
                        variant={isCameraActive ? 'destructive' : 'default'}
                        onClick={isCameraActive ? stopCamera : startCamera}
                        disabled={disabled || isCameraLoading}
                        className="gap-2 h-8 text-xs sm:text-sm"
                    >
                        {isCameraLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isCameraActive ? (
                            <CameraOff className="h-4 w-4" />
                        ) : (
                            <Camera className="h-4 w-4" />
                        )}
                        {isCameraLoading ? 'جارٍ التشغيل...' : isCameraActive ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
                    </Button>
                </div>
            </div>

            {/* Camera Viewport (Direct aspect-ratio container to prevent iOS Safari 0-height bug) */}
            <div className="relative w-full max-w-full overflow-hidden">
                <div
                    id={SCANNER_ID}
                    className={cn(
                        'w-full max-w-full rounded-2xl overflow-hidden border-2 border-dashed transition-all bg-gray-950',
                        '[&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_video]:!max-w-full',
                        '[&_div]:!max-w-full [&_canvas]:!max-w-full',
                        isCameraActive ? 'border-primary aspect-[4/3] sm:aspect-video w-full' : 'border-gray-200 h-0 border-none'
                    )}
                />

                {!isCameraActive && (
                    <button
                        type="button"
                        onClick={startCamera}
                        disabled={disabled || isCameraLoading}
                        className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all group cursor-pointer disabled:opacity-50"
                    >
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            {isCameraLoading ? (
                                <Loader2 className="h-7 w-7 text-primary animate-spin" />
                            ) : (
                                <QrCode className="h-7 w-7 text-primary" />
                            )}
                        </div>
                        <span className="text-sm font-semibold text-primary">
                            {isCameraLoading ? 'جارٍ تشغيل الكاميرا...' : 'اضغط لتشغيل كاميرا الحضور'}
                        </span>
                        <span className="text-xs text-gray-400">مسح كروت الطلاب و QR Code تلقائياً</span>
                    </button>
                )}

                {isProcessing && (
                    <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center z-10">
                        <div className="bg-white rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium shadow-lg">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            جارٍ التسجيل...
                        </div>
                    </div>
                )}
            </div>

            {/* Camera Error */}
            {cameraError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                    {cameraError}
                </div>
            )}

            {/* Live Instant Visual Cue Banner for Scanned Student */}
            {scanFeedback && (
                <div
                    key={scanFeedback.timestamp}
                    className={cn(
                        "p-3 sm:p-4 rounded-xl border-2 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-200",
                        scanFeedback.hasDues
                            ? "border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50/70 text-amber-950"
                            : "border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50/70 text-emerald-950"
                    )}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                                scanFeedback.hasDues ? "bg-amber-200 text-amber-800" : "bg-emerald-200 text-emerald-800"
                            )}>
                                {scanFeedback.hasDues ? (
                                    <AlertTriangle className="h-5 w-5 animate-pulse text-amber-700" />
                                ) : (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-sm sm:text-base truncate">
                                        {scanFeedback.studentName}
                                    </h4>
                                    <span className={cn(
                                        "text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0",
                                        scanFeedback.hasDues ? "bg-amber-200/90 text-amber-900" : "bg-emerald-200/90 text-emerald-900"
                                    )}>
                                        حاضر ✓
                                    </span>
                                </div>
                                <p className="text-xs mt-0.5 font-medium truncate">
                                    {scanFeedback.studentCode ? `كود: ${scanFeedback.studentCode} · ` : ''}
                                    {scanFeedback.hasDues ? (
                                        <span className="font-bold text-red-600">
                                            {scanFeedback.debtAmount && scanFeedback.debtAmount > 0
                                                ? `متبقي عليه: ${scanFeedback.debtAmount} ج.م`
                                                : 'غير مسدد لاشتراك الدورة الحالية'}
                                        </span>
                                    ) : (
                                        <span className="text-emerald-700 font-bold">
                                            خالص جميع المستحقات ✓
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>

                        <span className={cn(
                            "text-xs font-bold px-2.5 py-1 rounded-lg shrink-0",
                            scanFeedback.hasDues
                                ? "bg-red-100 text-red-700 border border-red-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        )}>
                            {scanFeedback.hasDues ? '⚠️ عليه مصاريف' : '✓ بدون مستحقات'}
                        </span>
                    </div>
                </div>
            )}

            {/* Last Raw Scanned Code (if no feedback banner) */}
            {!scanFeedback && lastScanned && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                    <UserCheck className="h-4 w-4 shrink-0" />
                    <span>آخر مسح: <span className="font-mono text-xs">{lastScanned.slice(0, 24)}…</span></span>
                </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 text-gray-400 text-xs">
                <div className="flex-1 h-px bg-gray-200" />
                أو أدخل يدوياً
                <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Manual Search */}
            <div>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <Search className="h-5 w-5 text-primary" />
                    بحث يدوي
                </h3>
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                    <Input
                        placeholder="اسم الطالب أو الكود..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={disabled}
                        className="flex-1"
                        dir="rtl"
                    />
                    <Button type="submit" size="sm" disabled={disabled || !searchQuery.trim()}>
                        بحث
                    </Button>
                </form>
                <p className="text-xs text-gray-400 mt-1">
                    ابحث عن الطالب ثم اضغط على اسمه في القائمة لتسجيل حضوره
                </p>
            </div>
        </div>
    );
}
