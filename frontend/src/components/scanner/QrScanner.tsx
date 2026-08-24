'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { QrCode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface QrScannerProps {
    onScanned: (value: string) => void;
    mode?: 'attendance' | 'actions'; // Can be used for UI changes if needed
}

export function QrScanner({ onScanned, mode = 'actions' }: QrScannerProps) {
    const [active, setActive] = useState(false);
    const [manualInput, setManualInput] = useState('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannedRef = useRef(false);

    // Ensure we have a unique ID for the scanner if multiple could exist, but usually one per page
    const scannerId = `qr-reader-${mode}`;

    const startScanner = useCallback(async () => {
        try {
            if (scannerRef.current) return;
            const scanner = new Html5Qrcode(scannerId);
            scannerRef.current = scanner;
            scannedRef.current = false;
            setActive(true);
            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 24,
                    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                        const isPortrait = viewfinderHeight >= viewfinderWidth;
                        const boxWidth = Math.floor(viewfinderWidth * (isPortrait ? 0.92 : 0.88));
                        const boxHeight = Math.floor(viewfinderHeight * (isPortrait ? 0.65 : 0.80));
                        return {
                            width: Math.max(boxWidth, Math.floor(minEdge * 0.90)),
                            height: Math.max(boxHeight, Math.floor(minEdge * 0.70)),
                        };
                    },
                    videoConstraints: {
                        facingMode: 'environment',
                        width: { min: 640, ideal: 1920 },
                        height: { min: 480, ideal: 1080 },
                    },
                },
                (decoded) => {
                    if (scannedRef.current) return;
                    scannedRef.current = true;
                    stopScanner();
                    onScanned(decoded);
                },
                () => {}
            );
        } catch {
            toast.error('تعذر تشغيل الكاميرا — تأكد من منح الإذن');
            setActive(false);
        }
    }, [onScanned, scannerId]);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { /* ignore */ }
            scannerRef.current = null;
        }
        setActive(false);
    }, []);

    useEffect(() => () => { stopScanner(); }, [stopScanner]);

    return (
        <div className="space-y-4 w-full">
            <div
                id={scannerId}
                className={cn(
                    'w-full rounded-2xl overflow-hidden border-2 border-dashed transition-all bg-gray-950 [&>video]:w-full [&>video]:h-full [&>video]:object-cover',
                    active ? 'border-primary aspect-[4/3] sm:aspect-video min-h-[300px] max-h-[75vh]' : 'border-gray-200 h-0 border-none'
                )}
            />
            {!active ? (
                <button
                    onClick={startScanner}
                    className="w-full flex flex-col items-center justify-center gap-3 p-10 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all group cursor-pointer"
                >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <QrCode className="h-8 w-8 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-primary">
                        {mode === 'attendance' ? 'اضغط لمسح كارت الحضور' : 'اضغط لمسح الكارت'}
                    </span>
                    <span className="text-xs text-gray-400">QR Code / باركود</span>
                </button>
            ) : (
                <button onClick={stopScanner} className="w-full py-2 text-sm text-gray-500 hover:text-red-500 transition-colors font-semibold cursor-pointer">
                    إيقاف الكاميرا
                </button>
            )}
            
            {/* Manual input fallback */}
            <div className="flex items-center gap-2 w-full">
                <Input
                    placeholder="أو أدخل رقم الكارت / الكود يدوياً..."
                    value={manualInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualInput(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && manualInput.trim()) { onScanned(manualInput.trim()); setManualInput(''); }}}
                    className="flex-1 min-w-0 text-xs sm:text-sm bg-gray-50 h-10 rounded-xl"
                />
                <Button
                    onClick={() => { if (manualInput.trim()) { onScanned(manualInput.trim()); setManualInput(''); }}}
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
