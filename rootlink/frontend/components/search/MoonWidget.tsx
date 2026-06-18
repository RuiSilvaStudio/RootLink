"use client";

import { useState, useEffect } from "react";
import { Moon } from "lucide-react";
import { api } from "@/lib/api";

export function MoonWidget() {
  const [moon, setMoon] = useState<any>(null);

  useEffect(() => {
    api.external.moon().then(setMoon).catch(() => {});
  }, []);

  if (!moon) return null;

  return (
    <div className="rounded-2xl border border-stone-200/60 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Moon className="w-4 h-4 text-stone-500" />
        <h3 className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider">Moon Phase</h3>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{moon.icon}</span>
        <div>
          <p className="text-sm font-display font-semibold text-stone-700">{moon.phase}</p>
          <p className="text-[10px] text-stone-400">{moon.illumination}% illuminated</p>
        </div>
      </div>
      <p className="text-xs text-stone-500 mt-3 leading-relaxed font-serif">
        {moon.agricultural_en}
      </p>
    </div>
  );
}
