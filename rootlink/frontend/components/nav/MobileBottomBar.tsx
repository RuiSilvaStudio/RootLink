"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { mobileBottomTabs } from "./NavConfig";

export function MobileBottomBar() {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden pb-safe">
      <div className="mx-2 mb-2">
        <div className="flex items-center justify-around bg-white/90 backdrop-blur-[16px] border border-primary-200/40 rounded-2xl shadow-lg px-1 py-1">
          {mobileBottomTabs.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[48px] ${
                  active
                    ? "text-primary-700"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    active ? "scale-110" : ""
                  }`}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span
                  className={`text-[10px] font-display leading-none ${
                    active ? "font-semibold" : "font-medium"
                  }`}
                >
                  {t(item.labelKey)}
                </span>
                {active && (
                  <div className="w-4 h-0.5 bg-primary-600 rounded-full mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
