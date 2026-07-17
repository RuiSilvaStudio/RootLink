"use client";

/**
 * Program card with the 3-level hierarchy (Program → category → item),
 * shared by the landing snippet and the Programs page.
 *
 * Sub-fields with parent_id = null are *categories* (Infantis, Juniores);
 * sub-fields whose parent_id points at a category are *items* (5 aos 8 anos).
 * Legacy flat sub-fields (no parent, no children) still render as a chip.
 */

import type { GroupProgram, GroupProgramSubField } from "@/lib/groups-types";

export function buildTree(subfields: GroupProgramSubField[]): { category: GroupProgramSubField; items: GroupProgramSubField[] }[] {
  const byParent = new Map<number, GroupProgramSubField[]>();
  for (const s of subfields) {
    if (s.parent_id !== null) {
      const arr = byParent.get(s.parent_id) ?? [];
      arr.push(s);
      byParent.set(s.parent_id, arr);
    }
  }
  return subfields
    .filter(s => s.parent_id === null)
    .sort((a, b) => (a.display_order - b.display_order) || a.name.localeCompare(b.name))
    .map(category => ({ category, items: (byParent.get(category.id) ?? []).sort((a, b) => a.display_order - b.display_order) }));
}

export function ProgramCard({ program, subfields, index }: {
  program: GroupProgram;
  subfields: GroupProgramSubField[];
  index?: number;
}) {
  const tree = buildTree(subfields);
  return (
    <div className="relative rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(36,26,16,0.09)] transition-all duration-300">
      {index !== undefined && (
        <span aria-hidden className="absolute -top-3 right-2 font-display text-7xl font-semibold text-primary-100/70 dark:text-primary-900/40 select-none">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <h3 className="relative font-display font-[560] text-xl text-primary-800 dark:text-primary-200">{program.name}</h3>
      {program.description && (
        <p className="relative text-sm text-stone-500 font-serif mt-1.5 leading-relaxed">{program.description}</p>
      )}
      {tree.length > 0 && (
        <div className="relative mt-4 space-y-3">
          {tree.map(({ category, items }) => (
            <div key={category.id}>
              <p className="font-display font-[560] text-earth-500 text-sm tracking-wide">{category.name}</p>
              {items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 ml-2">
                  {items.map(item => (
                    <span key={item.id} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">
                      {item.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
