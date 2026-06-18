"use client";

import { useState, useEffect } from "react";
import { Sunrise, Sunset } from "lucide-react";
import { api } from "@/lib/api";

export function SunWidget() {
  const [sun, setSun] = useState<any>(null);

  useEffect(() => {
    // Default to Porto, Portugal
    api.external.sun(41.1579, -8.6291).then(setSun).catch(() => {});
  }, []);

  if (!sun || !sun.sunrise) return null;

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200/60 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sunrise className="w-4 h-4 text-amber-500" />
        <h3 className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider">Sun Today</h3>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sunrise className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-stone-500">Sunrise</span>
          </div>
          <span className="text-sm font-display font-semibold text-stone-700">{formatTime(sun.sunrise)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sunset className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs text-stone-500">Sunset</span>
          </div>
          <span className="text-sm font-display font-semibold text-stone-700">{formatTime(sun.sunset)}</span>
        </div>
        <div className="pt-2 border-t border-stone-100">
          <span className="text-[10px] text-stone-400">{sun.day_length_hours}h of daylight</span>
        </div>
      </div>
    </div>
  );
}
