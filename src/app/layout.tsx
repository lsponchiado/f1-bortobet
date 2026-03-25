import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#15151e',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: "F1 Bortobet",
  description: "Apostas de Fórmula 1",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bortobet',
  },
  icons: {
    apple: '/icon-512.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#15151e]`}
      >
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
