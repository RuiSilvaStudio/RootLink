"use client";

import { Calendar, CheckSquare, Droplets, Hammer, Wrench, Ruler, Leaf, ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";

export default function ToolsPage() {
  const { t } = useLocale();

  const tools = [
    {
      name: t("tools.gardening_calendar"),
      slug: "gardening-calendar",
      icon: Calendar,
      iconBg: "bg-primary-100 text-primary-600",
      description: t("tools.gardening_calendar_desc"),
    },
    {
      name: t("tools.monthly_checklist"),
      slug: "monthly-checklist",
      icon: CheckSquare,
      iconBg: "bg-earth-100 text-earth-600",
      description: t("tools.monthly_checklist_desc"),
    },
    {
      name: t("tools.irrigation_calculator"),
      slug: "irrigation-calculator",
      icon: Droplets,
      iconBg: "bg-blue-100 text-blue-600",
      description: t("tools.irrigation_calculator_desc"),
    },
    {
      name: t("tools.coming_soon_planner"),
      slug: "#",
      icon: Hammer,
      iconBg: "bg-stone-100 text-stone-400",
      description: t("tools.coming_soon_planner_desc"),
      disabled: true,
    },
    {
      name: t("tools.coming_soon_estimator"),
      slug: "#",
      icon: Ruler,
      iconBg: "bg-stone-100 text-stone-400",
      description: t("tools.coming_soon_estimator_desc"),
      disabled: true,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-800">{t("tools.title")}</h1>
          <p className="text-stone-500 font-light">{t("tools.subtitle")}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10">
        {tools.map((tool) => (
          tool.disabled ? (
            <div key={tool.slug}
              className="p-6 sm:p-8 rounded-xl2 border border-primary-100 bg-white/50 opacity-50 cursor-not-allowed"
            >
              <div className={`w-10 h-10 rounded-xl ${tool.iconBg} flex items-center justify-center mb-4`}>
                <tool.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-serif font-bold text-stone-400 mb-2">{tool.name}</h3>
              <p className="text-stone-400 text-sm font-light">{tool.description}</p>
              <Badge variant="stone" className="mt-3 text-[11px]">{t("tools.coming_soon") || "Coming soon"}</Badge>
            </div>
          ) : (
            <a key={tool.slug} href={`/tools/${tool.slug}`}
              className="card-lift p-6 sm:p-8 group"
            >
              <div className={`w-12 h-12 rounded-2xl ${tool.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">{tool.name}</h3>
              <p className="text-stone-500 text-sm font-light leading-relaxed">{tool.description}</p>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 mt-4 group-hover:gap-2 transition-all">
                {t("tools.open_tool") || "Open tool"} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </a>
          )
        ))}
      </div>
    </div>
  );
}
