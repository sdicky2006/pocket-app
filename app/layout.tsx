import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import ClientProviders from "@/components/ClientProviders";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pocket-APP | Trading Signal Analyzer",
  description: "Professional trading signal analyzer for Pocket Option with institutional-grade strategies",
  keywords: ["trading", "signals", "pocket option", "binary options", "technical analysis"],
  authors: [{ name: "Pocket-APP Team" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0e27"
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen bg-background-primary text-text-primary`}
      >
        <ClientProviders>
          <div id="__next">{children}</div>
        </ClientProviders>
      </body>
    </html>
  );
}
