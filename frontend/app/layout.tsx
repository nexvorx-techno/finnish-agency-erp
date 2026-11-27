import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaManager } from "../components/PwaManager";

export const metadata: Metadata = {
  title: "RekrySilta ERP | Client Portal",
  description: "Enterprise Henkilöstövuokraus Management System - Client Portal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RekrySilta",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" data-font="plus-jakarta-sans">
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('erp_theme') || 'light';
                const font = localStorage.getItem('erp_font') || 'plus-jakarta-sans';
                document.documentElement.setAttribute('data-theme', theme);
                document.documentElement.setAttribute('data-font', font);
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased selection:bg-blue-500 selection:text-white">
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
