"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import { ToastProvider } from "@/lib/toast-context";
import { CommandPalette } from "@/components/CommandPalette";
import { NavBar } from "@/components/nav/NavBar";
import { Footer } from "@/components/Footer";
import "./globals.css";

function LangUpdater() {
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");
  return (
    <html lang="pt" className="noise-bg" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7a6040" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var stored = localStorage.getItem('theme');
              var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (stored === 'dark' || (!stored && prefersDark)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="min-h-screen flex flex-col">
        <LocaleProvider>
          <LangUpdater />
          <AuthProvider>
            <ToastProvider>
              <CommandPalette />
              {/* NavBar renders MobileNav (drawer+sheets) and MobileBottomBar internally */}
              <NavBar />
              {isAdmin ? (
                <main className="flex-1">{children}</main>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.main
                    key={pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`flex-1 ${isAuth ? "" : "pt-16"} pb-20 lg:pb-0`}
                  >
                    {children}
                  </motion.main>
                </AnimatePresence>
              )}
            </ToastProvider>
          </AuthProvider>
          {!isAdmin && !isAuth && <Footer />}
        </LocaleProvider>
      </body>
    </html>
  );
}

// Footer extracted to components/Footer.tsx
