import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { PWAEventListener } from "@/components/pwa/PWAEventListener";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { CacheWarmer } from "@/components/pwa/CacheWarmer";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
});

export const metadata: Metadata = {
  title: "منظِّم — Monazem",
  description: "المنصة الأذكى لإدارة السناتر التعليمية",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "منظِّم",
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
    shortcut: '/favicon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a6e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${cairo.variable} antialiased bg-slate-50 text-[#111111] overflow-x-hidden`}>
        <Providers>
            {children}
            <PWAEventListener />
            <CacheWarmer />
            <Toaster position="top-center" richColors theme="light" />
            <OfflineIndicator />
            <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
