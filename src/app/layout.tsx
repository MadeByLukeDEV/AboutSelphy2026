import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AnimatedBackground } from "@/components/effects/animated-background";
import { CustomCursor } from "@/components/effects/custom-cursor";
import "./globals.css";

// Named "--font-sans" directly so it plugs into globals.css's
// `--font-sans: var(--font-sans)` indirection without touching that file.
const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AboutSelphy",
  description: "AboutSelphy — streamer, creator, community.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AnimatedBackground />
        <CustomCursor />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
