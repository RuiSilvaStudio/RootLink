"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { GrainOverlay } from "@/components/ui/GrainOverlay";
import { Menu, X, LayoutDashboard, Search, Leaf, FileText, Users, MessageSquare, Megaphone, Globe, Ticket, Heart, Award, Store, Settings, ChevronLeft, ChevronRight } from "lucide-react";

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35 };

const navItems = (t: (key: string, vars?: any) => string, isAdmin?: boolean) => [
  { href: "/admin", label: t("admin.dashboard"), icon: LayoutDashboard },
  { href: "/admin/review-queue", label: t("admin.review_queue"), icon: Search },
  { href: "/admin/plants", label: t("admin.plants"), icon: Leaf },
  { href: "/admin/content", label: t("admin.content"), icon: FileText },
  { href: "/admin/users", label: t("admin.users"), icon: Users },
  { href: "/admin/groups", label: t("admin.groups"), icon: Users },
  { href: "/admin/comments", label: t("admin.comments"), icon: MessageSquare },
  { href: "/admin/tickets", label: t("admin.tickets"), icon: Ticket },
  { href: "/admin/donations", label: t("admin.donations"), icon: Heart },
  { href: "/admin/sponsors", label: t("admin.sponsors"), icon: Award },
  { href: "/admin/vendors", label: t("admin.vendors"), icon: Store },
  { href: "/admin/notifications", label: t("admin.broadcast"), icon: Megaphone },
  { href: "/admin/submit", label: t("admin.submit_url"), icon: Globe },
  ...(isAdmin ? [{ href: "/admin/config", label: t("admin.config"), icon: Settings }] : []),
];

/* ─── Desktop NavItem (liquid glass hover expand) ─── */
function DesktopNavItem({
  item,
  active,
  pinned,
  isHovered,
  onHoverStart,
  onHoverEnd,
}: {
  item: { href: string; label: string; icon: any };
  active: boolean;
  pinned: boolean;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const showExpanded = pinned || isHovered;

  return (
    <Link
      href={item.href}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      title={item.label}
    >
      <motion.div
        animate={{ width: showExpanded ? 180 : 48 }}
        transition={SPRING}
        className="relative flex items-center h-11 rounded-xl cursor-pointer overflow-hidden"
        style={{ zIndex: isHovered && !pinned ? 50 : 10 }}
      >
        <AnimatePresence>
          {isHovered && !pinned && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="liquid-glass-pill absolute inset-0 rounded-xl"
            />
          )}
        </AnimatePresence>

        {isHovered && !pinned && <GrainOverlay opacity={0.04} />}

        {active && !showExpanded && (
          <div className="absolute inset-0 rounded-xl bg-primary-400/20" />
        )}

        <div className="relative z-10 flex items-center gap-3 px-3 w-full">
          <item.icon
            className={`w-5 h-5 shrink-0 transition-colors duration-150 ${
              showExpanded
                ? active ? "text-primary-700" : "text-stone-500"
                : active ? "text-cream" : "text-cream/60"
            }`}
          />
          <AnimatePresence>
            {showExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="text-sm font-serif text-stone-700 font-medium whitespace-nowrap overflow-hidden"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </Link>
  );
}

/* ─── Mobile NavItem (full-width, always shows label) ─── */
function MobileNavItem({
  item,
  active,
  onClick,
}: {
  item: { href: string; label: string; icon: any };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-serif transition ${
        active
          ? "bg-primary-600/30 text-primary-800 font-medium"
          : "text-stone-600 hover:bg-primary-50/40"
      }`}
    >
      <item.icon className={`w-5 h-5 shrink-0 ${active ? "text-primary-700" : "text-stone-400"}`} />
      <span>{item.label}</span>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [hoveredFooter, setHoveredFooter] = useState<"back" | "pin" | null>(null);
  const [pinned, setPinned] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Restore pinned state
  useEffect(() => {
    const saved = localStorage.getItem("admin-sidebar-pinned");
    if (saved === "true") setPinned(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("admin-sidebar-pinned", String(pinned));
  }, [pinned]);

  // Responsive breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    api.auth.me().then(setUser).catch(() => {
      localStorage.removeItem("token");
      router.push("/auth/login");
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-400 font-serif pt-16 ml-16">
        {t("admin.loading")}
      </div>
    );
  }

  const allowed = user?.role === "admin" || user?.role === "moderator" || user?.role === "contributor";
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-16 ml-16">
        <p className="text-stone-500 text-lg font-serif">{t("admin.no_access")}</p>
        <Link href="/" className="text-primary-600 hover:underline font-serif">{t("admin.back_home")}</Link>
      </div>
    );
  }

  const closeMobile = () => setMobileOpen(false);
  const isAdmin = user?.role === "admin";
  const items = navItems(t, isAdmin);
  const sidebarWidth = pinned ? 256 : 56;

  return (
    <div className="min-h-[calc(100vh-4rem)] pt-16">

      {/* ═══════════════════════════════════════════
          DESKTOP SIDEBAR — liquid glass floating bar
         ═══════════════════════════════════════════ */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={SPRING}
        className="fixed top-20 bottom-2 left-2 z-40 liquid-glass rounded-2xl flex-col overflow-visible hidden lg:flex"
      >
        {/* Header */}
        <div className="flex items-center justify-start h-11 px-3 shrink-0">
          <AnimatePresence mode="wait">
            {pinned ? (
              <motion.h2
                key="title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="text-sm font-display font-semibold text-cream/90 uppercase tracking-[0.12em] whitespace-nowrap"
              >
                {t("admin.panel")}
              </motion.h2>
            ) : (
              <motion.div
                key="dot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="w-1.5 h-1.5 rounded-full bg-cream/40"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="relative z-10 flex-1 flex flex-col gap-0.5 px-2 py-1">
          {items.map((item, i) => (
            <DesktopNavItem
              key={item.href}
              item={item}
              active={pathname === item.href}
              pinned={pinned}
              isHovered={hoveredIndex === i}
              onHoverStart={() => setHoveredIndex(i)}
              onHoverEnd={() => setHoveredIndex(-1)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 pb-2 pt-1 border-t border-white/5 relative z-10 flex flex-col gap-0.5">
          <Link
            href="/"
            title={t("admin.back_to_site")}
            onMouseEnter={() => setHoveredFooter("back")}
            onMouseLeave={() => setHoveredFooter(null)}
          >
            <motion.div
              animate={{ width: hoveredFooter === "back" || pinned ? 180 : 48 }}
              transition={SPRING}
              className="relative flex items-center h-10 rounded-xl cursor-pointer overflow-hidden"
            >
              {hoveredFooter === "back" && !pinned && (
                <div className="absolute inset-0 rounded-xl liquid-glass-pill" />
              )}
              <div className="relative z-10 flex items-center gap-3 px-3 w-full">
                <ChevronLeft className="w-5 h-5 shrink-0 text-cream/40" />
                <AnimatePresence>
                  {(hoveredFooter === "back" || pinned) && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="text-sm font-serif text-stone-700 font-medium whitespace-nowrap overflow-hidden"
                    >
                      {t("admin.back_to_site")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </Link>
          <button
            onClick={() => setPinned(!pinned)}
            onMouseEnter={() => setHoveredFooter("pin")}
            onMouseLeave={() => setHoveredFooter(null)}
            title={pinned ? "Collapse sidebar" : "Pin sidebar open"}
          >
            <motion.div
              animate={{ width: hoveredFooter === "pin" || pinned ? 180 : 48 }}
              transition={SPRING}
              className="relative flex items-center h-10 rounded-xl cursor-pointer overflow-hidden"
            >
              {hoveredFooter === "pin" && !pinned && (
                <div className="absolute inset-0 rounded-xl liquid-glass-pill" />
              )}
              <div className="relative z-10 flex items-center gap-3 px-3 w-full">
                <motion.div animate={{ rotate: pinned ? 180 : 0 }} transition={SPRING}>
                  <ChevronRight className="w-5 h-5 shrink-0 text-cream/40" />
                </motion.div>
                <AnimatePresence>
                  {(hoveredFooter === "pin" || pinned) && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="text-sm font-serif text-stone-700 font-medium whitespace-nowrap overflow-hidden"
                    >
                      {t("admin.collapse")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </button>
        </div>
      </motion.aside>

      {/* ═══════════════════════════════════════════
          MOBILE SIDEBAR — full-height drawer
         ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm lg:hidden"
              onClick={closeMobile}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={SPRING}
              className="fixed top-0 left-0 bottom-0 z-50 w-[280px] liquid-glass-drawer flex flex-col lg:hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between h-16 px-5 border-b border-white/5 shrink-0">
                <h2 className="text-sm font-display font-semibold text-stone-700 uppercase tracking-[0.12em]">
                  {t("admin.panel")}
                </h2>
                <button
                  onClick={closeMobile}
                  className="p-1.5 rounded-lg hover:bg-primary-100/40 text-stone-400 hover:text-stone-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav items — scrollable */}
              <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
                {items.map((item) => (
                  <MobileNavItem
                    key={item.href}
                    item={item}
                    active={pathname === item.href}
                    onClick={closeMobile}
                  />
                ))}
              </nav>

              {/* Footer */}
              <div className="px-3 pb-4 pt-2 border-t border-primary-200/30 shrink-0">
                <Link
                  href="/"
                  onClick={closeMobile}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-stone-500 hover:text-stone-700 hover:bg-primary-50/30 transition font-serif"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("admin.back_to_site")}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════
          CONTENT
         ═══════════════════════════════════════════ */}
      <motion.main
        initial={false}
        animate={{ marginLeft: isDesktop ? sidebarWidth + 16 : 0 }}
        transition={SPRING}
        className="p-6 bg-cream noise-bg overflow-auto"
      >
        {/* Mobile menu trigger */}
        <button
          className="lg:hidden flex items-center gap-2 mb-4 text-sm text-stone-500 hover:text-stone-700 transition"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs font-display font-semibold text-stone-400 uppercase tracking-[0.12em]">{t("admin.panel")}</span>
        </button>
        {children}
      </motion.main>
    </div>
  );
}
