import type { ReactNode } from "react";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-chrome";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "JobPulse",
    template: "%s · JobPulse",
  },
  description: "Real-time remote job aggregator for IT professionals",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
