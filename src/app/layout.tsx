import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GhostDrop | Secure Ephemeral File Sharing",
  description:
    "Lightweight, full-stack password-protected file sharing with 5-minute auto-destruction, server-side bcrypt hashing, and Supabase private storage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
        {/* Ambient subtle glowing gradients */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/15 to-transparent blur-3xl opacity-70 rounded-full" />
          <div className="absolute top-1/3 -right-40 w-[500px] h-[350px] bg-gradient-to-bl from-pink-600/10 via-indigo-600/10 to-transparent blur-3xl opacity-50 rounded-full" />
          <div className="absolute bottom-10 -left-40 w-[500px] h-[350px] bg-gradient-to-tr from-cyan-600/10 via-blue-600/10 to-transparent blur-3xl opacity-40 rounded-full" />
        </div>

        {/* Top Navigation */}
        <Navbar />

        {/* Main Content */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p>© {new Date().getFullYear()} GhostDrop • Private Ephemeral File Sharing</p>
            <p className="flex items-center gap-1.5 text-slate-400">
              Files auto-purged from cloud storage after 5 minutes
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
