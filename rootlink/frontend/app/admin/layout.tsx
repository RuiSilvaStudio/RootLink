"use client";

import { useLocale } from "@/lib/locale-context";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();

  return (
    <div className="min-h-[calc(100vh-4rem)] pt-16">
      <AdminSidebar />
      <main className="ml-[272px] p-6 bg-cream noise-bg overflow-auto hidden lg:block">
        {children}
      </main>
    </div>
  );
}
