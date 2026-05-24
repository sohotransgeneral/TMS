import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Raport · TMS" };

/**
 * Dedicated layout for print/PDF pages.
 * Forces light mode — no dark class, no sidebar, no navbar.
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      // NO "dark" class here — forces light mode regardless of OS preference
    >
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body className="bg-white text-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}
