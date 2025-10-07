import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Open_Sans } from "next/font/google";
import { Noto_Sans_Hebrew } from "next/font/google";
import ErrorBoundary from '@/components/ErrorBoundary';

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400","600","700"], variable: "--font-open-sans" });
const notoHeb  = Noto_Sans_Hebrew({ subsets: ["hebrew"], weight: ["400","500","700"], variable: "--font-hebrew" });

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fde2e4",
};
export const metadata: Metadata = {
  title: "Sweet Recipes — מתכונים",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Sweet Recipes" },
  icons: { apple: "/apple-touch-icon.png" },
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body
        className={`${openSans.variable} ${notoHeb.variable} min-h-screen bg-white text-[#2b2b2b] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
