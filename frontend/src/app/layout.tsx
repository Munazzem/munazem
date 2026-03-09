import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "منصة مُنظِّم — Monazem",
  description: "المنصة الأذكى لإدارة السناتر التعليمية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} antialiased bg-[#fdfdfd] text-[#111111]`}>
        <Providers>
            {children}
            <Toaster position="top-center" richColors theme="light" />
        </Providers>
      </body>
    </html>
  );
}
