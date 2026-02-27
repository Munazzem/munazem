"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api } from "@/apis";
import { useAuthStore } from "@/context/useAuthStore";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setGlobalError(null);
    try {
      const response = await api.post("/auth/login", data);
      const { user, accessToken, refreshToken } = response.data.data;

      login(user, accessToken, refreshToken);

      if (user.role === "superAdmin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/teacher/dashboard");
      }
    } catch (error: any) {
      setGlobalError(error.response?.data?.message || "حدث خطأ أثناء تسجيل الدخول");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 flex-col overflow-hidden" dir="rtl">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl z-10 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-blue-900 mb-2">منظم</h1>
          <p className="text-gray-500 text-sm">مرحباً بك مجدداً، سجل دخولك للمتابعة</p>
        </div>

        {globalError && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm text-center">
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="رقم الهاتف"
            type="tel"
            placeholder="010XXXXXXXX"
            {...register("phone")}
            error={errors.phone?.message}
          />
          <Input
            label="كلمة المرور"
            type="password"
            placeholder="••••••••"
            {...register("password")}
            error={errors.password?.message}
          />

          <Button type="submit" className="w-full mt-4 h-12 text-lg font-bold" isLoading={isSubmitting}>
            تسجيل الدخول
          </Button>
        </form>
      </div>
    </div>
  );
}
