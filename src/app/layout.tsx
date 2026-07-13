import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { NativeInit } from "@/components/NativeInit";
import { Toaster } from "@/components/toast";
import { MacroTrayDownloadBanner } from "@/components/MacroTrayDownloadBanner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://macroverse.vercel.app"),
  title: { default: "MacroVerse", template: "%s · MacroVerse" },
  description: "Community-driven macro tracking, recipes, meal prep, and fitness.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "MacroVerse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        {children}
        <Toaster />
        <PwaRegister />
        <NativeInit />
        <MacroTrayDownloadBanner />
      </body>
    </html>
  );
}
