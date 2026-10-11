'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface QrScannerProps {
    onScanned: (value: string) => void;
    mode?: 'attendance' | 'actions';
    keepOpen?: boolean;
    autoStart?: boolean;
}

export function QrScanner({ onScanned, mode = 'actions', keepOpen = false, autoStart = false }: QrScannerProps) {
    const [active, setActive] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannedRef = useRef(false);
    const lastScannedCodeRef = useRef<string | null>(null);

    const isContinuous = keepOpen || mode === 'attendance';
    const scannerId = `qr-reader-${mode}`;

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { /* ignore */ }
            scannerRef.current = null;
        }
        setActive(false);
    }, []);

    const startScanner = useCallback(async () => {
        try {
            if (scannerRef.current) return;
            const scanner = new Html5Qrcode(scannerId, {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.CODABAR,
                    Html5QrcodeSupportedFormats.ITF,
                ],
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true,
                },
                verbose: false,
            } as any);
            scannerRef.current = scanner;
            scannedRef.current = false;
            setActive(true);

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 25,
                    videoConstraints: {
                        facingMode: { ideal: 'environment' },
                        width:  { ideal: 1920, min: 640 },
                        height: { ideal: 1080, min: 480 },
                        focusMode: { ideal: 'continuous' } as any,
                    },
                } as any,
                (decoded) => {
                    const cleanDecoded = (decoded || '').replace(/^\*+|\*+$/g, '').trim();
                    if (!cleanDecoded) return;
                    if (scannedRef.current) return;
                    if (isContinuous && lastScannedCodeRef.current === cleanDecoded) return;

                    scannedRef.current = true;
                    lastScannedCodeRef.current = cleanDecoded;

                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        try { navigator.vibrate(60); } catch {}
                    }

                    if (isContinuous) {
                        setTimeout(() => {
                            scannedRef.current = false;
                            lastScannedCodeRef.current = null;
                        }, 2000);
                        onScanned(cleanDecoded);
                    } else {
                        stopScanner();
                        onScanned(cleanDecoded);
                    }
                },
                () => {}
            );
        } catch {
            toast.error('تعذر تشغيل الكاميرا — تأكد من منح الإذن');
            setActive(false);
        }
    }, [isContinuous, onScanned, scannerId, stopScanner]);

    useEffect(() => {
        if (autoStart) {
            startScanner();
        }
    }, [autoStart, startScanner]);

    useEffect(() => () => { stopScanner(); }, [stopScanner]);

    return (
        <div className="space-y-4 w-full max-w-full overflow-hidden">
            <style jsx>{`
                @keyframes laserSweep {
                    0% { top: 8%; opacity: 0.6; }
                    50% { top: 90%; opacity: 1; }
                    100% { top: 8%; opacity: 0.6; }
                }
                .scanner-laser {
                    animation: laserSweep 2s ease-in-out infinite;
                }
            `}</style>
            <div className="relative w-full max-w-full rounded-2xl overflow-hidden bg-gray-950">
                <div
                    id={scannerId}
                    className={cn(
                        'w-full max-w-full transition-all',
                        '[&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_video]:!max-w-full',
                        '[&_div]:!max-w-full [&_canvas]:!max-w-full',
                        active ? 'aspect-[4/3] sm:aspect-video w-full' : 'h-0 border-none'
                    )}
                />

                {/* Scan box spanning the entire camera frame with full-width sweep */}
                {active && (
                    <div className="absolute inset-2 sm:inset-3 pointer-events-none rounded-xl border border-emerald-400/50 overflow-hidden">
                        {/* Animated Laser Scanning Line */}
                        <div className="scanner-laser absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_rgba(52,211,153,1)]" />
                        {/* Corner brackets right at the borders of the camera box */}
                        <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
                        <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
                        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
                        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
                    </div>
                )}
            </div>

            {active ? (
                <button
                    type="button"
                    onClick={stopScanner}
                    className="w-full py-2 text-sm text-gray-500 hover:text-red-500 transition-colors font-semibold cursor-pointer"
                >
                    إيقاف الكاميرا
                </button>
            ) : (
                <button
                    type="button"
                    onClick={startScanner}
                    className="w-full flex flex-col items-center justify-center gap-3 p-10 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all group cursor-pointer"
                >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <QrCode className="h-8 w-8 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-primary">
                        {mode === 'attendance' ? 'اضغط لمسح كارت الحضور' : 'اضغط لمسح الكارت'}
                    </span>
                    <span className="text-xs text-gray-400">يدعم QR Code والباركود الخطي</span>
                </button>
            )}

            {/* Manual input fallback */}
            <div className="flex items-center gap-2 w-full">
                <Input
                    placeholder="أو أدخل رقم الكارت / الكود يدوياً..."
                    value={manualInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualInput(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter' && manualInput.trim()) {
                            onScanned(manualInput.trim());
                            setManualInput('');
                        }
                    }}
                    className="flex-1 min-w-0 text-xs sm:text-sm bg-gray-50 h-10 rounded-xl"
                />
                <Button
                    onClick={() => {
                        if (manualInput.trim()) {
                            onScanned(manualInput.trim());
                            setManualInput('');
                        }
                    }}
                    disabled={!manualInput.trim()}
                    size="sm"
                    className="shrink-0 h-10 px-4 rounded-xl"
                >
                    بحث
                </Button>
            </div>
        </div>
    );
}
