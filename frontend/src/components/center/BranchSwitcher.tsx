'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import { Building2, ChevronDown, Check, GitBranch } from 'lucide-react';
import { fetchMyCenters } from '@/lib/api/centers';
import { ICenter } from '@/types/center.types';
import { useAuthStore } from '@/lib/store/auth.store';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function BranchSwitcher({ className }: { className?: string }) {
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();
    const [selectedBranchId, setSelectedBranchId] = useState<string>('');

    const { data: centers = [], isLoading } = useQuery<ICenter[]>({
        queryKey: ['center', 'my-centers'],
        queryFn: fetchMyCenters,
        enabled: user?.role === 'centerOwner' || user?.role === 'centerSupervisor',
    });

    useEffect(() => {
        const saved = Cookies.get('selectedBranchId');
        if (saved && centers.some((c) => c._id === saved)) {
            setSelectedBranchId(saved);
        } else if (centers.length > 0) {
            // Default to main center (parentCenterId is null) or first center
            const main = centers.find((c) => !c.parentCenterId) || centers[0];
            setSelectedBranchId(main._id);
            Cookies.set('selectedBranchId', main._id);
        }
    }, [centers]);

    const handleSelectBranch = (branchId: string) => {
        setSelectedBranchId(branchId);
        Cookies.set('selectedBranchId', branchId);
        queryClient.invalidateQueries({ queryKey: ['center'] });
    };

    if (isLoading || centers.length === 0) return null;

    const currentCenter = centers.find((c) => c._id === selectedBranchId) || centers[0];

    // If only one center and not owner, don't show dropdown
    if (centers.length <= 1 && user?.role !== 'centerOwner') {
        return (
            <div className={cn("flex items-center gap-2 px-3.5 py-2 bg-primary/5 text-primary rounded-xl text-xs sm:text-sm font-bold border border-primary/10 h-10 w-full sm:w-auto shrink-0", className)}>
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{currentCenter?.name}</span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="outline" 
                    className={cn(
                        "flex items-center justify-between sm:justify-start gap-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-800 rounded-xl px-3.5 h-10 text-xs sm:text-sm font-bold shadow-xs w-full sm:w-auto shrink-0",
                        className
                    )}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <GitBranch className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate max-w-[200px] sm:max-w-[200px]">{currentCenter?.name}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 text-right font-medium">
                <DropdownMenuLabel className="text-xs text-gray-400 font-semibold px-2 py-1">
                    الفروع المتاحة
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {centers.map((center) => (
                    <DropdownMenuItem
                        key={center._id}
                        onClick={() => handleSelectBranch(center._id)}
                        className="flex items-center justify-between px-3 py-2 text-xs sm:text-sm cursor-pointer rounded-lg hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                            <span className="truncate">{center.name}</span>
                            {!center.parentCenterId && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold shrink-0">
                                    الرئيسي
                                </span>
                            )}
                        </div>
                        {selectedBranchId === center._id && (
                            <Check className="h-4 w-4 text-primary shrink-0 mr-2" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
