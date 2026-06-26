"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import { ToastProvider } from "@/lib/toast-context";
import { CommandPalette } from "@/components/CommandPalette";
import { NavBar } from "@/components/nav/NavBar";
import { MobileBottomBar } from "@/components/nav/MobileBottomBar";
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
              {!isAdmin && !isAuth && <MobileBottomBar />}
            </ToastProvider>
          </AuthProvider>
          {!isAdmin && !isAuth && <Footer />}
        </LocaleProvider>
      </body>
    </html>
  );
}

function Footer() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-primary-200/30 bg-cream noise-bg dark:bg-stone-950 dark:border-primary-800/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
        <div className="grid sm:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-display text-base font-semibold text-primary-700 dark:text-primary-300">RootLink</span>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 font-serif leading-relaxed max-w-xs">
              {t("nav.footer_description")}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-display font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-[0.12em] mb-5">{t("nav.discover")}</h4>
            <div className="space-y-3">
              <a href="https://github.com/RuiSilvaStudio/RootLink" target="_blank" rel="noopener noreferrer" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">GitHub</a>
              <a href="/network" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.network")}</a>
              <a href="/submit" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.submit")}</a>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-primary-200/20 dark:border-primary-800/20 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">&copy; 2026 RootLink. {t("nav.footer")}</p>
          <div className="w-8 h-px bg-primary-300/30 sm:hidden" />
          <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">{t("nav.footer_description")}</p>
        </div>
      </div>
    </footer>
  );
}
