"use client";

import { Calendar, CheckSquare, Droplets, Hammer, Wrench, Ruler } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

export default function ToolsPage() {
  const { t } = useLocale();

  const tools = [
    {
      name: t("tools.gardening_calendar"),
      slug: "gardening-calendar",
      icon: Calendar,
      color: "bg-green-100 text-green-700",
      description: t("tools.gardening_calendar_desc"),
    },
    {
      name: t("tools.monthly_checklist"),
      slug: "monthly-checklist",
      icon: CheckSquare,
      color: "bg-amber-100 text-amber-700",
      description: t("tools.monthly_checklist_desc"),
    },
    {
      name: t("tools.irrigation_calculator"),
      slug: "irrigation-calculator",
      icon: Droplets,
      color: "bg-blue-100 text-blue-700",
      description: t("tools.irrigation_calculator_desc"),
    },
    {
      name: t("tools.coming_soon_planner"),
      slug: "#",
      icon: Hammer,
      color: "bg-stone-100 text-stone-400",
      description: t("tools.coming_soon_planner_desc"),
      disabled: true,
    },
    {
      name: t("tools.coming_soon_estimator"),
      slug: "#",
      icon: Ruler,
      color: "bg-stone-100 text-stone-400",
      description: t("tools.coming_soon_estimator_desc"),
      disabled: true,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-800 font-serif mb-2">{t("tools.title")}</h1>
      <p className="text-stone-600 mb-10 text-lg">
        {t("tools.subtitle")}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          tool.disabled ? (
            <div
              key={tool.slug}
              className="p-6 rounded-xl border border-stone-200 bg-stone-50 opacity-60 cursor-not-allowed"
            >
              <tool.icon className={`w-10 h-10 mb-4 ${tool.color}`} />
              <h3 className="text-xl font-semibold mb-2 text-stone-500">{tool.name}</h3>
              <p className="text-stone-500 text-sm">{tool.description}</p>
            </div>
          ) : (
            <a
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className={`p-6 rounded-xl border border-stone-200 bg-white hover:shadow-lg transition group ${tool.color}`}
            >
              <tool.icon className="w-10 h-10 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{tool.name}</h3>
              <p className="text-stone-600 text-sm">{tool.description}</p>
            </a>
          )
        ))}
      </div>
    </div>
  );
}
