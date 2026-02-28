'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, Search, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QRScannerPanelProps {
    sessionId: string;
    onScan: (studentId: string) => Promise<void>;
    onManualSearch: (query: string) => void;
    disabled?: boolean;
}

export function QRScannerPanel({
    sessionId,
    onScan,
    onManualSearch,
    disabled = false,
}: QRScannerPanelProps) {
    const scannerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const lastScannedRef = useRef<string | null>(null);

    const SCANNER_ID = `qr-scanner-${sessionId}`;

    const startCamera = useCallback(async () => {
        if (isCameraActive || isCameraLoading) return;
        setIsCameraLoading(true);
        setCameraError(null);

        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const scanner = new Html5Qrcode(SCANNER_ID);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 15,
                    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                        const side = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.82);
                        return { width: side, height: side };
                    },
                    aspectRatio: 1.0,
                },
                async (decodedText: string) => {
                    // Debounce — ignore same QR within 3 seconds
                    if (lastScannedRef.current === decodedText) return;
                    lastScannedRef.current = decodedText;
                    setTimeout(() => { lastScannedRef.current = null; }, 3000);

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
            setIsCameraActive(true);
        } catch (err: any) {
            const msg =
                err?.message?.includes('Permission')
                    ? 'لم يتم منح صلاحية الكاميرا. برجاء السماح للمتصفح بالوصول إلى الكاميرا.'
                    : 'تعذر تشغيل الكاميرا. تأكد من وجود كاميرا متصلة.';
            setCameraError(msg);
        } finally {
            setIsCameraLoading(false);
        }
    }, [isCameraActive, isCameraLoading, onScan, SCANNER_ID]);

    const stopCamera = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch {}
            scannerRef.current = null;
        }
        setIsCameraActive(false);
        setLastScanned(null);
        lastScannedRef.current = null;
    }, []);

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
            {/* Camera Toggle */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    مسح QR Code
                </h3>
                <Button
                    size="sm"
                    variant={isCameraActive ? 'destructive' : 'default'}
                    onClick={isCameraActive ? stopCamera : startCamera}
                    disabled={disabled || isCameraLoading}
                    className="gap-2"
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

            {/* Camera Viewport */}
            <div
                className={cn(
                    'relative rounded-xl overflow-hidden bg-gray-900 transition-all',
                    isCameraActive ? 'h-80 sm:h-96' : 'h-0'
                )}
            >
                <div id={SCANNER_ID} ref={containerRef} className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover" />
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-white rounded-lg px-4 py-2 flex items-center gap-2 text-sm font-medium">
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

            {/* Last Scanned */}
            {lastScanned && (
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
