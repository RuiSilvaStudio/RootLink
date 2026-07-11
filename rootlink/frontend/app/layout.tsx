"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/lib/auth-context";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import { ToastProvider } from "@/lib/toast-context";
import { ThemeProvider } from "@/lib/theme-context";
import { OverlayProvider } from "@/components/overlay/overlay-provider";
import { OverlayShell } from "@/components/overlay/overlay-shell";
import { OverlayToggle } from "@/components/overlay/overlay-toggle";
import { StyleOverrideApplier } from "@/components/overlay/StyleOverrideApplier";
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
  const isStudio = pathname.startsWith("/studio");
  return (
    <html lang="pt" className="noise-bg" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
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
              <ThemeProvider>
                <StyleOverrideApplier />
                <CommandPalette />
                {/* NavBar renders MobileNav (drawer+sheets) and MobileBottomBar internally.
                    Studio routes have their own chrome (components/studio/StudioShell.tsx). */}
                {!isStudio && <NavBar />}
                {(isAdmin || isStudio) ? (
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
                {!isAdmin && !isAuth && !isStudio && <Footer />}
              </ThemeProvider>
              {/* Content Studio v2 — visual overlay (replaces the old inline editor).
                  Renders nothing unless super_admin + desktop + edit mode toggled on. */}
              <OverlayProvider>
                <OverlayShell />
                <OverlayToggle />
              </OverlayProvider>
            </ToastProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

// Footer extracted to components/Footer.tsx
