import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Macroverse", template: "%s · Macroverse" },
  description: "Community-driven macro tracking, recipes, meal prep, and fitness.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Macroverse", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
