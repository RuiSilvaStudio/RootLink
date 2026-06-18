import { ReactNode } from "react";

const variants = {
  sage: "bg-primary-100/60 text-primary-700 border-primary-200/40",
  green: "bg-emerald-100/60 text-emerald-700 border-emerald-200/40",
  earth: "bg-earth-100/60 text-earth-700 border-earth-200/40",
  blue: "bg-sky-100/60 text-sky-700 border-sky-200/40",
  stone: "bg-stone-100/60 text-stone-600 border-stone-200/40",
  amber: "bg-amber-100/60 text-amber-700 border-amber-200/40",
  red: "bg-red-100/60 text-red-700 border-red-200/40",
};

type Props = {
  variant?: keyof typeof variants;
  children: ReactNode;
  dot?: boolean;
  className?: string;
};

export function Badge({ variant = "sage", children, dot, className = "" }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-medium uppercase tracking-wider border ${variants[variant]} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {children}
    </span>
  );
}
