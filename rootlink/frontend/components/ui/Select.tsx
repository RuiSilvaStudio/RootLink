"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
};

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ label, error, options, className = "", id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-display font-medium text-stone-700 tracking-wide">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-4 py-2.5 bg-white border rounded-xl2 text-stone-800 text-sm
            transition-all duration-200 appearance-none
            focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none
            ${error ? "border-rust-300" : "border-primary-200/60"}
            ${className}
          `.trim()}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-rust-600 font-display tracking-wide">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
