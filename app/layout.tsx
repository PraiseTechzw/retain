import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { appConfig } from "@/lib/system";

export const metadata: Metadata = {
  title: `${appConfig.appName} | ${appConfig.organization}`,
  description: `Secure employee exit, clearance, and institutional knowledge preservation for ${appConfig.organization}.`,
  generator: "v0.app",
  icons: {
    icon: "/cut-logo.png",
    shortcut: "/cut-logo.png",
    apple: "/cut-logo.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
