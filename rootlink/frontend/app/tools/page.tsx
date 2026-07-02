"use client";

import { Calendar, CheckSquare, Droplets, Hammer, Wrench, Ruler, Leaf, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EditableText } from "@/components/editor-mode/editable-text";

// nameKey/descKey (not pre-resolved strings) so EditableText can wrap them —
// keeps the .map() below generic: adding a 6th tool here (new entry + new
// i18n keys, same as adding any tool today) is automatically editable too,
// no extra wiring needed per-card.
const TOOLS = [
  {
    nameKey: "tools.gardening_calendar",
    slug: "gardening-calendar",
    icon: Calendar,
    iconBg: "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400",
    descKey: "tools.gardening_calendar_desc",
  },
  {
    nameKey: "tools.monthly_checklist",
    slug: "monthly-checklist",
    icon: CheckSquare,
    iconBg: "bg-earth-100 dark:bg-earth-900/30 text-earth-600 dark:text-earth-400",
    descKey: "tools.monthly_checklist_desc",
  },
  {
    nameKey: "tools.irrigation_calculator",
    slug: "irrigation-calculator",
    icon: Droplets,
    iconBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    descKey: "tools.irrigation_calculator_desc",
  },
  {
    nameKey: "tools.coming_soon_planner",
    slug: "#",
    icon: Hammer,
    iconBg: "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500",
    descKey: "tools.coming_soon_planner_desc",
    disabled: true,
  },
  {
    nameKey: "tools.coming_soon_estimator",
    slug: "#",
    icon: Ruler,
    iconBg: "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500",
    descKey: "tools.coming_soon_estimator_desc",
    disabled: true,
  },
];

export default function ToolsPage() {
  const tools = TOOLS;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <EditableText k="tools.title" as="h1" className="text-3xl font-serif font-bold text-stone-800" />
          <EditableText k="tools.subtitle" as="p" className="text-stone-500 font-light" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10">
        {tools.map((tool) => (
          tool.disabled ? (
            <div key={tool.slug}
              className="p-6 sm:p-8 rounded-xl2 border border-primary-100 dark:border-stone-700 bg-white/50 dark:bg-stone-900/50 opacity-50 cursor-not-allowed"
            >
              <div className={`w-10 h-10 rounded-xl ${tool.iconBg} flex items-center justify-center mb-4`}>
                <tool.icon className="w-5 h-5" />
              </div>
              <EditableText k={tool.nameKey} as="h3" className="text-lg font-serif font-bold text-stone-600 dark:text-stone-400 mb-2" />
              <EditableText k={tool.descKey} as="p" className="text-stone-500 dark:text-stone-400 text-sm font-light" />
              <Badge variant="stone" className="mt-3 text-[11px]"><EditableText k="tools.coming_soon" as="span" defaultText="Coming soon" /></Badge>
            </div>
          ) : (
            <a key={tool.slug} href={`/tools/${tool.slug}`}
              className="card-lift p-6 sm:p-8 group"
            >
              <div className={`w-12 h-12 rounded-2xl ${tool.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <EditableText k={tool.nameKey} as="h3" className="text-xl font-serif font-bold text-stone-800 dark:text-stone-100 mb-2" />
              <EditableText k={tool.descKey} as="p" className="text-stone-500 text-sm font-light leading-relaxed" />
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 mt-4 group-hover:gap-2 transition-all">
                <EditableText k="tools.open_tool" as="span" defaultText="Open tool" /> <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </a>
          )
        ))}
      </div>
    </div>
  );
}
