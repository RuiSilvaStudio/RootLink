"use client";

import { useState, useEffect } from "react";
import { Moon } from "lucide-react";
import { api } from "@/lib/api";
import { SidebarWidget } from "@/components/ui/DeFacto";

export function MoonWidget() {
  const [moon, setMoon] = useState<any>(null);

  useEffect(() => {
    api.external.moon().then(setMoon).catch(() => {});
  }, []);

  if (!moon) return null;

  return (
    <SidebarWidget icon={Moon} title="Moon Phase">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{moon.icon}</span>
        <div>
          <p className="text-sm font-display font-semibold text-stone-700">{moon.phase}</p>
          <p className="text-[10px] text-stone-600">{moon.illumination}% illuminated</p>
        </div>
      </div>
      <p className="text-xs text-stone-500 mt-3 leading-relaxed font-serif">
        {moon.agricultural_en}
      </p>
    </SidebarWidget>
  );
}
