"use client";

import { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function Toggle({ label, id, className = "", ...props }: Props) {
  const toggleId = id || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label data-rl-component="Toggle" htmlFor={toggleId} className={`inline-flex items-center gap-3 cursor-pointer group ${className}`}>
      <div className="relative">
        <input
          type="checkbox"
          id={toggleId}
          className="sr-only peer"
          {...props}
        />
        <div className="w-10 h-6 rounded-full border border-primary-200/60 dark:border-stone-600 bg-white dark:bg-stone-800 transition-all duration-200 peer-checked:bg-primary-600 peer-checked:border-primary-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-cream dark:peer-focus-visible:ring-offset-stone-900" />
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm border border-primary-200 dark:border-stone-500 transition-all duration-200 peer-checked:translate-x-4 peer-checked:border-primary-600" />
      </div>
      <span className="text-sm text-stone-600 dark:text-stone-400 group-hover:text-stone-800 dark:group-hover:text-stone-200 transition font-serif">{label}</span>
    </label>
  );
}
