import type { Metadata, Viewport } from "next";
import { Cairo, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { PWAEventListener } from "@/components/pwa/PWAEventListener";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { OfflineSyncWorker } from "@/components/pwa/OfflineSyncWorker";
import { DataPreloader } from "@/components/pwa/DataPreloader";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
    apple: '/icons/icon-192x192.png',
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
      <body className={`${cairo.variable} ${jakarta.variable} font-sans antialiased bg-slate-50 text-[#111111] overflow-x-hidden`}>
        <Toaster
          position="top-center"
          richColors
          theme="light"
          dir="rtl"
          closeButton
        />
        <Providers>
          {children}
          <PWAEventListener />
          <OfflineSyncWorker />
          <DataPreloader />
          <OfflineIndicator />
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
