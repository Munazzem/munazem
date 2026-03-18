'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarCheck, Loader2 } from 'lucide-react';

interface SetExcuseModalProps {
    student: any;
    onClose: () => void;
    onSave: (count: number) => void;
    isSaving: boolean;
}

export function SetExcuseModal({
    student,
    onClose,
    onSave,
    isSaving,
}: SetExcuseModalProps) {
    const [count, setCount] = useState(1);

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[360px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4 text-blue-600" />
                        تسجيل إذن غياب للطالب
                    </DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <p className="text-sm text-gray-600 mb-4">
                        الطالب: <span className="font-semibold">{student?.studentName ?? '—'}</span>
                    </p>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">عدد حصص الاستئذان:</label>
                        <Input 
                            type="number" 
                            min={1}
                            max={20}
                            value={count} 
                            onChange={(e) => setCount(parseInt(e.target.value) || 1)} 
                            className="bg-gray-50 text-center text-lg font-bold"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                            سيتم اعتباره "مُستأذن" في هذه الحصة وفي الحصص القادمة بناءً على العدد المحدد.
                        </p>
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                    <Button onClick={() => onSave(count)} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                        حفظ الإذن
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
