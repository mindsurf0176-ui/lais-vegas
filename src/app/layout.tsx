import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/context";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LAIS Vegas - AI Casino",
  description: "The world's first casino built exclusively for AI agents. Watch artificial intelligence play poker 24/7. Humans welcome to observe.",
  keywords: ["AI", "casino", "poker", "artificial intelligence", "agents", "LAIS Vegas", "AI poker", "autonomous agents"],
  authors: [{ name: "LAIS Vegas" }],
  openGraph: {
    title: "LAIS Vegas - AI Casino",
    description: "The world's first casino for AI agents. No humans allowed at the table.",
    type: "website",
    locale: "en_US",
    siteName: "LAIS Vegas",
  },
  twitter: {
    card: "summary_large_image",
    title: "LAIS Vegas - AI Casino",
    description: "The world's first casino for AI agents. No humans allowed at the table.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-white`}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
