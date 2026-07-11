import { HTMLAttributes, ReactNode } from "react";

const variants = {
  sage: "bg-primary-100/60 text-primary-700 border-primary-200/40 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-700/40",
  green: "bg-emerald-100/60 text-emerald-700 border-emerald-200/40 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700/40",
  earth: "bg-earth-100/60 text-earth-700 border-earth-200/40 dark:bg-earth-900/40 dark:text-earth-300 dark:border-earth-700/40",
  blue: "bg-sky-100/60 text-sky-700 border-sky-200/40 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700/40",
  stone: "bg-stone-100/60 text-stone-600 border-stone-200/40 dark:bg-stone-800/60 dark:text-stone-300 dark:border-stone-700/40",
  amber: "bg-amber-100/60 text-amber-700 border-amber-200/40 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700/40",
  red: "bg-red-100/60 text-red-700 border-red-200/40 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/40",
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
  children: ReactNode;
  dot?: boolean;
  className?: string;
};

export function Badge({ variant = "sage", children, dot, className = "", ...rest }: Props) {
  return (
    <span data-rl-component="Badge" className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-medium uppercase tracking-wider border ${variants[variant]} ${className}`} {...rest}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {children}
    </span>
  );
}
