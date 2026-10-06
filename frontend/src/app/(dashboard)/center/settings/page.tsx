'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Settings,
    Building2,
    Plus,
    Edit2,
    MapPin,
    Phone,
    GitBranch,
    Shield,
    Check,
    Loader2,
} from 'lucide-react';
import {
    fetchMyCenters,
    createBranch,
    updateCenter,
} from '@/lib/api/centers';
import { ICenter } from '@/types/center.types';
import { BranchSwitcher } from '@/components/center/BranchSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

export default function CenterSettingsPage() {
    const queryClient = useQueryClient();
    const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
    const [editingCenter, setEditingCenter] = useState<ICenter | null>(null);

    // Form state for branch / center
    const [branchName, setBranchName] = useState('');
    const [branchPhone, setBranchPhone] = useState('');
    const [branchAddress, setBranchAddress] = useState('');

    const { data: centers = [], isLoading } = useQuery<ICenter[]>({
        queryKey: ['center', 'my-centers'],
        queryFn: fetchMyCenters,
    });

    const mainCenter = centers.find((c) => !c.parentCenterId) || centers[0];
    const branches = centers.filter((c) => c.parentCenterId);

    const createBranchMutation = useMutation({
        mutationFn: createBranch,
        onSuccess: () => {
            toast.success('تم إنشاء الفرع الجديد بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'my-centers'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء إنشاء الفرع');
        },
    });

    const updateCenterMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateCenter(id, data),
        onSuccess: () => {
            toast.success('تم تحديث البيانات بنجاح');
            queryClient.invalidateQueries({ queryKey: ['center', 'my-centers'] });
            handleCloseModal();
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'حدث خطأ أثناء التحديث');
        },
    });

    const handleOpenAddBranch = () => {
        setEditingCenter(null);
        setBranchName('');
        setBranchPhone('');
        setBranchAddress('');
        setIsAddBranchOpen(true);
    };

    const handleOpenEdit = (center: ICenter) => {
        setEditingCenter(center);
        setBranchName(center.name);
        setBranchPhone(center.phone || '');
        setBranchAddress(center.address || '');
        setIsAddBranchOpen(true);
    };

    const handleCloseModal = () => {
        setIsAddBranchOpen(false);
        setEditingCenter(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchName.trim()) {
            toast.error('اسم السنتر أو الفرع مطلوب');
            return;
        }

        const payload = {
            name: branchName.trim(),
            phone: branchPhone.trim() || null,
            address: branchAddress.trim() || null,
        };

        if (editingCenter) {
            updateCenterMutation.mutate({ id: editingCenter._id, data: payload });
        } else {
            createBranchMutation.mutate(payload);
        }
    };

    return (
        <div className="space-y-6 pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                        <Settings className="h-6 w-6 text-primary shrink-0" />
                        <span>إعدادات السنتر والفروع</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        إدارة بيانات السنتر الرئيسي وإضافة وتعديل الفروع التابعة له.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
                    <BranchSwitcher />
                    <Button onClick={handleOpenAddBranch} className="bg-primary hover:bg-primary/95 text-white gap-2 rounded-xl shadow-md shadow-primary/20 font-bold text-xs sm:text-sm h-10 w-full sm:w-auto">
                        <Plus className="h-4 w-4 shrink-0" />
                        <span>إضافة فرع جديد</span>
                    </Button>
                </div>
            </div>

            {/* Main Center Profile Card */}
            {mainCenter && (
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary font-black text-2xl flex items-center justify-center shrink-0 border border-primary/20">
                                {mainCenter.name.charAt(0)}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-black text-gray-900">{mainCenter.name}</h2>
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-xs">
                                        السنتر الرئيسي
                                    </Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-1">
                                    {mainCenter.phone && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-3.5 w-3.5" />
                                            {mainCenter.phone}
                                        </span>
                                    )}
                                    {mainCenter.address && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {mainCenter.address}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => handleOpenEdit(mainCenter)}
                            className="rounded-xl text-xs font-bold gap-1.5 self-start sm:self-auto"
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                            تعديل بيانات السنتر
                        </Button>
                    </div>
                </div>
            )}

            {/* Branches List */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <GitBranch className="h-5 w-5 text-primary" />
                            فروع السنتر ({branches.length})
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            كل فرع له طلابه ومشرفيه المستقلين مع إمكانية التبديل بينها من الشريط العلوي
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                ) : branches.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-bold text-gray-600">لا توجد فروع مسجلة إضافية</p>
                        <p className="text-xs text-gray-400 mt-1">
                            إذا كان للسنتر فروع في مناطق أخرى يمكنك إضافتها هنا
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {branches.map((branch) => (
                            <div
                                key={branch._id}
                                className="bg-gray-50/60 p-4 rounded-xl border border-gray-200/80 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-white text-gray-700 font-bold flex items-center justify-center border border-gray-200 shadow-sm text-sm">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900">{branch.name}</h4>
                                        <p className="text-xs text-gray-400 mt-0.5">{branch.address || 'بدون عنوان محدد'}</p>
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenEdit(branch)}
                                    className="h-8 px-2 text-xs font-bold text-gray-600 hover:text-primary rounded-lg"
                                >
                                    <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add / Edit Branch Dialog */}
            <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
                <DialogContent className="sm:max-w-md text-right font-sans" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-gray-900">
                            {editingCenter ? 'تعديل بيانات السنتر / الفرع' : 'إضافة فرع جديد للسنتر'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-2">
                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">اسم الفرع / السنتر *</label>
                            <Input
                                value={branchName}
                                onChange={(e) => setBranchName(e.target.value)}
                                placeholder="مثال: فرع مدينة نصر، فرع الدقي..."
                                className="rounded-xl border-gray-200"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">رقم الهاتف للفرع</label>
                            <Input
                                value={branchPhone}
                                onChange={(e) => setBranchPhone(e.target.value)}
                                placeholder="01XXXXXXXXX"
                                className="rounded-xl border-gray-200"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-gray-700 block mb-1">العنوان أو المكان</label>
                            <Input
                                value={branchAddress}
                                onChange={(e) => setBranchAddress(e.target.value)}
                                placeholder="مثال: شارع مصطفى النحاس - عمارة 12"
                                className="rounded-xl border-gray-200"
                            />
                        </div>

                        <DialogFooter className="gap-2 pt-2 sm:justify-start">
                            <Button
                                type="submit"
                                disabled={createBranchMutation.isPending || updateCenterMutation.isPending}
                                className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl"
                            >
                                {(createBranchMutation.isPending || updateCenterMutation.isPending) && (
                                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                                )}
                                {editingCenter ? 'حفظ التعديلات' : 'إضافة الفرع'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseModal}
                                className="rounded-xl"
                            >
                                إلغاء
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
